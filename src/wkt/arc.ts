/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Circular-arc helpers. Pure functions, no I/O.
 *
 * A CIRCULARSTRING is a chain of arcs: consecutive triples (start, mid,
 * end) define one arc, and adjacent arcs share their end/start point.
 * For a 5-point string {p0, p1, p2, p3, p4}: arc1 = (p0, p1, p2),
 * arc2 = (p2, p3, p4).
 */
import type { Coord } from './types.js';

const DEFAULT_SAMPLES_PER_ARC = 32;
const COLLINEAR_DET_EPS = 1e-12;

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

/** Centre and radius of the circle through three points; null if collinear. */
export function circumcircle(a: Coord, b: Coord, c: Coord): Circle | null {
  const ax = a[0] - c[0];
  const ay = a[1] - c[1];
  const bx = b[0] - c[0];
  const by = b[1] - c[1];
  const d = 2.0 * (ax * by - ay * bx);
  if (Math.abs(d) < COLLINEAR_DET_EPS) return null;
  const ux = ((ax * ax + ay * ay) * by - (bx * bx + by * by) * ay) / d;
  const uy = ((bx * bx + by * by) * ax - (ax * ax + ay * ay) * bx) / d;
  return { cx: c[0] + ux, cy: c[1] + uy, r: Math.hypot(ux, uy) };
}

/**
 * Determine arc orientation and total sweep. The mid point must lie on
 * the arc going from start to end -- whichever direction makes that
 * true is the arc's traversal direction.
 *
 * Returns the world-frame angle range to sweep: starting at {@code a0},
 * going for {@code totalSweep * sweepSign} radians.
 */
function arcSweep(
  a0: number, am: number, a1: number,
): { totalSweep: number; sweepSign: 1 | -1 } {
  // Normalised CCW sweep from a0 to a1, in [0, 2π)
  let ccwSweep = a1 - a0;
  if (ccwSweep < 0) ccwSweep += 2 * Math.PI;
  // Normalised CCW position of mid from a0, in [0, 2π)
  let ccwMid = am - a0;
  if (ccwMid < 0) ccwMid += 2 * Math.PI;
  // If mid is reached before end on a CCW path, the arc is CCW.
  const ccw = ccwMid < ccwSweep;
  return ccw
    ? { totalSweep: ccwSweep, sweepSign: 1 }
    : { totalSweep: 2 * Math.PI - ccwSweep, sweepSign: -1 };
}

/**
 * Densify a single 3-point arc into {@code samples + 1} points. The
 * first sample is {@code start}; the last is {@code end}; the path
 * passes through (or very near) {@code mid}. Falls back to a 3-point
 * polyline if the control points are collinear.
 */
export function densifyArc(
  start: Coord, mid: Coord, end: Coord,
  samples: number = DEFAULT_SAMPLES_PER_ARC,
): Coord[] {
  const circle = circumcircle(start, mid, end);
  if (!circle) {
    return [start, mid, end];
  }
  const { cx, cy, r } = circle;
  const a0 = Math.atan2(start[1] - cy, start[0] - cx);
  const am = Math.atan2(mid[1] - cy, mid[0] - cx);
  const a1 = Math.atan2(end[1] - cy, end[0] - cx);
  const { totalSweep, sweepSign } = arcSweep(a0, am, a1);

  const out: Coord[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const a = a0 + sweepSign * totalSweep * t;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/**
 * Densify a CIRCULARSTRING (chain of arcs sharing endpoints). The
 * output polyline visits every input control point.
 */
export function densifyCircularString(
  controlPoints: readonly Coord[],
  samplesPerArc: number = DEFAULT_SAMPLES_PER_ARC,
): Coord[] {
  if (controlPoints.length < 3 || controlPoints.length % 2 === 0) {
    throw new Error(
      `CIRCULARSTRING must have an odd number of control points, at least 3 (got ${controlPoints.length})`,
    );
  }
  const out: Coord[] = [];
  for (let i = 0; i + 2 < controlPoints.length; i += 2) {
    const arc = densifyArc(
      controlPoints[i], controlPoints[i + 1], controlPoints[i + 2],
      samplesPerArc,
    );
    // First arc contributes from index 0; subsequent arcs skip their
    // first sample (it duplicates the previous arc's end coordinate).
    const start = i === 0 ? 0 : 1;
    for (let j = start; j < arc.length; j++) out.push(arc[j]);
  }
  return out;
}

/**
 * Tangent angle at the END of a single 3-point arc -- perpendicular to
 * the radius at the end point, oriented along the direction of motion.
 * Used by the COMPOUNDCURVE state walker to feed CLOTHOID's start
 * tangent.
 */
export function arcEndTangent(start: Coord, mid: Coord, end: Coord): number {
  const circle = circumcircle(start, mid, end);
  if (!circle) {
    // collinear: tangent = direction of (start → end)
    return Math.atan2(end[1] - start[1], end[0] - start[0]);
  }
  const a0 = Math.atan2(start[1] - circle.cy, start[0] - circle.cx);
  const am = Math.atan2(mid[1] - circle.cy, mid[0] - circle.cx);
  const a1 = Math.atan2(end[1] - circle.cy, end[0] - circle.cx);
  const { sweepSign } = arcSweep(a0, am, a1);
  // Tangent is perpendicular to the radial direction (center→end),
  // rotated +90° for CCW motion or −90° for CW.
  return sweepSign === 1 ? a1 + Math.PI / 2 : a1 - Math.PI / 2;
}

/** Tangent at the END of a multi-arc CIRCULARSTRING (just the last 3 points). */
export function circularStringEndTangent(controlPoints: readonly Coord[]): number {
  const n = controlPoints.length;
  return arcEndTangent(
    controlPoints[n - 3], controlPoints[n - 2], controlPoints[n - 1],
  );
}
