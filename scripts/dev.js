#!/usr/bin/env node
'use strict';

/**
 * Runs the full VITAL AI dev stack with one command: builds and starts the
 * NestJS backend, waits until it actually answers its health probe, then starts
 * the Expo dev server.
 *
 * This exists because the app talks to the backend over HTTP: whenever the API
 * is not listening, every screen fails at the transport layer ("Failed to
 * fetch" on web, "Network request failed" on native). Starting the two together
 * — and refusing to start Expo against a dead API — removes that whole class of
 * confusing, intermittent failure.
 *
 * If port 3000 is already serving a healthy API — a backend someone started by
 * hand — this reuses it instead of spawning a second one that could only die of
 * EADDRINUSE. If the port is held by anything else, it says so, with the PID,
 * rather than reporting the resulting "Backend exited with code 1".
 *
 * Ctrl+C stops both processes.
 *
 * Flags:
 *   --no-build   skip the backend build (faster restart when only the app changed)
 *   --web        run Expo in web mode
 */

const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const process = require('node:process');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');

const API_PORT = 3000;
const HEALTH_URL = `http://localhost:${API_PORT}/health`;
const HEALTH_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 1_000;
/** Per-probe bound, so one unanswered request cannot stall the poll loop. */
const HEALTH_REQUEST_TIMEOUT_MS = 2_000;
/** How long an already-listening port gets to prove it is our healthy API. */
const ADOPT_TIMEOUT_MS = 5_000;
const PORT_PROBE_MS = 1_000;

const args = process.argv.slice(2);
const skipBuild = args.includes('--no-build');
const webMode = args.includes('--web');

/** Child processes we own, so Ctrl+C can take the whole stack down. */
const children = new Set();
let shuttingDown = false;

const colors = { dim: '[2m', red: '[31m', green: '[32m', reset: '[0m' };

function log(message) {
  console.log(`${colors.dim}[dev]${colors.reset} ${message}`);
}

function fail(message) {
  console.error(`${colors.red}[dev] ${message}${colors.reset}`);
}

/**
 * `shell: true` is required on Windows, where `npm` is a .cmd shim that cannot
 * be exec'd directly.
 */
function run(command, options) {
  const child = spawn(command, { stdio: 'inherit', shell: true, ...options });
  children.add(child);
  child.on('exit', () => children.delete(child));
  return child;
}

/**
 * Kills a child and everything it spawned. `child.kill()` alone leaves
 * grandchildren (the actual node/expo processes behind the shell) running on
 * Windows, which would keep port 3000 occupied on the next start.
 */
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killTree(child);
  process.exit(code);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolves true once the backend reports healthy, false if it never does.
 *
 * Each probe is aborted after `HEALTH_REQUEST_TIMEOUT_MS`. Without that bound a
 * process that accepts the connection but never writes a response leaves `fetch`
 * pending forever, and the deadline below is never re-checked — the poll loop
 * hangs instead of giving up.
 */
async function waitForBackend(deadline) {
  while (Date.now() < deadline) {
    if (shuttingDown) return false;
    try {
      const response = await fetch(HEALTH_URL, {
        signal: AbortSignal.timeout(HEALTH_REQUEST_TIMEOUT_MS),
      });
      if (response.ok) {
        const report = await response.json().catch(() => null);
        const checks = report && report.checks ? report.checks : {};
        for (const [name, check] of Object.entries(checks)) {
          if (check && check.status !== 'up') {
            fail(`Backend dependency "${name}" is down: ${check.error ?? 'unknown error'}`);
          }
        }
        return true;
      }
    } catch {
      // Not listening yet — keep polling until the deadline.
    }
    await delay(HEALTH_POLL_MS);
  }
  return false;
}

/**
 * Resolves true if something is already accepting TCP connections on `port`.
 *
 * We probe the socket rather than the health endpoint because the two answer
 * different questions: `fetch` failing tells us the API is not *ready*, while a
 * successful connect tells us the port is *taken* — possibly by a process that
 * will never answer /health. Only the second one explains why our own backend
 * would exit immediately with EADDRINUSE.
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const settle = (inUse) => {
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(PORT_PROBE_MS);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
}

/**
 * Best-effort "who is holding the port" line, so the failure message points at
 * a PID the developer can actually kill instead of just naming the port.
 */
function describePortHolder(port) {
  try {
    if (process.platform === 'win32') {
      const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout ?? '';
      const line = out
        .split(/\r?\n/)
        .find((l) => l.includes(`:${port} `) && l.includes('LISTENING'));
      const pid = line ? line.trim().split(/\s+/).pop() : null;
      return pid ? `PID ${pid} — stop it with: taskkill /PID ${pid} /T /F` : null;
    }
    const pid = (spawnSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' }).stdout ?? '').trim();
    return pid ? `PID ${pid} — stop it with: kill -9 ${pid}` : null;
  } catch {
    return null;
  }
}

/**
 * Decides what to do about a port that is already listening.
 *
 * Spawning our own backend on an occupied port fails instantly with EADDRINUSE,
 * and the only thing the developer sees is "Backend exited with code 1" — a
 * message that describes the symptom and hides the cause. So we look first:
 * a healthy VITAL AI API already on the port is something to *use*, and
 * anything else is something to *name*.
 *
 * Returns 'adopt' to reuse the running API, 'start' to launch our own.
 */
async function resolveExistingBackend() {
  if (!(await isPortInUse(API_PORT))) return 'start';

  log(`Port ${API_PORT} is already in use — checking whether it is the VITAL AI API…`);
  const healthy = await waitForBackend(Date.now() + ADOPT_TIMEOUT_MS);
  if (healthy) {
    log(`${colors.green}Reusing the backend already running${colors.reset} at ${HEALTH_URL}`);
    log('It was started outside this command, so a backend rebuild would NOT apply to it.');
    log('Restart that process yourself if you changed backend source.');
    return 'adopt';
  }

  fail(`Port ${API_PORT} is occupied by something that does not answer ${HEALTH_URL}.`);
  const holder = describePortHolder(API_PORT);
  if (holder) fail(holder);
  fail('Free the port and re-run, or point the API at another port.');
  return 'stop';
}

function buildBackend() {
  log('Building backend…');
  const result = spawnSync('npm run build', { cwd: BACKEND, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    fail('Backend build failed. Fix the errors above and re-run.');
    process.exit(result.status ?? 1);
  }
}

async function main() {
  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  // Look before building: if a healthy API is already up we adopt it, and the
  // build we would have run is both slow and inapplicable to it.
  const existing = await resolveExistingBackend();
  if (existing === 'stop') {
    shutdown(1);
    return;
  }

  if (existing === 'start') {
    if (!skipBuild) buildBackend();

    log(`Starting backend on port ${API_PORT}…`);
    const backend = run('npm run start:prod', { cwd: BACKEND });

    backend.on('exit', (code) => {
      if (shuttingDown) return;
      fail(`Backend exited with code ${code}. The app cannot reach the API — stopping.`);
      shutdown(code ?? 1);
    });

    const healthy = await waitForBackend(Date.now() + HEALTH_TIMEOUT_MS);
    if (!healthy) {
      if (shuttingDown) return;
      fail(`Backend did not become healthy within ${HEALTH_TIMEOUT_MS / 1000}s.`);
      fail('Check backend/.env (DATABASE_URL, Supabase keys) and that Redis is running.');
      shutdown(1);
      return;
    }

    log(`${colors.green}Backend healthy${colors.reset} at ${HEALTH_URL}`);
  }

  log('Starting Expo…');

  const expo = run(webMode ? 'npx expo start --web' : 'npx expo start', { cwd: ROOT });
  expo.on('exit', (code) => shutdown(code ?? 0));
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
  shutdown(1);
});
