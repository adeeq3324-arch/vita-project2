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
 * Ctrl+C stops both processes.
 *
 * Flags:
 *   --no-build   skip the backend build (faster restart when only the app changed)
 *   --web        run Expo in web mode
 */

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const process = require('node:process');

const ROOT = path.resolve(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');

const HEALTH_URL = 'http://localhost:3000/health';
const HEALTH_TIMEOUT_MS = 90_000;
const HEALTH_POLL_MS = 1_000;

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

/** Resolves true once the backend reports healthy, false if it never does. */
async function waitForBackend(deadline) {
  while (Date.now() < deadline) {
    if (shuttingDown) return false;
    try {
      const response = await fetch(HEALTH_URL);
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

  if (!skipBuild) buildBackend();

  log('Starting backend on port 3000…');
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
  log('Starting Expo…');

  const expo = run(webMode ? 'npx expo start --web' : 'npx expo start', { cwd: ROOT });
  expo.on('exit', (code) => shutdown(code ?? 0));
}

main().catch((error) => {
  fail(error instanceof Error ? error.stack ?? error.message : String(error));
  shutdown(1);
});
