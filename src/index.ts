#!/usr/bin/env node
/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * allure-wkt CLI entrypoint
 * 
 * Usage:
 *   npx allure-wkt <allure-results-directory>
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AllureResult, AllureAttachment, WktMatch } from './types.js';

// TODO: import real parser + renderer once implemented
// import { parseWkt } from './wkt/parser.js';
// import { renderToSvg } from './wkt/renderer.js';

const WKT_MIME_CANDIDATES = [
  'application/vnd.ogc.wkt',
  'application/wkt',
  'text/x-wkt',
];

const WKT_EXTENSIONS = ['.wkt'];

function isWktAttachment(att: AllureAttachment): boolean {
  if (att.type && WKT_MIME_CANDIDATES.includes(att.type.toLowerCase())) {
    return true;
  }
  const src = att.source?.toLowerCase() || '';
  const name = att.name?.toLowerCase() || '';
  return WKT_EXTENSIONS.some(ext => src.endsWith(ext) || name.endsWith(ext));
}

async function findWktMatches(resultsDir: string): Promise<WktMatch[]> {
  const matches: WktMatch[] = [];
  const entries = await readdir(resultsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('-result.json')) continue;

    const filePath = join(resultsDir, entry.name);
    const content = await readFile(filePath, 'utf8');
    const result: AllureResult = JSON.parse(content);

    // Check top-level attachments
    if (result.attachments) {
      for (const att of result.attachments) {
        if (isWktAttachment(att)) {
          matches.push({
            attachment: att,
            parent: result,
            filePath,
            attachmentDir: resultsDir,
          });
        }
      }
    }

    // Recursively check steps (v1 supports one level for simplicity)
    if (result.steps) {
      for (const step of result.steps) {
        if (step.attachments) {
          for (const att of step.attachments) {
            if (isWktAttachment(att)) {
              matches.push({
                attachment: att,
                parent: step,
                filePath,
                attachmentDir: resultsDir,
              });
            }
          }
        }
      }
    }
  }

  return matches;
}

async function processWktAttachment(match: WktMatch): Promise<void> {
  const { attachment, attachmentDir, filePath } = match;

  // Resolve the actual attachment file (usually next to the json or in attachments/ subdir)
  let wktContent: string;
  const candidatePaths = [
    join(attachmentDir, attachment.source),
    join(attachmentDir, 'attachments', attachment.source),
  ];

  let found = false;
  for (const p of candidatePaths) {
    try {
      const s = await stat(p);
      if (s.isFile()) {
        wktContent = await readFile(p, 'utf8');
        found = true;
        break;
      }
    } catch {}
  }

  if (!found) {
    console.warn(`[allure-wkt] Could not find attachment file for ${attachment.source} in ${attachmentDir}`);
    return;
  }

  // TODO: real implementation
  // const geom = parseWkt(wktContent.trim());
  // const svg = renderToSvg(geom, { padding: 20, strokeWidth: 2, ... });

  // For now: placeholder SVG so the pipeline works end-to-end
  const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect width="400" height="300" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="200" y="150" text-anchor="middle" fill="#64748b" font-family="system-ui" font-size="16">
    WKT Visualization Placeholder
  </text>
  <text x="200" y="175" text-anchor="middle" fill="#94a3b8" font-family="system-ui" font-size="12">
    (real parser + renderer coming in next iteration)
  </text>
</svg>`;

  const svgUuid = randomUUID();
  const svgSource = `${svgUuid}-attachment.svg`;
  const svgPath = join(attachmentDir, svgSource);

  await writeFile(svgPath, placeholderSvg, 'utf8');

  // Patch the JSON: append new attachment entry to the parent
  const resultContent = await readFile(filePath, 'utf8');
  const result: AllureResult = JSON.parse(resultContent);

  const newAttachment: AllureAttachment = {
    name: 'WKT Visualization',
    source: svgSource,
    type: 'image/svg+xml',
  };

  // Find the correct parent array and append
  if (match.parent === result) {
    result.attachments = result.attachments || [];
    result.attachments.push(newAttachment);
  } else {
    // It's a step - we need to find it again (simple for v1)
    // In real impl we'd keep references or re-walk
    console.warn('[allure-wkt] Step-level attachment patching not fully implemented in skeleton');
  }

  await writeFile(filePath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`[allure-wkt] Created ${svgSource} for ${attachment.source}`);
}

/**
 * Programmatic entry point. Throws on bad input rather than calling
 * process.exit so tests can exercise the full pipeline in-process.
 * Returns the number of WKT attachments processed.
 */
export async function runCli(args: string[]): Promise<number> {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: allure-wkt <allure-results-directory>

Scans the directory for WKT attachments and generates SVG visualizations
that appear natively in the Allure report's Attachments tab.

Example:
  npx allure-wkt ./allure-results
`);
    return 0;
  }

  const resultsDir = args[0];
  const stats = await stat(resultsDir).catch(() => null);
  if (!stats || !stats.isDirectory()) {
    throw new Error(`Cannot access directory ${resultsDir} (or it is not a directory)`);
  }

  console.log(`[allure-wkt] Scanning ${resultsDir} for WKT attachments...`);

  const matches = await findWktMatches(resultsDir);
  console.log(`[allure-wkt] Found ${matches.length} WKT attachment(s)`);

  for (const match of matches) {
    await processWktAttachment(match);
  }

  console.log('[allure-wkt] Done. You can now run `allure generate` or `allure serve`.');
  return matches.length;
}

// Only auto-run when invoked as the script (not when imported by tests).
const isCliEntry =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/index.ts') ||
  process.argv[1]?.endsWith('/index.js');

if (isCliEntry) {
  runCli(process.argv.slice(2)).catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
