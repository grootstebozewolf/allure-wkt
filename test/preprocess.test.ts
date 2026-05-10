/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * BDD-style scenarios for the preprocessor pipeline. Names preserve the
 * Gherkin Feature / Scenario / Given-When-Then intent in describe/it
 * strings so the file reads as a behavioural spec.
 *
 * These tests are RED until the WKT parser + SVG renderer land. They
 * pin the contract of the CLI as observed by Allure (sibling SVG file
 * on disk + image/svg+xml attachment ref in the patched result JSON +
 * rendered geometry visible inside the SVG).
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCli } from "../src/index.js";

describe("Feature: WKT attachments become SVG attachments in Allure results", () => {
  describe("Scenario: a POINT (10 20) attachment renders as an SVG sibling", () => {
    let resultsDir: string;
    const wktSource = "abc123-attachment.wkt";
    const resultJsonName = "test-001-result.json";

    before(async () => {
      resultsDir = await mkdtemp(join(tmpdir(), "allure-wkt-"));
      // Given: an Allure result with a POINT WKT attachment
      await writeFile(join(resultsDir, wktSource), "POINT (10 20)");
      await writeFile(
        join(resultsDir, resultJsonName),
        JSON.stringify({
          uuid: "test-001",
          name: "renders a point",
          attachments: [
            {
              name: "geometry",
              source: wktSource,
              type: "application/vnd.ogc.wkt",
            },
          ],
        }),
      );
      // When: I run the preprocessor on that directory
      await runCli([resultsDir]);
    });

    after(async () => {
      await rm(resultsDir, { recursive: true, force: true });
    });

    it("Then a new SVG file exists on disk in the results directory", async () => {
      const files = await readdir(resultsDir);
      const svgs = files.filter((f) => f.endsWith(".svg"));
      assert.equal(svgs.length, 1, `expected exactly one .svg file, got ${svgs.length}`);
    });

    it("And the result JSON now references an image/svg+xml attachment", async () => {
      const json = JSON.parse(
        await readFile(join(resultsDir, resultJsonName), "utf8"),
      );
      const svgAtt = (json.attachments ?? []).find(
        (a: { type?: string }) => a.type === "image/svg+xml",
      );
      assert.ok(svgAtt, "expected an image/svg+xml attachment ref in the result JSON");
    });

    it("And the SVG contains a <circle> element representing the POINT", async () => {
      const json = JSON.parse(
        await readFile(join(resultsDir, resultJsonName), "utf8"),
      );
      const svgAtt = (json.attachments ?? []).find(
        (a: { type?: string }) => a.type === "image/svg+xml",
      );
      assert.ok(svgAtt, "precondition: an svg attachment must exist");
      const svg = await readFile(join(resultsDir, svgAtt.source), "utf8");
      assert.match(svg, /<circle\b/, "expected a <circle> element rendering the POINT");
    });
  });
});
