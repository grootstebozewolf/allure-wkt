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

interface PreprocessedDir {
  dir: string;
  resultJsonPath: string;
}

/**
 * Build a temp Allure-results directory containing exactly one WKT
 * attachment, then run the preprocessor against it. Returns paths the
 * scenario uses for assertions. Caller is responsible for {@code rm} on
 * teardown.
 */
async function preprocessOneWkt(wktContent: string): Promise<PreprocessedDir> {
  const dir = await mkdtemp(join(tmpdir(), 'allure-wkt-'));
  const wktSource = 'geometry-attachment.wkt';
  const resultJsonPath = join(dir, 'test-001-result.json');
  await writeFile(join(dir, wktSource), wktContent);
  await writeFile(
    resultJsonPath,
    JSON.stringify({
      uuid: 'test-001',
      name: 'WKT visualization',
      attachments: [
        {
          name: 'geometry',
          source: wktSource,
          type: 'application/vnd.ogc.wkt',
        },
      ],
    } satisfies AllureResult),
  );
  await runCli([dir]);
  return { dir, resultJsonPath };
}

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
    let env: PreprocessedDir;

    before(async () => {
      env = await preprocessOneWkt('POINT (10 20)');
    });
    after(async () => {
      await rm(env.dir, { recursive: true, force: true });
    });

    it('Then a new SVG file exists on disk in the results directory', async () => {
      const svgs = (await readdir(env.dir)).filter((f) => f.endsWith('.svg'));
      assert.equal(svgs.length, 1, `expected exactly one .svg file, got ${svgs.length}`);
    });

    it('And the result JSON now references an image/svg+xml attachment', async () => {
      const ref = await readSvgAttachmentRef(env.resultJsonPath);
      assert.ok(ref, 'expected an image/svg+xml attachment ref in the result JSON');
    });

    it('And the SVG contains a <circle> element representing the POINT', async () => {
      const ref = await readSvgAttachmentRef(env.resultJsonPath);
      assert.ok(ref, 'precondition: an svg attachment must exist');
      const svg = await readFile(join(env.dir, ref.source), 'utf8');
      assert.match(svg, /<circle\b/, 'expected a <circle> element rendering the POINT');
    });
  });

  describe('Scenario: a LINESTRING attachment renders as an SVG <polyline>', () => {
    let env: PreprocessedDir;

    before(async () => {
      env = await preprocessOneWkt('LINESTRING (0 0, 10 5, 20 0, 30 10)');
    });
    after(async () => {
      await rm(env.dir, { recursive: true, force: true });
    });

    it('Then the result JSON references an image/svg+xml attachment', async () => {
      const ref = await readSvgAttachmentRef(env.resultJsonPath);
      assert.ok(ref, 'expected an image/svg+xml attachment ref in the result JSON');
    });

    it('And the SVG contains a <polyline> with all four vertices', async () => {
      const ref = await readSvgAttachmentRef(env.resultJsonPath);
      assert.ok(ref, 'precondition: an svg attachment must exist');
      const svg = await readFile(join(env.dir, ref.source), 'utf8');
      assert.match(
        svg,
        /<polyline\b[^>]*\bpoints="0,0 10,5 20,0 30,10"/,
        'expected a <polyline> with the LINESTRING vertices',
      );
    });
  });

  describe('Scenario: a TRIANGLE attachment renders as an SVG <polygon>', () => {
    let env: PreprocessedDir;

    before(async () => {
      env = await preprocessOneWkt('TRIANGLE ((0 0, 10 0, 5 10, 0 0))');
    });
    after(async () => {
      await rm(env.dir, { recursive: true, force: true });
    });

    it('Then the SVG contains a <polygon> with the three unique corners', async () => {
      const ref = await readSvgAttachmentRef(env.resultJsonPath);
      assert.ok(ref, 'precondition: an svg attachment must exist');
      const svg = await readFile(join(env.dir, ref.source), 'utf8');
      assert.match(
        svg,
        /<polygon\b[^>]*\bpoints="0,0 10,0 5,10"/,
        'expected a <polygon> with the unique TRIANGLE corners',
      );
    });
  });

  describe('Scenario: a COMPOUNDCURVE with a CLOTHOID renders as one continuous SVG <polyline>', () => {
    let env: PreprocessedDir;

    before(async () => {
      env = await preprocessOneWkt(
        'COMPOUNDCURVE ((0 0, 100 0), CLOTHOID (0, 0.005, 48))',
      );
    });
    after(async () => {
      await rm(env.dir, { recursive: true, force: true });
    });

    it('Then the SVG contains exactly one <polyline> for the chain', async () => {
      const ref = await readSvgAttachmentRef(env.resultJsonPath);
      assert.ok(ref, 'precondition: an svg attachment must exist');
      const svg = await readFile(join(env.dir, ref.source), 'utf8');
      const polylines = svg.match(/<polyline\b/g) ?? [];
      assert.equal(polylines.length, 1);
    });
  });

  describe('Scenario: a TIN attachment renders one <polygon> per triangle', () => {
    let env: PreprocessedDir;

    before(async () => {
      env = await preprocessOneWkt(
        'TIN (((0 0, 10 0, 5 10, 0 0)), ((10 0, 10 -5, 5 -5, 10 0)))',
      );
    });
    after(async () => {
      await rm(env.dir, { recursive: true, force: true });
    });

    it('Then the SVG contains exactly two <polygon> elements', async () => {
      const ref = await readSvgAttachmentRef(env.resultJsonPath);
      assert.ok(ref, 'precondition: an svg attachment must exist');
      const svg = await readFile(join(env.dir, ref.source), 'utf8');
      const polygons = svg.match(/<polygon\b/g) ?? [];
      assert.equal(polygons.length, 2);
    });
  });
});
