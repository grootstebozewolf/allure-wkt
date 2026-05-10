# examples/prorail

Stretch goal: feed `allure-wkt` the **entire ProRail Sigma alignment dataset** —
~122k analytical track-element records grouped into ~6.9k trajectories, every one
rendered through the same parser/renderer that handles our hand-written WKT.

## Source data

[ProRail Spoorgeometrie](https://maps.prorail.nl/arcgis/rest/services/Spoorgeometrie/FeatureServer/11),
public ArcGIS REST FeatureServer, Layer 11 = `PVS_Horizontale_Elementen`.
CC BY 4.0. Each feature is one analytical alignment element:

| `ELEMENT_TYPE`    | Meaning            | We map to                                 |
|-------------------|--------------------|-------------------------------------------|
| `Rechtstand`      | Straight           | `(x1 y1, x2 y2)`                          |
| `Boog`            | Circular arc       | `CIRCULARSTRING (start, mid, end)`        |
| `Overgangsboog`   | Clothoid easement  | `CLOTHOID (κ₀, κ₁, L)` (κ = ±1/R, sign from `ROTATIE_*`) |

Elements with the same `SIGMATRAJECT_GUID`, sorted by `VOLGNUMMER`, become one
`COMPOUNDCURVE` per trajectory.

## Reproduce

### One trajectory (≈ 50 KB SVG, ~120 elements)

```sh
npx tsx examples/prorail/fetch-and-convert.ts \
    --guid 510603bc-fef6-4d29-9a01-2bad891057ca \
    --out /tmp/prorail-hero
npx tsx src/index.ts /tmp/prorail-hero
# → /tmp/prorail-hero/<uuid>-attachment.svg
```

### Entire dataset (~122k elements, ~6.9k trajectories, ~minutes)

```sh
npx tsx examples/prorail/fetch-and-convert.ts --all --out /tmp/prorail-all
npx tsx src/index.ts /tmp/prorail-all
npx tsx examples/prorail/build-gallery.ts --in /tmp/prorail-all --out /tmp/prorail-gallery
open /tmp/prorail-gallery/index.html
```

The output dirs aren't tracked in git (≈ 200 MB of SVGs); regenerate locally
when you want to inspect.

## What this proves

That every CLOTHOID member in 6,874 real surveyed alignments parses, integrates
through the JTS-port Simpson rule, and renders with the correct curvature sign,
junction continuity, and bbox framing — without any hand-tuning or geometry-
specific code paths beyond what `src/wkt/` already supports.

## License

This example is dual-licensed:
- **Code** (`*.ts`, `README.md`) — EUPL-1.2, same as the parent project.
- **Data** fetched from ProRail at runtime — CC BY 4.0; attribute "ProRail
  Spoorgeometrie open data" if you publish derived imagery.
