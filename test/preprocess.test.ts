/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * BDD-style scenarios for the preprocessor pipeline. Names preserve the
 * Gherkin Feature / Scenario / Given-When-Then intent in describe/it
 * strings so the file reads as a behavioural spec.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runCli } from '../src/index.js';
import type { AllureAttachment, AllureResult } from '../src/types.js';

const SVG_MIME = 'image/svg+xml';

/** Read the result JSON and return the {@code image/svg+xml} attachment ref
 *  the preprocessor should have appended (or undefined if it didn't). */
async function readSvgAttachmentRef(
  resultJsonPath: string,
): Promise<AllureAttachment | undefined> {
  const result = JSON.parse(
    await readFile(resultJsonPath, 'utf8'),
  ) as AllureResult;
  return (result.attachments ?? []).find((a) => a.type === SVG_MIME);
}

describe('Feature: WKT attachments become SVG attachments in Allure results', () => {
  describe('Scenario: a POINT (10 20) attachment renders as an SVG sibling', () => {
    const wktSource = 'abc123-attachment.wkt';
    const resultJsonName = 'test-001-result.json';
    let resultsDir: string;
    let resultJsonPath: string;

    before(async () => {
      resultsDir = await mkdtemp(join(tmpdir(), 'allure-wkt-'));
      resultJsonPath = join(resultsDir, resultJsonName);

      // Given: an Allure result with a POINT WKT attachment
      await writeFile(join(resultsDir, wktSource), 'POINT (10 20)');
      await writeFile(
        resultJsonPath,
        JSON.stringify({
          uuid: 'test-001',
          name: 'renders a point',
          attachments: [
            {
              name: 'geometry',
              source: wktSource,
              type: 'application/vnd.ogc.wkt',
            },
          ],
        } satisfies AllureResult),
      );

      // When: I run the preprocessor on that directory
      await runCli([resultsDir]);
    });

    after(async () => {
      await rm(resultsDir, { recursive: true, force: true });
    });

    it('Then a new SVG file exists on disk in the results directory', async () => {
      const svgs = (await readdir(resultsDir)).filter((f) =>
        f.endsWith('.svg'),
      );
      assert.equal(
        svgs.length,
        1,
        `expected exactly one .svg file, got ${svgs.length}`,
      );
    });

    it('And the result JSON now references an image/svg+xml attachment', async () => {
      const ref = await readSvgAttachmentRef(resultJsonPath);
      assert.ok(ref, 'expected an image/svg+xml attachment ref in the result JSON');
    });

    it('And the SVG contains a <circle> element representing the POINT', async () => {
      const ref = await readSvgAttachmentRef(resultJsonPath);
      assert.ok(ref, 'precondition: an svg attachment must exist');
      const svg = await readFile(join(resultsDir, ref.source), 'utf8');
      assert.match(svg, /<circle\b/, 'expected a <circle> element rendering the POINT');
    });
  });
});
