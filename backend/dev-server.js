'use strict';

/**
 * Development supervisor for the backend.
 *
 * The server exits on an uncaught exception so that a process manager can bring it
 * back — but in development there is no process manager, so a single transient
 * failure (a socket write after the client vanished, a database blip) left the port
 * empty and every browser request answered 503 / ECONNREFUSED until the developer
 * noticed and restarted by hand.
 *
 * This is that missing process manager: it starts `index.js`, hands the console
 * straight through, and restarts it with a growing delay when it dies. The delay is
 * capped, and a process that stays up resets it, so a genuine boot loop reports
 * itself instead of restarting thousands of times.
 *
 *   node dev-server.js            # equivalent to npm run dev:backend
 *   PORT=5050 node dev-server.js
 */

const { spawn } = require('child_process');
const path = require('path');

const APP_ENTRY = path.join(__dirname, 'index.js');
const BASE_DELAY_MS = 2000;
const MAX_DELAY_MS = 30000;
// A restart that fails again within this window counts towards the boot loop.
const QUICK_FAILURE_MS = 10000;
const MAX_CONSECUTIVE_QUICK_FAILURES = 6;

let child = null;
let stopping = false;
let delay = BASE_DELAY_MS;
let quickFailures = 0;
let startedAt = 0;

function launch() {
  startedAt = Date.now();
  child = spawn(process.execPath, [APP_ENTRY], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' }
  });

  child.on('exit', (code, signal) => {
    if (stopping) return;

    const livedFor = Date.now() - startedAt;
    if (livedFor < QUICK_FAILURE_MS) {
      quickFailures += 1;
    } else {
      quickFailures = 0;
      delay = BASE_DELAY_MS;
    }

    if (quickFailures >= MAX_CONSECUTIVE_QUICK_FAILURES) {
      console.error(
        `[dev-server] The backend failed ${quickFailures} times within ${QUICK_FAILURE_MS / 1000}s each. ` +
        'It is not a transient fault — fix the error above before starting it again. Supervisor stopping.'
      );
      process.exit(1);
    }

    console.warn(
      `[dev-server] Backend exited (code=${code} signal=${signal || 'none'}). Restarting in ${Math.round(delay / 1000)}s — ` +
      'the browser will report 503 until it is back.'
    );
    setTimeout(launch, delay);
    delay = Math.min(delay * 2, MAX_DELAY_MS);
  });

  child.on('error', (err) => {
    console.error(`[dev-server] Could not start the backend: ${err.message}`);
  });
}

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    stopping = true;
    if (child && !child.killed) child.kill(signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM');
    setTimeout(() => process.exit(0), 500);
  });
});

console.log(`[dev-server] Supervising ${APP_ENTRY} on port ${process.env.PORT || 5000} (auto-restarts on failure)`);
launch();
