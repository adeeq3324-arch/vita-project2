import type { ZodType } from 'zod';
import { AiSchemaError } from './ai.interface';

/**
 * Turning model output into a validated value.
 *
 * `generateStructured` handles this internally, but {@link AiService.analyzeImage}
 * returns free text by contract — and an image analysis still has a shape the
 * caller needs. Rather than have every such caller write its own brittle
 * `JSON.parse`, the extraction and validation live here and behave identically
 * wherever they are used.
 *
 * Deliberately provider-agnostic: nothing below knows or cares which service
 * produced the text.
 */

/**
 * Isolates the JSON value in a model response.
 *
 * Even when JSON is demanded, output can arrive wrapped in a markdown fence or
 * padded with a sentence of commentary. This strips a fence if present, then
 * scans for the first balanced object or array — quote- and escape-aware, so a
 * brace inside a string value cannot end the scan early.
 */
export function extractJson(raw: string): string | null {
  const text = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  const start = text.search(/[{[]/);
  if (start === -1) {
    return null;
  }

  const opener = text[start];
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === opener) {
      depth += 1;
    } else if (char === closer) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/** Why a response failed validation, or the value it produced. */
export type ParseOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validates raw model output against a schema, reporting why it failed. */
export function tryParseStructured<T>(raw: string, schema: ZodType<T>): ParseOutcome<T> {
  const candidate = extractJson(raw);
  if (candidate === null) {
    return { ok: false, error: 'the response contained no JSON value' };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(candidate);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `the response was not valid JSON (${detail})` };
  }

  const result = schema.safeParse(decoded);
  if (result.success) {
    return { ok: true, value: result.data };
  }

  const issues = result.error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');

  return { ok: false, error: issues };
}

/**
 * Validates raw model output, throwing {@link AiSchemaError} when it does not
 * conform. Use where there is no opportunity to ask the model again.
 */
export function parseStructured<T>(raw: string, schema: ZodType<T>): T {
  const outcome = tryParseStructured(raw, schema);
  if (!outcome.ok) {
    throw new AiSchemaError(
      `The model did not return a value matching the requested schema: ${outcome.error}`,
    );
  }
  return outcome.value;
}
