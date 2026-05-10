# CLOTHOID_PROPOSAL.md

## Planned curve geometry support

### v1.1 — CIRCULARSTRING + COMPOUNDCURVE

- TS port of a densifier / arc approximator (similar to JTS CircularArc or CircularArcDensifier).
- Render circular arcs either as SVG arc commands (`A`) when possible or as dense polylines with adaptive sampling.
- Support COMPOUNDCURVE as sequence of LineString + CircularString segments.

### v1.2 — CLOTHOID (Euler spiral / clothoid)

- Direct port of the Simpson-rule integrator from JTS `ClothoidSegment.java` (or equivalent high-accuracy clothoid code).
- Parameters: start point, start tangent angle, curvature rate (or A parameter), length.
- Sampling strategy: curvature-adaptive or fixed small steps, then rendered as polyline.
- Optional: cubic Bézier approximation for smoother SVG paths.

See the original JTS implementation and the test cases in the Allure test suite for expected visual fidelity.

This document exists so the v1 parser/renderer can be written with clear extension points for these types without blocking the initial release.
