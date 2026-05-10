/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Minimal subset of the Allure 2 result-file schema we actually read.
 * Extra fields are ignored on parse and preserved by JSON round-trip.
 */

export interface AllureAttachment {
  name: string;
  source: string;
  type?: string;
}

export interface AllureStep {
  name?: string;
  attachments?: AllureAttachment[];
  steps?: AllureStep[];
}

export interface AllureResult {
  uuid: string;
  name: string;
  attachments?: AllureAttachment[];
  steps?: AllureStep[];
}

/**
 * One WKT attachment we plan to render. Carries everything the processing
 * stage needs without re-reading the JSON: the attachment ref itself,
 * a live ref into the parent (top-level result or step) for in-place
 * mutation, and the root we serialise back to disk.
 */
export interface WktMatch {
  /** The WKT attachment ref the test framework emitted. */
  attachment: AllureAttachment;
  /** Where the new SVG attachment ref gets appended (top-level or step). */
  parent: AllureResult | AllureStep;
  /** The top-level result -- always the root object we write back. */
  root: AllureResult;
  /** Absolute path to the {@code *-result.json} file we mutate. */
  filePath: string;
  /** Directory holding the attachment binary files. */
  attachmentDir: string;
}
