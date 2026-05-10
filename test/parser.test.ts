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

describe('parseWkt: LINESTRING happy paths', () => {
  it('parses a 2-point LINESTRING', () => {
    assert.deepEqual(parseWkt('LINESTRING (0 0, 10 5)'), {
      type: 'LineString',
      coordinates: [[0, 0], [10, 5]],
    });
  });

  it('parses a multi-segment LINESTRING', () => {
    assert.deepEqual(parseWkt('LINESTRING (0 0, 10 5, 20 0, 30 10)'), {
      type: 'LineString',
      coordinates: [[0, 0], [10, 5], [20, 0], [30, 10]],
    });
  });

  it('tolerates whitespace and case variation', () => {
    assert.deepEqual(parseWkt(' linestring( 0 0 ,  10  5 ) '), {
      type: 'LineString',
      coordinates: [[0, 0], [10, 5]],
    });
  });
});

describe('parseWkt: TRIANGLE happy paths', () => {
  it('parses the canonical TRIANGLE', () => {
    assert.deepEqual(parseWkt('TRIANGLE ((0 0, 1 0, 0 1, 0 0))'), {
      type: 'Triangle',
      coordinates: [[0, 0], [1, 0], [0, 1], [0, 0]],
    });
  });

  it('handles negative and decimal coordinates', () => {
    assert.deepEqual(parseWkt('TRIANGLE ((-1 -1, 2.5 0, 0 3.5, -1 -1))'), {
      type: 'Triangle',
      coordinates: [[-1, -1], [2.5, 0], [0, 3.5], [-1, -1]],
    });
  });
});

describe('parseWkt: TIN happy paths', () => {
  it('parses a single-triangle TIN', () => {
    assert.deepEqual(parseWkt('TIN (((0 0, 1 0, 0 1, 0 0)))'), {
      type: 'Tin',
      triangles: [[[0, 0], [1, 0], [0, 1], [0, 0]]],
    });
  });

  it('parses a multi-triangle TIN', () => {
    assert.deepEqual(
      parseWkt('TIN (((0 0, 1 0, 0 1, 0 0)), ((1 0, 1 1, 0 1, 1 0)))'),
      {
        type: 'Tin',
        triangles: [
          [[0, 0], [1, 0], [0, 1], [0, 0]],
          [[1, 0], [1, 1], [0, 1], [1, 0]],
        ],
      },
    );
  });
});

describe('parseWkt: CIRCULARSTRING', () => {
  it('parses a 3-point arc', () => {
    assert.deepEqual(parseWkt('CIRCULARSTRING (1 0, 0 1, -1 0)'), {
      type: 'CircularString',
      coordinates: [[1, 0], [0, 1], [-1, 0]],
    });
  });

  it('parses a 5-point chain (2 arcs sharing a junction)', () => {
    assert.deepEqual(parseWkt('CIRCULARSTRING (1 0, 0 1, -1 0, 0 -1, 1 0)'), {
      type: 'CircularString',
      coordinates: [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 0]],
    });
  });
});

describe('parseWkt: COMPOUNDCURVE', () => {
  it('parses a chain of LINESTRING + CLOTHOID + CIRCULARSTRING', () => {
    const result = parseWkt(
      'COMPOUNDCURVE ((0 0, 100 0), CLOTHOID (0, 0.005, 80), CIRCULARSTRING (180 1, 200 5, 215 25))',
    );
    assert.equal(result.type, 'CompoundCurve');
    if (result.type !== 'CompoundCurve') return;
    assert.equal(result.members.length, 3);
    assert.equal(result.members[0].type, 'LineString');
    assert.equal(result.members[1].type, 'Clothoid');
    assert.equal(result.members[2].type, 'CircularString');
    if (result.members[1].type === 'Clothoid') {
      assert.equal(result.members[1].startKappa, 0);
      assert.equal(result.members[1].endKappa, 0.005);
      assert.equal(result.members[1].length, 80);
    }
  });
});

describe('parseWkt: error paths', () => {
  it('throws on unsupported geometry types', () => {
    assert.throws(
      () => parseWkt('POLYGON ((0 0, 1 0, 1 1, 0 0))'),
      /Unsupported WKT geometry.*POLYGON/,
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

  it('throws on a single-point LINESTRING', () => {
    assert.throws(
      () => parseWkt('LINESTRING (0 0)'),
      /LINESTRING must have at least 2 points/,
    );
  });

  it('throws on a TRIANGLE with the wrong coord count', () => {
    assert.throws(
      () => parseWkt('TRIANGLE ((0 0, 1 0, 0 1))'),
      /TRIANGLE body must have exactly 4 coordinates/,
    );
  });

  it('throws on a TRIANGLE that is not closed', () => {
    assert.throws(
      () => parseWkt('TRIANGLE ((0 0, 1 0, 0 1, 9 9))'),
      /first and last coordinates must be equal/,
    );
  });

  it('throws on a TIN whose triangle body is malformed', () => {
    assert.throws(
      () => parseWkt('TIN (((0 0, 1 0, 0 1)))'),
      /TRIANGLE body must have exactly 4 coordinates/,
    );
  });

  it('throws on an even-count CIRCULARSTRING', () => {
    assert.throws(
      () => parseWkt('CIRCULARSTRING (0 0, 1 0, 1 1, 0 0)'),
      /odd number of points/,
    );
  });

  it('rejects standalone CLOTHOID', () => {
    assert.throws(
      () => parseWkt('CLOTHOID (0, 0.005, 80)'),
      /CLOTHOID is only valid inside COMPOUNDCURVE/,
    );
  });

  it('rejects CLOTHOID as the first member of a COMPOUNDCURVE', () => {
    assert.throws(
      () => parseWkt('COMPOUNDCURVE (CLOTHOID (0, 0.005, 80), (1 1, 2 2))'),
      /may not be the first member of a COMPOUNDCURVE/,
    );
  });

  it('rejects a CLOTHOID with equal start/end curvatures', () => {
    assert.throws(
      () => parseWkt('COMPOUNDCURVE ((0 0, 1 0), CLOTHOID (0, 0, 50))'),
      /startKappa must differ from endKappa/,
    );
  });

  it('rejects a CLOTHOID with non-positive length', () => {
    assert.throws(
      () => parseWkt('COMPOUNDCURVE ((0 0, 1 0), CLOTHOID (0, 0.005, -5))'),
      /length must be positive/,
    );
  });
});
