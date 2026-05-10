/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Pure-math tests for the clothoid Simpson integrator. These pin the
 * numerical contract independently of the WKT pipeline.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { clothoidEndTangent, densifyClothoid } from '../src/wkt/clothoid.js';

describe('densifyClothoid', () => {
  it('returns N + 1 samples and starts at the start point', () => {
    const samples = densifyClothoid(
      { startX: 100, startY: 200, startTangent: 0 },
      { startKappa: 0, endKappa: 0.005, length: 48 },
      32,
    );
    assert.equal(samples.length, 33);
    assert.deepEqual(samples[0], [100, 200]);
  });

  it('matches the JTS reference end point for an entry spiral (κ:0→0.005, L=48)', () => {
    // Reference values from the JTS Simpson integrator on the playground
    // branch: end ≈ (47.93092606468..., 1.91802604747...)
    const samples = densifyClothoid(
      { startX: 0, startY: 0, startTangent: 0 },
      { startKappa: 0, endKappa: 0.005, length: 48 },
      256,
    );
    const end = samples[samples.length - 1];
    assert.ok(Math.abs(end[0] - 47.930926) < 1e-3, `x = ${end[0]}`);
    assert.ok(Math.abs(end[1] - 1.918026) < 1e-3, `y = ${end[1]}`);
  });

  it('respects a non-zero start tangent (rotation is rigid)', () => {
    // A pure rotation by π/2 should swap (x, y) into (-y, x) at every
    // sample relative to the same spiral with startTangent = 0.
    const flat = densifyClothoid(
      { startX: 0, startY: 0, startTangent: 0 },
      { startKappa: 0, endKappa: 0.001, length: 50 },
      64,
    );
    const rotated = densifyClothoid(
      { startX: 0, startY: 0, startTangent: Math.PI / 2 },
      { startKappa: 0, endKappa: 0.001, length: 50 },
      64,
    );
    const lastFlat = flat[flat.length - 1];
    const lastRot = rotated[rotated.length - 1];
    assert.ok(Math.abs(lastRot[0] - -lastFlat[1]) < 1e-9);
    assert.ok(Math.abs(lastRot[1] - lastFlat[0]) < 1e-9);
  });
});

describe('clothoidEndTangent', () => {
  it('θ_end = θ₀ + ½(κ₀+κ₁)·L (closed form)', () => {
    const theta = clothoidEndTangent(
      { startX: 0, startY: 0, startTangent: 0.5 },
      { startKappa: 0, endKappa: 0.005, length: 48 },
    );
    // 0.5 + 0.5 * 0.005 * 48 = 0.5 + 0.12 = 0.62
    assert.ok(Math.abs(theta - 0.62) < 1e-12);
  });
});
