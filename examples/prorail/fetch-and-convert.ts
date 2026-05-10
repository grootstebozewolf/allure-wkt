/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Fetch one (or all) ProRail Sigma trajectories from the public
 * Spoorgeometrie ArcGIS REST FeatureServer, convert each chain of
 * alignment elements to a single COMPOUNDCURVE WKT, and write a
 * synthetic Allure-results directory ready for `allure-wkt`.
 *
 * Usage:
 *   npx tsx examples/prorail/fetch-and-convert.ts \
 *       --guid 510603bc-fef6-4d29-9a01-2bad891057ca \
 *       --out /tmp/prorail-results
 *   npx tsx examples/prorail/fetch-and-convert.ts --all --out /tmp/prorail-all
 *
 * Data: ProRail Spoorgeometrie open dataset (CC BY 4.0).
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const FEATURE_SERVER =
  'https://maps.prorail.nl/arcgis/rest/services/Spoorgeometrie/FeatureServer/11/query';
const PAGE_SIZE = 2000;

const ALLOWED_TYPES = new Set(['Rechtstand', 'Boog', 'Overgangsboog']);

interface ProRailFeature {
  attributes: {
    OBJECTID: number;
    SIGMATRAJECT_GUID: string;
    REF_FUNC_SPOORTAK_NAAM_LANG: string | null;
    VOLGNUMMER: number;
    ELEMENT_TYPE: string;
    ELEMENT_LENGTE: number;
    STRAAL_BEGIN: number | null;
    STRAAL_EIND: number | null;
    ROTATIE_BEGIN: 'CCW' | 'CW' | null;
    ROTATIE_EIND: 'CCW' | 'CW' | null;
    ARGUMENT_BEGIN: number;
    ARGUMENT_EIND: number;
  };
  geometry: { paths: [number, number][][] };
}

// ---------------------------------------------------------------------------
// fetch

async function fetchPage(where: string, offset: number): Promise<ProRailFeature[]> {
  const params = new URLSearchParams({
    where,
    outFields: [
      'OBJECTID', 'SIGMATRAJECT_GUID', 'REF_FUNC_SPOORTAK_NAAM_LANG',
      'VOLGNUMMER', 'ELEMENT_TYPE', 'ELEMENT_LENGTE',
      'STRAAL_BEGIN', 'STRAAL_EIND',
      'ROTATIE_BEGIN', 'ROTATIE_EIND',
      'ARGUMENT_BEGIN', 'ARGUMENT_EIND',
    ].join(','),
    returnGeometry: 'true',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    orderByFields: 'SIGMATRAJECT_GUID,VOLGNUMMER',
    f: 'json',
  });
  const url = `${FEATURE_SERVER}?${params}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ProRail fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as { features?: ProRailFeature[] };
  return data.features ?? [];
}

async function fetchAll(where: string): Promise<ProRailFeature[]> {
  const all: ProRailFeature[] = [];
  let offset = 0;
  while (true) {
    const page = await fetchPage(where, offset);
    if (page.length === 0) break;
    all.push(...page);
    offset += page.length;
    if (page.length < PAGE_SIZE) break;
    process.stderr.write(`\r[prorail] fetched ${all.length} features...`);
  }
  process.stderr.write('\n');
  return all;
}

// ---------------------------------------------------------------------------
// convert

/**
 * Pick a sign for the spiral's curvature from the rotation hint. CCW
 * rotation → positive κ (per CLOTHOID_PROPOSAL §3.1). When both ends
 * share rotation, either field works; in entry/exit clothoids one
 * end is rotation-less because κ=0 there.
 */
function signFromRotation(begin: string | null, end: string | null): 1 | -1 {
  const known = end ?? begin;
  return known === 'CCW' ? 1 : -1;
}

function memberWkt(f: ProRailFeature): string | null {
  const { attributes: a, geometry } = f;
  if (!geometry?.paths?.[0] || geometry.paths[0].length < 2) {
    return null;
  }
  const path = geometry.paths[0];
  const first = path[0];
  const last = path[path.length - 1];

  switch (a.ELEMENT_TYPE) {
    case 'Rechtstand':
      return `(${first[0]} ${first[1]}, ${last[0]} ${last[1]})`;
    case 'Boog': {
      // 3 control points: start, middle of polyline, end. The middle
      // index gives a point on the analytical arc (the polyline is
      // densified from the same source). Our renderer's circumcircle
      // fit handles the rest.
      const mid = path[path.length >> 1];
      return `CIRCULARSTRING (${first[0]} ${first[1]}, ${mid[0]} ${mid[1]}, ${last[0]} ${last[1]})`;
    }
    case 'Overgangsboog': {
      const sign = signFromRotation(a.ROTATIE_BEGIN, a.ROTATIE_EIND);
      const k0 = a.STRAAL_BEGIN ? sign / a.STRAAL_BEGIN : 0;
      const k1 = a.STRAAL_EIND ? sign / a.STRAAL_EIND : 0;
      if (k0 === k1) return null; // degenerate; skip (parser would reject)
      return `CLOTHOID (${k0}, ${k1}, ${a.ELEMENT_LENGTE})`;
    }
    default:
      return null;
  }
}

interface Trajectory {
  guid: string;
  name: string;
  wkt: string;
  elementCount: number;
}

function buildTrajectory(features: ProRailFeature[]): Trajectory | null {
  if (features.length === 0) return null;
  const sorted = [...features].sort(
    (a, b) => a.attributes.VOLGNUMMER - b.attributes.VOLGNUMMER,
  );
  const members: string[] = [];
  for (const f of sorted) {
    if (!ALLOWED_TYPES.has(f.attributes.ELEMENT_TYPE)) continue;
    const m = memberWkt(f);
    if (m) members.push(m);
  }
  if (members.length === 0) return null;
  // Don't lead with a CLOTHOID -- parser rejects (proposal §3.2).
  // If we somehow do (every prefix element was filtered out), bail.
  if (members[0].startsWith('CLOTHOID')) return null;
  return {
    guid: sorted[0].attributes.SIGMATRAJECT_GUID,
    name: sorted[0].attributes.REF_FUNC_SPOORTAK_NAAM_LANG ?? sorted[0].attributes.SIGMATRAJECT_GUID,
    wkt: `COMPOUNDCURVE (${members.join(', ')})`,
    elementCount: sorted.length,
  };
}

function groupByTrajectory(features: ProRailFeature[]): Map<string, ProRailFeature[]> {
  const groups = new Map<string, ProRailFeature[]>();
  for (const f of features) {
    const guid = f.attributes.SIGMATRAJECT_GUID;
    let bucket = groups.get(guid);
    if (!bucket) {
      bucket = [];
      groups.set(guid, bucket);
    }
    bucket.push(f);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// emit Allure results

function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96);
}

async function emitAllureResults(
  trajectories: Trajectory[],
  outDir: string,
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  for (const t of trajectories) {
    const slug = safeFileName(`${t.name}-${t.guid}`);
    const wktSource = `${slug}.wkt`;
    await writeFile(join(outDir, wktSource), `${t.wkt}\n`);
    await writeFile(
      join(outDir, `${slug}-result.json`),
      JSON.stringify({
        uuid: t.guid,
        name: `${t.name} (${t.elementCount} alignment elements)`,
        attachments: [
          {
            name: 'alignment',
            source: wktSource,
            type: 'application/vnd.ogc.wkt',
          },
        ],
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// CLI

interface Args {
  guid: string | null;
  all: boolean;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { guid: null, all: false, out: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--guid') args.guid = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--out') args.out = argv[++i];
  }
  if (!args.out) {
    throw new Error('Missing --out <dir>');
  }
  if (!args.guid && !args.all) {
    throw new Error('Pass either --guid <SIGMATRAJECT_GUID> or --all');
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const where = args.all
    ? '1=1'
    : `SIGMATRAJECT_GUID='${args.guid}'`;
  await rm(args.out, { recursive: true, force: true });

  console.error(`[prorail] fetching ${args.all ? 'all features' : `trajectory ${args.guid}`}...`);
  const features = await fetchAll(where);
  console.error(`[prorail] fetched ${features.length} features`);

  const groups = groupByTrajectory(features);
  console.error(`[prorail] ${groups.size} distinct trajectories`);

  const trajectories: Trajectory[] = [];
  let skipped = 0;
  for (const featuresInGroup of groups.values()) {
    const t = buildTrajectory(featuresInGroup);
    if (t) trajectories.push(t);
    else skipped++;
  }
  console.error(
    `[prorail] built ${trajectories.length} COMPOUNDCURVE WKTs (${skipped} skipped)`,
  );

  await emitAllureResults(trajectories, args.out);
  console.error(`[prorail] wrote results to ${args.out}`);
  console.error(`[prorail] now run: npx tsx src/index.ts ${args.out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
