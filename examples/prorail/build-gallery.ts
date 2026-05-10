/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Build a static HTML gallery from a directory of allure-wkt-generated
 * SVG sidecars (one per trajectory). Pairs each rendered SVG with the
 * test name from its sibling `*-result.json`.
 *
 * Usage:
 *   npx tsx examples/prorail/build-gallery.ts \
 *       --in /tmp/prorail-all \
 *       --out /tmp/prorail-gallery
 */
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

interface GalleryItem {
  name: string;
  uuid: string;
  svgFile: string; // relative path used in the gallery output dir
  elements: number | null;
}

async function loadItems(inDir: string): Promise<GalleryItem[]> {
  const entries = await readdir(inDir);
  const resultJsons = entries.filter((f) => f.endsWith('-result.json'));
  const items: GalleryItem[] = [];
  for (const rj of resultJsons) {
    const result = JSON.parse(await readFile(join(inDir, rj), 'utf8')) as {
      uuid: string;
      name: string;
      attachments?: { source: string; type?: string }[];
    };
    const svgRef = (result.attachments ?? []).find(
      (a) => a.type === 'image/svg+xml',
    );
    if (!svgRef) continue;
    const elementMatch = result.name.match(/\((\d+) alignment elements\)/);
    items.push({
      name: result.name,
      uuid: result.uuid,
      svgFile: svgRef.source,
      elements: elementMatch ? Number(elementMatch[1]) : null,
    });
  }
  return items;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHtml(items: GalleryItem[]): string {
  const totalElements = items.reduce((acc, i) => acc + (i.elements ?? 0), 0);
  const cards = items
    .map((item) => `
      <figure>
        <img src="svg/${escapeHtml(item.svgFile)}" alt="${escapeHtml(item.name)}" loading="lazy"/>
        <figcaption>
          <span class="name">${escapeHtml(item.name)}</span>
        </figcaption>
      </figure>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>ProRail Sigma trajectories — rendered with allure-wkt</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #f8fafc; color: #1e293b; }
  header { max-width: 1200px; margin: 0 auto 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .meta { color: #64748b; font-size: 14px; }
  .grid { display: grid; gap: 16px; max-width: 1200px; margin: 0 auto;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
  figure { margin: 0; background: white; border: 1px solid #e2e8f0;
           border-radius: 8px; padding: 12px; }
  figure img { display: block; width: 100%; height: 140px; object-fit: contain;
               background: #fff; }
  figcaption { font-size: 12px; color: #475569; margin-top: 8px;
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .name { font-weight: 500; color: #0f172a; }
  footer { max-width: 1200px; margin: 32px auto 0; color: #64748b; font-size: 12px; }
  footer a { color: inherit; }
</style>
</head>
<body>
  <header>
    <h1>ProRail Sigma alignment trajectories</h1>
    <div class="meta">
      ${items.length.toLocaleString('en-US')} trajectories,
      ${totalElements.toLocaleString('en-US')} alignment elements,
      rendered through <a href="https://github.com/grootstebozewolf/allure-wkt">allure-wkt</a>
      (POINT, LINESTRING, CIRCULARSTRING, COMPOUNDCURVE with CLOTHOID).
    </div>
  </header>
  <main class="grid">
    ${cards}
  </main>
  <footer>
    Source: ProRail Spoorgeometrie open data (CC BY 4.0). Renders generated
    by allure-wkt from analytical alignment elements (Rechtstand /
    Boog / Overgangsboog) -- straights, arcs, and clothoids -- without
    relying on the densified polylines that ship in the source data.
  </footer>
</body>
</html>
`;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let inDir = '';
  let outDir = '';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') inDir = argv[++i];
    else if (argv[i] === '--out') outDir = argv[++i];
  }
  if (!inDir || !outDir) {
    throw new Error('Usage: build-gallery.ts --in <results-dir> --out <gallery-dir>');
  }

  await mkdir(join(outDir, 'svg'), { recursive: true });
  const items = await loadItems(inDir);
  console.error(`[gallery] loading ${items.length} trajectories...`);

  // Copy SVGs into the gallery's own dir so the HTML is self-contained.
  let copied = 0;
  for (const item of items) {
    await copyFile(join(inDir, item.svgFile), join(outDir, 'svg', basename(item.svgFile)));
    copied++;
    if (copied % 500 === 0) {
      process.stderr.write(`\r[gallery] copied ${copied}/${items.length} SVGs...`);
    }
  }
  process.stderr.write('\n');

  // Sort by element count descending -- bigger alignments first read better.
  items.sort((a, b) => (b.elements ?? 0) - (a.elements ?? 0));

  await writeFile(join(outDir, 'index.html'), renderHtml(items), 'utf8');
  console.error(`[gallery] wrote ${join(outDir, 'index.html')} with ${items.length} cards`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
