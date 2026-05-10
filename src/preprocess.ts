/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Pipeline: scan an allure-results directory, locate WKT attachments,
 * render each to SVG, patch the surrounding result JSON so the SVG
 * appears as a first-class attachment in the Allure report.
 *
 * Two seams are deliberately marked in this file -- `renderPlaceholder`
 * (the rendering wedge) and `attachSvgRef` (the patching wedge). The
 * real WKT parser + SVG renderer replace renderPlaceholder; nothing
 * else needs to move.
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
  AllureAttachment,
  AllureResult,
  AllureStep,
  WktMatch,
} from './types.js';

const LOG_PREFIX = '[allure-wkt]';
const RESULT_FILE_SUFFIX = '-result.json';
const ATTACHMENT_SUBDIR = 'attachments';
const SVG_MIME = 'image/svg+xml';

const WKT_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/vnd.ogc.wkt',
  'application/wkt',
  'text/x-wkt',
]);

const WKT_EXTENSIONS: readonly string[] = ['.wkt'];

// ---------------------------------------------------------------------------
// detect

/** True iff this attachment carries a WKT geometry, by MIME or extension. */
export function isWktAttachment(att: AllureAttachment): boolean {
  if (att.type && WKT_MIME_TYPES.has(att.type.toLowerCase())) {
    return true;
  }
  const lowerSource = att.source.toLowerCase();
  const lowerName = att.name.toLowerCase();
  return WKT_EXTENSIONS.some(
    (ext) => lowerSource.endsWith(ext) || lowerName.endsWith(ext),
  );
}

// ---------------------------------------------------------------------------
// discover

/**
 * Yields every (parent, attachments) pair inside a result tree, so callers
 * can iterate without duplicating the top-level vs step distinction.
 *
 * v1 walks one level of steps (matches what we observed in the wild for
 * geometry-emitting test frameworks). Deep step nesting is a follow-up.
 */
function* attachmentSites(
  result: AllureResult,
): Generator<{ parent: AllureResult | AllureStep; atts: AllureAttachment[] }> {
  if (result.attachments?.length) {
    yield { parent: result, atts: result.attachments };
  }
  for (const step of result.steps ?? []) {
    if (step.attachments?.length) {
      yield { parent: step, atts: step.attachments };
    }
  }
}

/**
 * Walk every {@code *-result.json} in {@code resultsDir}, returning a flat
 * list of matches each pointing back at the in-memory parent + root so
 * the processing stage can mutate-and-serialise without re-reading.
 */
export async function findWktMatches(resultsDir: string): Promise<WktMatch[]> {
  const matches: WktMatch[] = [];
  const entries = await readdir(resultsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(RESULT_FILE_SUFFIX)) {
      continue;
    }
    const filePath = join(resultsDir, entry.name);
    const root: AllureResult = JSON.parse(await readFile(filePath, 'utf8'));

    for (const { parent, atts } of attachmentSites(root)) {
      for (const attachment of atts) {
        if (isWktAttachment(attachment)) {
          matches.push({
            attachment,
            parent,
            root,
            filePath,
            attachmentDir: resultsDir,
          });
        }
      }
    }
  }

  return matches;
}

// ---------------------------------------------------------------------------
// process

/** Resolve the on-disk file backing an attachment ref. Allure layouts have
 *  it either next to the result JSON or under an {@code attachments/}
 *  subdirectory; we accept both. */
async function readAttachmentSource(
  attachmentDir: string,
  source: string,
): Promise<string | undefined> {
  const candidates = [
    join(attachmentDir, source),
    join(attachmentDir, ATTACHMENT_SUBDIR, source),
  ];
  for (const candidate of candidates) {
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile()) {
      return readFile(candidate, 'utf8');
    }
  }
  return undefined;
}

/**
 * === SEAM: render ===
 *
 * Hardcoded placeholder SVG with a single {@code <circle>} so the contract
 * test pins the expected shape. The real renderer plugs in here:
 *
 * <pre>
 *   const geom = parseWkt(wktContent.trim());
 *   const svg  = renderToSvg(geom, options);
 * </pre>
 *
 * Nothing outside this function needs to move when the wedge is replaced.
 */
function renderPlaceholder(_wktContent: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect width="400" height="300" fill="#f8fafc" stroke="#e2e8f0"/>
  <circle cx="200" cy="150" r="6" fill="#0ea5e9" stroke="#0369a1" stroke-width="1"/>
  <text x="200" y="180" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="12">
    WKT Visualization (placeholder renderer)
  </text>
</svg>`;
}

/**
 * === SEAM: patch ===
 *
 * Append a new {@code image/svg+xml} attachment ref to the WKT's parent
 * (a top-level result or a step) and serialise the root once. Mutates
 * {@code match} in place so a second WKT under the same root is observed
 * by a subsequent call.
 */
async function attachSvgRef(match: WktMatch, svgSource: string): Promise<void> {
  const ref: AllureAttachment = {
    name: 'WKT Visualization',
    source: svgSource,
    type: SVG_MIME,
  };
  match.parent.attachments ??= [];
  match.parent.attachments.push(ref);
  await writeFile(match.filePath, JSON.stringify(match.root, null, 2), 'utf8');
}

/** Render one WKT attachment to SVG and link it next to the original. */
export async function processMatch(match: WktMatch): Promise<void> {
  const wktContent = await readAttachmentSource(
    match.attachmentDir,
    match.attachment.source,
  );
  if (wktContent === undefined) {
    console.warn(
      `${LOG_PREFIX} Could not find attachment file for ${match.attachment.source} in ${match.attachmentDir}`,
    );
    return;
  }

  const svgSource = `${randomUUID()}-attachment.svg`;
  await writeFile(
    join(match.attachmentDir, svgSource),
    renderPlaceholder(wktContent),
    'utf8',
  );
  await attachSvgRef(match, svgSource);

  console.log(
    `${LOG_PREFIX} Created ${svgSource} for ${match.attachment.source}`,
  );
}
