/**
 * RFC 7807 "Problem Details for HTTP APIs" response shape. Every error the API
 * returns conforms to this structure so clients get a single, predictable
 * error contract.
 */
export interface ProblemDetails {
  /** A URI reference identifying the problem type. `about:blank` when generic. */
  type: string;
  /** Short, human-readable summary of the problem type. */
  title: string;
  /** HTTP status code. */
  status: number;
  /** Human-readable explanation specific to this occurrence. */
  detail: string;
  /** The request path that produced the error. */
  instance: string;
  /** ISO-8601 timestamp of when the error was generated. */
  timestamp: string;
  /** Correlation id, echoed from/into the `x-request-id` header. */
  requestId?: string;
  /** Field-level validation errors, when applicable. */
  errors?: string[];
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
