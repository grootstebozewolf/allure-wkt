# examples/vitest-allure

Self-contained, end-to-end demo of the full pipeline for **Allure 3**:

```
[your tests]  ──vitest+allure-vitest──▶  allure-results/  ──allure-wkt──▶  patched results/  ──allure (v3)──▶  HTML report with WKT rendered inline
```

## What this shows

A small Vitest suite where each test attaches a WKT geometry via the
standard Allure attachment API (`attachment(...)` from `allure-js-commons`).
After the run, `allure-wkt` walks `allure-results/`, finds every WKT-typed
attachment (top-level OR nested inside a step), renders it to SVG, and
patches the corresponding `*-result.json` so the SVG appears as a
first-class `image/svg+xml` attachment. When you generate the **Allure 3
report** (the npm-installed `allure` CLI, version 3.x), every test's
geometry shows up **inline** in the Attachments tab — no plugin install,
no fork, no frontend customisation.

The test suite covers every geometry kind v0.1.0 of `allure-wkt` supports:

| Test                                                           | What you'll see in the report |
|----------------------------------------------------------------|-------------------------------|
| `POINT (10 20)`                                                | A small filled circle |
| `LINESTRING -- multi-segment open path`                        | A polyline with 4 vertices |
| `TRIANGLE -- closed 3-corner ring with fill`                   | A filled triangle |
| `TIN -- two triangles tiled together`                          | Two adjacent filled triangles |
| `CIRCULARSTRING -- 5-point chain`                              | A full circle from two stitched arcs |
| `COMPOUNDCURVE with CLOTHOID -- entry-spiral pattern`          | Straight tangent + spiral, one continuous polyline |
| `Real ProRail rail-bend (track 823_12V_4.3)`                   | A real-world rail alignment with two clothoid easements around an arc |
| `Buffer-like example`                                          | Two SVGs side by side in one test (input + output) |

## Run it

```sh
cd examples/vitest-allure
npm install        # vitest v4 + allure-vitest + allure (Allure 3 CLI)
npm run report     # vitest run -> allure-wkt -> allure generate
npm run open       # open the HTML report
```

Or just `npm run all`.

The report's per-test detail view will show, for each test, the original
`.wkt` attachment **and** the rendered SVG sibling that `allure-wkt`
produced. Click the SVG attachment to see the geometry preview inline —
Allure 3's awesome frontend treats `image/svg+xml` as a first-class image
type.

## Why the deps look the way they do

Two version-alignment gotchas if you adapt this to your own project:

- **`vitest@^4` matches `allure-vitest@^3.7`.** Earlier vitest 3.x ships its
  own bundled copy of `@vitest/runner@3.x`; allure-vitest 3.7 pulls in
  `@vitest/runner@4.x`. Two copies of the runner means two copies of the
  per-test "current task" state, and `attachment()` from `allure-js-commons`
  silently fails with `no vitest context is detected`. Pinning vitest to
  v4 makes them share one runner instance.
- **`allure` (the npm package, v3.x)** is the **Allure 3** CLI. The older
  `allure-commandline` (npm) wraps the Java-based **Allure 2** generator —
  different report frontend, different schema for some features. v3 is the
  current line; this example targets it.

## How `npm run preprocess` invokes `allure-wkt`

This example consumes the **published** [`allure-wkt`](https://www.npmjs.com/package/allure-wkt)
package from npm — exactly the way a downstream project would. It's
listed in `devDependencies` and the script is a one-liner:

```jsonc
"preprocess": "allure-wkt ./allure-results"
```

`npm` puts the binary in `node_modules/.bin/` (per the package's
`bin` entry) and the npm-script's `PATH` resolution picks it up.
This example therefore exercises the same compiled `dist/` that
every other consumer downloads — there is no in-repo TypeScript
shortcut.

## License

Code: EUPL-1.2 (same as the parent repo). The hero ProRail WKT
referenced from `tests/geometries.test.ts` is sourced from
[ProRail Spoorgeometrie](https://maps.prorail.nl/arcgis/rest/services/Spoorgeometrie/FeatureServer/11)
(CC BY 4.0).
