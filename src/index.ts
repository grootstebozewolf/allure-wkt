#!/usr/bin/env node
/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * allure-wkt CLI shim. The actual pipeline lives in {@link ./preprocess}.
 *
 * Usage:
 *   npx allure-wkt <allure-results-directory>
 */
import { realpathSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { findWktMatches, processMatch } from './preprocess.js';

const LOG_PREFIX = '[allure-wkt]';

const HELP_TEXT = `
Usage: allure-wkt <allure-results-directory>

Scans the directory for WKT attachments and generates SVG visualizations
that appear natively in the Allure report's Attachments tab.

Example:
  npx allure-wkt ./allure-results
`;

/**
 * Programmatic entry point. Throws on bad input rather than calling
 * process.exit so tests can exercise the full pipeline in-process.
 *
 * @returns the number of WKT attachments processed.
 */
export async function runCli(args: string[]): Promise<number> {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    return 0;
  }

  const resultsDir = args[0];
  const info = await stat(resultsDir).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(
      `Cannot access directory ${resultsDir} (or it is not a directory)`,
    );
  }

  console.log(`${LOG_PREFIX} Scanning ${resultsDir} for WKT attachments...`);
  const matches = await findWktMatches(resultsDir);
  console.log(`${LOG_PREFIX} Found ${matches.length} WKT attachment(s)`);

  for (const match of matches) {
    await processMatch(match);
  }

  console.log(
    `${LOG_PREFIX} Done. You can now run \`allure generate\` or \`allure serve\`.`,
  );
  return matches.length;
}

// Auto-run only when this file is the Node entry point. Importing it
// from a test or another module must not trigger main().
//
// Symlink note: when installed from npm, the CLI is invoked through
// `node_modules/.bin/allure-wkt -> ../allure-wkt/dist/index.js`.
// `process.argv[1]` is then the symlink path; `import.meta.url` is
// the resolved target. Realpath-resolve both sides before comparing,
// or the guard fails silently and the script exits without running
// (caught the hard way by dogfooding the published package).
function isCliEntry(): boolean {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    const realArgv = pathToFileURL(realpathSync(argv1)).href;
    const realModule = pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
    return realArgv === realModule;
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  runCli(process.argv.slice(2)).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
