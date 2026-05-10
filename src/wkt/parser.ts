/**
 * Copyright (c) 2026 J.P.J. Bloemscheer / JeroenTechSolutions
 * Licensed under the EUPL-1.2 (see LICENSE.txt)
 *
 * Hand-rolled WKT parser. Tokenizer + recursive-descent dispatch;
 * pure function, no I/O, no deps. Throws {@link SyntaxError} on
 * malformed input or unsupported geometry types.
 *
 * v1 supports POINT (x y) only. Additional types layer in additively
 * via new cases in {@link parseWkt} and new helpers below.
 */
import type { Geometry, Point } from './types.js';

/** Validates a token IS a numeric literal (anchored). */
const NUMBER_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
/** Matches a leading numeric literal in remaining input (un-anchored end). */
const NUMBER_TOKEN_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
/** Matches a leading identifier in remaining input. */
const IDENT_TOKEN_RE = /^[A-Za-z]+/;

// ---------------------------------------------------------------------------
// tokenize

/**
 * Lexer. Whitespace is skipped; identifiers, numeric literals, and the
 * three structural punctuation marks ({@code ( ) ,}) are emitted as
 * raw string tokens. The parser layer validates token kinds further.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }
    if (ch === '(' || ch === ')' || ch === ',') {
      tokens.push(ch);
      i++;
      continue;
    }
    const rest = input.slice(i);
    const numMatch = rest.match(NUMBER_TOKEN_RE);
    if (numMatch && /\d/.test(numMatch[0])) {
      tokens.push(numMatch[0]);
      i += numMatch[0].length;
      continue;
    }
    const idMatch = rest.match(IDENT_TOKEN_RE);
    if (idMatch) {
      tokens.push(idMatch[0]);
      i += idMatch[0].length;
      continue;
    }
    throw new SyntaxError(
      `Unexpected character '${ch}' at offset ${i} in WKT input`,
    );
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// parser

class TokenStream {
  private pos = 0;

  constructor(private readonly tokens: readonly string[]) {}

  peek(): string | undefined {
    return this.tokens[this.pos];
  }

  next(): string {
    const t = this.tokens[this.pos];
    if (t === undefined) {
      throw new SyntaxError('Unexpected end of WKT input');
    }
    this.pos++;
    return t;
  }

  expect(literal: string): void {
    const got = this.next();
    if (got !== literal) {
      throw new SyntaxError(`Expected '${literal}', got '${got}'`);
    }
  }

  nextNumber(): number {
    const t = this.next();
    if (!NUMBER_RE.test(t)) {
      throw new SyntaxError(`Expected number, got '${t}'`);
    }
    return parseFloat(t);
  }

  done(): boolean {
    return this.pos >= this.tokens.length;
  }
}

function parsePoint(stream: TokenStream): Point {
  stream.expect('(');
  const x = stream.nextNumber();
  const y = stream.nextNumber();
  stream.expect(')');
  return { type: 'Point', coordinates: [x, y] };
}

/**
 * Parse a WKT string into a {@link Geometry} AST.
 *
 * @throws {SyntaxError} on malformed input, unsupported geometry types,
 *   or trailing tokens after the geometry.
 */
export function parseWkt(input: string): Geometry {
  const stream = new TokenStream(tokenize(input));
  const typeName = stream.next().toUpperCase();

  let geometry: Geometry;
  switch (typeName) {
    case 'POINT':
      geometry = parsePoint(stream);
      break;
    default:
      throw new SyntaxError(`Unsupported WKT geometry: '${typeName}'`);
  }

  if (!stream.done()) {
    throw new SyntaxError(`Unexpected token '${stream.peek()}' after geometry`);
  }
  return geometry;
}
