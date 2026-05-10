/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
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
  // other fields ignored for v1
}

export interface AllureResult {
  uuid: string;
  name: string;
  attachments?: AllureAttachment[];
  steps?: AllureStep[];
  // other top-level fields ignored
}

export interface WktMatch {
  attachment: AllureAttachment;
  parent: AllureResult | AllureStep; // where to append the new svg attachment
  root: AllureResult; // top-level result to serialise back to disk
  filePath: string; // full path to the result json
  attachmentDir: string; // dir containing the attachment files
}
