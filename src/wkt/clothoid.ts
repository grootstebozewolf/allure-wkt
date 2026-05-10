/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Clothoid (Euler / Cornu spiral) integrator. Pure function, no I/O.
 *
 * Heading function:  θ(s) = θ₀ + κ₀·s + ½·(κ₁ − κ₀)/L · s²
 * Position:          (x(s), y(s)) = (x₀, y₀) + ∫₀ˢ (cos θ, sin θ) dt
 *
 * Composite Simpson's rule per panel of width ds = L/N. Worst-case
 * total error ≈ L⁵·max|f''''| / (2880·N⁴). For typical engineering
 * curvatures (κ ~ 0.001..0.05 1/m) and N >= 64 the position error is
 * sub-millimetre.
 *
 * Port of the Simpson integrator in the JTS reference implementation
 * ({@code ClothoidSegment.java} in the JTS playground branch).
 */
import type { Coord } from './types.js';

export interface ClothoidStartState {
  /** World x of the spiral's start. */
  startX: number;
  /** World y of the spiral's start. */
  startY: number;
  /** Heading at s = 0, in radians, world Y-up. */
  startTangent: number;
}

export interface ClothoidParams {
  startKappa: number;
  endKappa: number;
  length: number;
}

const DEFAULT_SAMPLES = 64;

/**
 * Densify a clothoid into an evenly-spaced polyline of {@code samples + 1}
 * points. The first sample is the start point; the last is the
 * analytical end point at {@code s = L}.
 */
export function densifyClothoid(
  state: ClothoidStartState,
  params: ClothoidParams,
  samples: number = DEFAULT_SAMPLES,
): Coord[] {
  const { startX, startY, startTangent: theta0 } = state;
  const { startKappa: k0, endKappa: k1, length: L } = params;
  const out: Coord[] = [[startX, startY]];
  let x = startX;
  let y = startY;
  const ds = L / samples;
  // θ(s) = θ₀ + κ₀·s + halfSlope · s², where halfSlope = (κ₁−κ₀) / (2L)
  const halfSlope = (k1 - k0) / (2 * L);
  for (let i = 1; i <= samples; i++) {
    const s0 = (i - 1) * ds;
    const sM = (i - 0.5) * ds;
    const s1 = i * ds;
    const t0 = theta0 + k0 * s0 + halfSlope * s0 * s0;
    const tM = theta0 + k0 * sM + halfSlope * sM * sM;
    const t1 = theta0 + k0 * s1 + halfSlope * s1 * s1;
    x += (ds / 6) * (Math.cos(t0) + 4 * Math.cos(tM) + Math.cos(t1));
    y += (ds / 6) * (Math.sin(t0) + 4 * Math.sin(tM) + Math.sin(t1));
    out.push([x, y]);
  }
  return out;
}

/**
 * Heading at the end of a clothoid:
 * {@code θ(L) = θ₀ + ½·(κ₀ + κ₁)·L} (closed form -- the average curvature
 * times length, which is the integral of a linear-in-s κ over [0, L]).
 */
export function clothoidEndTangent(
  state: ClothoidStartState,
  params: ClothoidParams,
): number {
  return (
    state.startTangent
    + 0.5 * (params.startKappa + params.endKappa) * params.length
  );
}
