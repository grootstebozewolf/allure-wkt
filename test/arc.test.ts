/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Pure-math tests for the circular-arc helpers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  arcEndTangent,
  circularStringEndTangent,
  circumcircle,
  densifyArc,
  densifyCircularString,
} from '../src/wkt/arc.js';

describe('circumcircle', () => {
  it('finds the unit circle through three points on it', () => {
    const c = circumcircle([1, 0], [0, 1], [-1, 0]);
    assert.ok(c, 'expected a circle for non-collinear points');
    assert.ok(Math.abs(c.cx) < 1e-9);
    assert.ok(Math.abs(c.cy) < 1e-9);
    assert.ok(Math.abs(c.r - 1) < 1e-9);
  });

  it('returns null for collinear points', () => {
    assert.equal(circumcircle([0, 0], [1, 0], [2, 0]), null);
  });
});

describe('densifyArc', () => {
  it('starts at start and ends at end', () => {
    const samples = densifyArc([1, 0], [0, 1], [-1, 0], 32);
    assert.deepEqual(samples[0], [1, 0]);
    const last = samples[samples.length - 1];
    assert.ok(Math.abs(last[0] - -1) < 1e-9);
    assert.ok(Math.abs(last[1] - 0) < 1e-9);
  });

  it('places every sample on the circle', () => {
    const samples = densifyArc([1, 0], [0, 1], [-1, 0], 32);
    for (const [x, y] of samples) {
      assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9);
    }
  });

  it('passes through (or very near) the mid control point', () => {
    const samples = densifyArc([1, 0], [0, 1], [-1, 0], 32);
    // The midpoint of the sample list should be at the arc's apex (~ (0, 1))
    const mid = samples[samples.length >> 1];
    assert.ok(Math.abs(mid[0]) < 1e-9);
    assert.ok(Math.abs(mid[1] - 1) < 1e-9);
  });

  it('chooses CW vs CCW based on which side the mid lies', () => {
    // Same start/end, opposite mid: arc should curve the OTHER way.
    const ccw = densifyArc([1, 0], [0, 1], [-1, 0], 16);
    const cw = densifyArc([1, 0], [0, -1], [-1, 0], 16);
    const ccwMid = ccw[8][1]; // y of the midpoint sample
    const cwMid = cw[8][1];
    assert.ok(ccwMid > 0, `CCW arc mid y must be > 0, got ${ccwMid}`);
    assert.ok(cwMid < 0, `CW arc mid y must be < 0, got ${cwMid}`);
  });
});

describe('densifyCircularString', () => {
  it('densifies a 5-point chain visiting every control point', () => {
    const cps = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 0]] as const;
    const samples = densifyCircularString(cps);
    assert.deepEqual(samples[0], [1, 0]);
    const last = samples[samples.length - 1];
    assert.ok(Math.abs(last[0] - 1) < 1e-9);
    assert.ok(Math.abs(last[1]) < 1e-9);
    // Every sample on the unit circle
    for (const [x, y] of samples) {
      assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-9);
    }
  });

  it('throws on an even-count control list', () => {
    assert.throws(
      () => densifyCircularString([[0, 0], [1, 1]]),
      /odd number of control points/,
    );
  });
});

describe('arcEndTangent / circularStringEndTangent', () => {
  it('CCW upper-half arc ends with tangent pointing in -y direction', () => {
    // (1,0) → (0,1) → (-1,0): CCW upper-half. At (-1, 0) the next CCW
    // step heads toward (0, -1), so the tangent direction is -y, angle
    // ≡ 3π/2 (or equivalently -π/2).
    const theta = arcEndTangent([1, 0], [0, 1], [-1, 0]);
    assert.ok(Math.abs(theta - (3 * Math.PI) / 2) < 1e-9, `θ = ${theta}`);
  });

  it('uses the last 3 control points for a multi-arc chain', () => {
    // The last 3 points of (1,0)(0,1)(-1,0)(0,-1)(1,0) are (-1,0)(0,-1)(1,0).
    // That arc CCW from -π through -π/2 to 0 — ends moving in the +y direction.
    const theta = circularStringEndTangent([
      [1, 0], [0, 1], [-1, 0], [0, -1], [1, 0],
    ]);
    assert.ok(Math.abs(theta - Math.PI / 2) < 1e-9, `θ = ${theta}`);
  });
});
