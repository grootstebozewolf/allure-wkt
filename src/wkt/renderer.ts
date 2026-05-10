/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Geometry → SVG renderer. Pure function, zero deps.
 *
 * v1 supports {@link Point} only. The {@link calculateBoundingBox}
 * helper is extracted so it's reusable for LineString / Polygon /
 * Multi* in subsequent commits without re-deriving the same logic.
 *
 * Coordinate convention: WKT/world coords are written into the SVG
 * directly (i.e. {@code <circle cx="x" cy="y"/>}), and the viewBox
 * is computed in world coords. SVG's Y-down vs WKT's Y-up only
 * matters when comparing two coordinates -- for a single point it
 * is visually invisible. Y-flip lands when LineString does and the
 * orientation actually matters.
 */
import type { Coord, Geometry } from './types.js';

const PAD_FRACTION = 0.1;
const PAD_MIN = 10;
const SVG_SIZE = 400;

const POINT_RADIUS = 4;
const POINT_FILL = '#0ea5e9';
const POINT_STROKE = '#0369a1';
const POINT_STROKE_WIDTH = 1;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Min/max bounds in world coordinates. */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Tight bounding box around a coordinate sample. Throws on an empty
 * input -- a geometry without coords has no meaningful bbox; callers
 * must handle empty geometries before reaching here.
 */
export function calculateBoundingBox(coords: readonly Coord[]): BBox {
  if (coords.length === 0) {
    throw new Error('calculateBoundingBox requires at least one coordinate');
  }
  let minX = coords[0][0];
  let maxX = coords[0][0];
  let minY = coords[0][1];
  let maxY = coords[0][1];
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/** Pad a bbox so the rendered geometry has visual breathing room and
 *  so degenerate (zero-extent) bboxes still produce a positive viewBox. */
function padBoundingBox(bbox: BBox): BBox {
  const padX = Math.max((bbox.maxX - bbox.minX) * PAD_FRACTION, PAD_MIN);
  const padY = Math.max((bbox.maxY - bbox.minY) * PAD_FRACTION, PAD_MIN);
  return {
    minX: bbox.minX - padX,
    maxX: bbox.maxX + padX,
    minY: bbox.minY - padY,
    maxY: bbox.maxY + padY,
  };
}

/** Format a number for SVG attribute output -- short, locale-independent,
 *  no trailing decimals on integers. */
function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  // Trim default JS toString output: 0.025, -1500.5, etc. are fine as-is.
  return String(n);
}

/** SVG document for a {@link Point}. */
function renderPoint(coords: Coord): string {
  const bbox = padBoundingBox(calculateBoundingBox([coords]));
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const viewBox = `${fmt(bbox.minX)} ${fmt(bbox.minY)} ${fmt(width)} ${fmt(height)}`;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="${SVG_NS}" viewBox="${viewBox}" width="${SVG_SIZE}" height="${SVG_SIZE}">`,
    `  <circle cx="${fmt(coords[0])}" cy="${fmt(coords[1])}" r="${POINT_RADIUS}" `
      + `fill="${POINT_FILL}" stroke="${POINT_STROKE}" stroke-width="${POINT_STROKE_WIDTH}"/>`,
    `</svg>`,
    '',
  ].join('\n');
}

/**
 * Render a {@link Geometry} as a self-contained SVG document.
 *
 * @throws if the geometry kind is not yet supported by this renderer.
 */
export function renderToSvg(geom: Geometry): string {
  switch (geom.type) {
    case 'Point':
      return renderPoint(geom.coordinates);
    default: {
      // Exhaustiveness guard. As the Geometry union grows, this becomes
      // a TS error if a new case isn't handled here.
      const _exhaustive: never = geom.type;
      throw new Error(`Unsupported geometry type for renderToSvg: ${_exhaustive}`);
    }
  }
}
