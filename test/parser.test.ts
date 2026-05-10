/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Unit tests for the WKT parser. POINT only in v1.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseWkt } from '../src/wkt/parser.js';

describe('parseWkt: POINT happy paths', () => {
  it('parses the canonical POINT (10 20)', () => {
    assert.deepEqual(parseWkt('POINT (10 20)'), {
      type: 'Point',
      coordinates: [10, 20],
    });
  });

  it('accepts no whitespace between the type name and the open paren', () => {
    assert.deepEqual(parseWkt('POINT(10 20)'), {
      type: 'Point',
      coordinates: [10, 20],
    });
  });

  it('is case-insensitive on the type name', () => {
    assert.deepEqual(parseWkt('point (10 20)'), {
      type: 'Point',
      coordinates: [10, 20],
    });
  });

  it('handles negative coordinates', () => {
    assert.deepEqual(parseWkt('POINT (-10 -20.5)'), {
      type: 'Point',
      coordinates: [-10, -20.5],
    });
  });

  it('handles scientific notation in both cases', () => {
    assert.deepEqual(parseWkt('POINT (1.5e3 -2.5E-2)'), {
      type: 'Point',
      coordinates: [1500, -0.025],
    });
  });

  it('tolerates surrounding and inner whitespace', () => {
    assert.deepEqual(parseWkt('  POINT  (  10   20  )  '), {
      type: 'Point',
      coordinates: [10, 20],
    });
  });
});

describe('parseWkt: error paths', () => {
  it('throws on unsupported geometry types', () => {
    assert.throws(
      () => parseWkt('LINESTRING (0 0, 1 1)'),
      /Unsupported WKT geometry.*LINESTRING/,
    );
  });

  it('throws when a coordinate is missing', () => {
    assert.throws(() => parseWkt('POINT (10)'));
  });

  it('throws when a coordinate is non-numeric', () => {
    assert.throws(() => parseWkt('POINT (10 foo)'), /Expected number/);
  });

  it('throws on trailing tokens after the geometry', () => {
    assert.throws(
      () => parseWkt('POINT (10 20) extra'),
      /Unexpected token.*extra/,
    );
  });
});
