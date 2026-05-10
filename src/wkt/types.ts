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

/** Discriminated union of every geometry kind the parser can produce. */
export type Geometry = Point;
