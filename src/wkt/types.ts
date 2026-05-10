/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Geometry AST produced by the WKT parser. Field names match the
 * GeoJSON convention ({@code type}, {@code coordinates}) so a future
 * "export as GeoJSON" hop is one mapping function away.
 *
 * v1 ships {@link Point} only. Additional kinds (LineString, Polygon,
 * Multi*, GeometryCollection, CIRCULARSTRING, COMPOUNDCURVE, CLOTHOID)
 * extend the {@link Geometry} union without breaking existing callers.
 */

/** A 2-D coordinate. Z and M dimensions arrive in a follow-up. */
export type Coord = readonly [number, number];

export interface Point {
  type: 'Point';
  coordinates: Coord;
}

/** A connected sequence of two or more points (open path). */
export interface LineString {
  type: 'LineString';
  coordinates: readonly Coord[];
}

/**
 * A closed 3-corner ring. Per OGC, the coordinate list has exactly 4
 * coords -- 3 unique corners plus a closing repeat of the first --
 * and the WKT syntax wraps the list in an extra paren pair to mirror
 * POLYGON's outer-ring shape: {@code TRIANGLE ((p1, p2, p3, p1))}.
 * The closing repeat is preserved here so a future POLYGON-with-holes
 * type can share validation; the renderer drops it before emitting
 * to {@code <polygon>} (which auto-closes).
 */
export interface Triangle {
  type: 'Triangle';
  coordinates: readonly Coord[];
}

/**
 * A Triangulated Irregular Network -- a flat surface tiled by triangles
 * sharing edges/vertices. Each triangle is the same 4-coord closed
 * ring shape as {@link Triangle}; the surface is the visual union of
 * all of them. WKT layout: {@code TIN (((p,p,p,p)), ((p,p,p,p)), ...)}.
 */
export interface Tin {
  type: 'Tin';
  triangles: readonly (readonly Coord[])[];
}

/** Discriminated union of every geometry kind the parser can produce. */
export type Geometry = Point | LineString | Triangle | Tin;
