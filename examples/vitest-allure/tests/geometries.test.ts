/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Demo test suite for allure-wkt. Each test attaches a WKT geometry
 * via Allure's standard attachment API; after the run, `allure-wkt`
 * patches the result JSONs to add image/svg+xml siblings so the
 * Allure 3 frontend renders the geometries inline in the test
 * detail view's Attachments tab.
 *
 * Run end-to-end:
 *   npm install
 *   npm run report
 *   npm run open
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { attachment } from 'allure-js-commons';

// The OGC-style vendor MIME for WKT. `attachment()` accepts any string
// content type, stores it verbatim in the result JSON, and our
// preprocessor scans for exactly this MIME.
const WKT_MIME = 'application/vnd.ogc.wkt';

const HERO_WKT = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'hero-shot.wkt'),
  'utf8',
);

describe('allure-wkt: every supported geometry type renders inline', () => {
  test('POINT (10 20) -- simplest possible geometry', async () => {
    const wkt = 'POINT (10 20)';
    await attachment('point.wkt', wkt, WKT_MIME);
    expect(wkt).toMatch(/^POINT/);
  });

  test('LINESTRING -- multi-segment open path', async () => {
    const wkt = 'LINESTRING (0 0, 100 50, 200 0, 300 50)';
    await attachment('linestring.wkt', wkt, WKT_MIME);
    expect(wkt).toMatch(/^LINESTRING/);
  });

  test('TRIANGLE -- closed 3-corner ring with fill', async () => {
    const wkt = 'TRIANGLE ((0 0, 100 0, 50 86.6, 0 0))';
    await attachment('triangle.wkt', wkt, WKT_MIME);
    expect(wkt).toMatch(/^TRIANGLE/);
  });

  test('TIN -- two triangles tiled together', async () => {
    const wkt = 'TIN (((0 0, 100 0, 50 86.6, 0 0)), ((100 0, 150 86.6, 50 86.6, 100 0)))';
    await attachment('tin.wkt', wkt, WKT_MIME);
    expect(wkt).toMatch(/^TIN/);
  });

  test('CIRCULARSTRING -- 5-point chain (two arcs sharing an endpoint)', async () => {
    const wkt = 'CIRCULARSTRING (1 0, 0 1, -1 0, 0 -1, 1 0)';
    await attachment('circularstring.wkt', wkt, WKT_MIME);
    expect(wkt).toMatch(/^CIRCULARSTRING/);
  });

  test('COMPOUNDCURVE with CLOTHOID -- entry-spiral pattern', async () => {
    const wkt = 'COMPOUNDCURVE ((0 0, 100 0), CLOTHOID (0, 0.005, 80))';
    await attachment('compound-with-clothoid.wkt', wkt, WKT_MIME);
    expect(wkt).toMatch(/CLOTHOID/);
  });

  test('Real ProRail rail-bend (track 823_12V_4.3, EPSG:28992)', async () => {
    // The hero shot from the README. Exercises the full curve stack:
    // straight + entry CLOTHOID + R≈200 m CIRCULARSTRING + exit
    // CLOTHOID + straight, all in one COMPOUNDCURVE chain.
    await attachment('rail-bend.wkt', HERO_WKT, WKT_MIME);
    expect(HERO_WKT).toMatch(/COMPOUNDCURVE/);
    expect(HERO_WKT).toMatch(/CIRCULARSTRING/);
    expect(HERO_WKT.match(/CLOTHOID/g) ?? []).toHaveLength(2);
  });
});

describe('allure-wkt: a test can carry both input and output WKT', () => {
  test('Buffer-like example: input ring + output expanded ring', async () => {
    // Imagine a buffer operation. We attach the input geometry and
    // the output geometry side by side; both render inline as SVGs.
    const input = 'TRIANGLE ((0 0, 100 0, 50 86.6, 0 0))';
    const output = 'LINESTRING (-20 -10, 120 -10, 70 96.6, -20 -10)'; // toy "buffered" outline
    await attachment('input.wkt', input, WKT_MIME);
    await attachment('expected-output.wkt', output, WKT_MIME);
    expect(output).toBeTruthy();
  });
});
