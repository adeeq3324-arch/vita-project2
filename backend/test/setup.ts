import { Logger } from '@nestjs/common';

/**
 * Silences Nest's logger for the duration of a test run.
 *
 * Much of this suite deliberately exercises failure paths — an unreachable
 * Redis, a malformed DSN, a rejected upload — and each one logs a warning or an
 * error by design. Left on, that output buries the actual test results in noise
 * that looks like failure but is the code behaving correctly.
 *
 * Logging *behaviour* is asserted where it matters by spying on the logger
 * directly, so muting the transport here costs no coverage.
 */
Logger.overrideLogger(false);
