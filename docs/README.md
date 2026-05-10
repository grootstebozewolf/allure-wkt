# docs/

`hero.svg` is the README's hero shot — the rendered output of `allure-wkt` on
[`hero-shot.wkt`](hero-shot.wkt), a real ProRail rail-bend alignment (track
823_12V_4.3 in EPSG:28992 coordinates).

To regenerate it after a renderer change:

```sh
mkdir -p /tmp/hero-shot/results
cp docs/hero-shot.wkt /tmp/hero-shot/results/geometry-attachment.wkt
cat > /tmp/hero-shot/results/test-001-result.json <<'JSON'
{
  "uuid": "hero-shot",
  "name": "ProRail track 823_12V_4.3 (rail bend)",
  "attachments": [
    { "name": "alignment", "source": "geometry-attachment.wkt", "type": "application/vnd.ogc.wkt" }
  ]
}
JSON
npx tsx src/index.ts /tmp/hero-shot/results
cp /tmp/hero-shot/results/*.svg docs/hero.svg
```
