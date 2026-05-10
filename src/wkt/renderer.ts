/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Geometry → SVG renderer. Pure function, zero deps.
 *
 * v1 supports {@link Point}, {@link LineString}, and {@link Triangle}.
 * Additional kinds layer in via new cases in {@link renderToSvg}.
 *
 * Coordinate convention: WKT/world coords are written into the SVG
 * directly ({@code <circle cx="x" cy="y"/>}, {@code points="x,y x,y"}).
 * The viewBox is in world coords too. SVG natively renders Y-down,
 * but a {@code <g transform="translate(0, minY+maxY) scale(1, -1)">}
 * wrapper flips world Y-up content into the viewport so a LINESTRING
 * heading "up" in WKT actually renders heading up. The flip pivots
 * around the bbox horizontal centerline so a single POINT stays
 * positionally invariant.
 */
import type { Coord, Geometry } from './types.js';

const PAD_FRACTION = 0.1;
const PAD_MIN = 10;
const SVG_SIZE = 400;
const SVG_NS = 'http://www.w3.org/2000/svg';

const POINT_RADIUS = 4;
const POINT_FILL = '#0ea5e9';
const POINT_STROKE = '#0369a1';
const POINT_STROKE_WIDTH = 1;

const LINE_STROKE = '#0ea5e9';
const LINE_STROKE_WIDTH = 2;

const POLYGON_FILL = 'rgba(14, 165, 233, 0.25)';
const POLYGON_STROKE = '#0369a1';
const POLYGON_STROKE_WIDTH = 2;

/** Min/max bounds in world coordinates. */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Tight bounding box around a coordinate sample. Throws on empty input
 * -- a geometry without coords has no meaningful bbox; callers must
 * handle empty geometries before reaching here.
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

/** Format a number for SVG attribute output. {@code String(n)} already
 *  handles both integers ("1500") and decimals ("-0.025") cleanly for
 *  our inputs; the named helper exists as a single seam if a future
 *  formatting policy (e.g. fixed precision, scientific cutoff) is needed. */
function fmt(n: number): string {
  return String(n);
}

/** "x1,y1 x2,y2 ..." -- the format used by SVG <polyline> and <polygon>. */
function pointsAttr(coords: readonly Coord[]): string {
  return coords.map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');
}

/**
 * Wrap a geometry-specific SVG fragment in a Y-flipped {@code <svg>}
 * document. The fragment author writes world coords; the wrapper
 * handles document framing and Y-up→Y-down conversion.
 */
function buildSvg(rawBbox: BBox, innerSvg: string): string {
  const bbox = padBoundingBox(rawBbox);
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  const viewBox = `${fmt(bbox.minX)} ${fmt(bbox.minY)} ${fmt(width)} ${fmt(height)}`;
  const flipOffset = bbox.minY + bbox.maxY;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="${SVG_NS}" viewBox="${viewBox}" width="${SVG_SIZE}" height="${SVG_SIZE}">`,
    `  <g transform="translate(0, ${fmt(flipOffset)}) scale(1, -1)">`,
    `    ${innerSvg}`,
    `  </g>`,
    `</svg>`,
    '',
  ].join('\n');
}

function renderPoint(coords: Coord): string {
  const inner =
    `<circle cx="${fmt(coords[0])}" cy="${fmt(coords[1])}" r="${POINT_RADIUS}" `
    + `fill="${POINT_FILL}" stroke="${POINT_STROKE}" stroke-width="${POINT_STROKE_WIDTH}"/>`;
  return buildSvg(calculateBoundingBox([coords]), inner);
}

function renderLineString(coords: readonly Coord[]): string {
  const inner =
    `<polyline points="${pointsAttr(coords)}" fill="none" `
    + `stroke="${LINE_STROKE}" stroke-width="${LINE_STROKE_WIDTH}" `
    + `stroke-linejoin="round" stroke-linecap="round"/>`;
  return buildSvg(calculateBoundingBox(coords), inner);
}

/** One {@code <polygon>} element for a closed-ring coord list. SVG
 *  {@code <polygon>} auto-closes, so the closing-repeat coord is dropped. */
function polygonElement(closedRing: readonly Coord[]): string {
  const open = closedRing.slice(0, -1);
  return (
    `<polygon points="${pointsAttr(open)}" `
    + `fill="${POLYGON_FILL}" stroke="${POLYGON_STROKE}" `
    + `stroke-width="${POLYGON_STROKE_WIDTH}" stroke-linejoin="round"/>`
  );
}

function renderTriangle(coords: readonly Coord[]): string {
  return buildSvg(calculateBoundingBox(coords), polygonElement(coords));
}

function renderTin(triangles: readonly (readonly Coord[])[]): string {
  // Single bbox over every vertex of every triangle so the viewBox
  // brackets the full surface; one <polygon> per triangle inside the
  // shared Y-flip group.
  const allCoords: Coord[] = [];
  for (const tri of triangles) {
    for (const coord of tri) {
      allCoords.push(coord);
    }
  }
  const inner = triangles.map(polygonElement).join('\n    ');
  return buildSvg(calculateBoundingBox(allCoords), inner);
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
    case 'LineString':
      return renderLineString(geom.coordinates);
    case 'Triangle':
      return renderTriangle(geom.coordinates);
    case 'Tin':
      return renderTin(geom.triangles);
    default: {
      // Exhaustiveness guard. As the Geometry union grows, this becomes
      // a TS error if a new case isn't handled here.
      const _exhaustive: never = geom;
      throw new Error(
        `Unsupported geometry type for renderToSvg: ${(_exhaustive as Geometry).type}`,
      );
    }
  }
}
