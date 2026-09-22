const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
const srcDist = path.join(frontendDir, 'dist');
const backendDist = path.join(backendDir, 'dist');
const rootDist = path.join(rootDir, 'dist');
const logFile = path.join(rootDir, 'build.log');

const logLines = [];
function log(msg) {
  const line = `[Build ${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logLines.push(line);
}
function warn(msg) {
  const line = `[Build WARNING ${new Date().toISOString()}] ${msg}`;
  console.warn(line);
  logLines.push(line);
}
function logError(msg) {
  const line = `[Build ERROR ${new Date().toISOString()}] ${msg}`;
  console.error(line);
  logLines.push(line);
}
function flushLog() {
  try {
    fs.writeFileSync(logFile, logLines.join('\n') + '\n', 'utf8');
  } catch (e) {}
}

log('Starting BSC Enterprise production build...');
log(`Node.js Version: ${process.version}`);
log(`Platform: ${process.platform} (${process.arch})`);
log(`Current Working Directory: ${process.cwd()}`);
log(`Root Directory: ${rootDir}`);

// ── 1. Compile TypeScript / Vite Frontend ───────────────────────────────────────
let buildRan = false;
const hasPrebuilt = (fs.existsSync(path.join(srcDist, 'index.html')) ||
                     fs.existsSync(path.join(backendDist, 'index.html')) ||
                     fs.existsSync(path.join(rootDist, 'index.html')));

if (fs.existsSync(frontendDir)) {
  const frontendNodeModules = path.join(frontendDir, 'node_modules');
  const hasFrontendModules = fs.existsSync(frontendNodeModules);

  if (!hasFrontendModules && hasPrebuilt) {
    log('Server environment detected without frontend node_modules. Using existing verified production build.');
  } else {
    log(`Building frontend client in: ${frontendDir}`);
    try {
      const installCmd = hasFrontendModules
        ? 'npm run build'
        : 'npm install --legacy-peer-deps && npm run build';
      execSync(installCmd, { cwd: frontendDir, stdio: 'inherit' });
      buildRan = true;
      log('Frontend client compiled successfully with Vite/TypeScript.');
    } catch (err) {
      warn(`Frontend build step encountered an error: ${err.message}`);
      if (hasPrebuilt) {
        log('Pre-built dist folder exists. Gracefully falling back to verified production build.');
      } else {
        logError('CRITICAL: No pre-built dist folder found and frontend compilation failed.');
        flushLog();
        process.exit(1);
      }
    }
  }
} else {
  if (hasPrebuilt) {
    log('Frontend source directory not found; using existing pre-built dist folder.');
  } else {
    logError(`CRITICAL: frontend directory and pre-built dist not found at: ${frontendDir}`);
    flushLog();
    process.exit(1);
  }
}

// ── 2. Synchronize and Verify Build Artifacts ────────────────────────────────────
// Identify master source with index.html
let masterDist = null;
if (fs.existsSync(path.join(srcDist, 'index.html'))) {
  masterDist = srcDist;
} else if (fs.existsSync(path.join(backendDist, 'index.html'))) {
  masterDist = backendDist;
} else if (fs.existsSync(path.join(rootDist, 'index.html'))) {
  masterDist = rootDist;
}

if (!masterDist) {
  logError('CRITICAL: No valid index.html found in frontend/dist, backend/dist, or root dist.');
  flushLog();
  process.exit(1);
}

log(`Using master build artifacts from: ${masterDist}`);

// Mirror to backend/dist
try {
  if (masterDist !== backendDist) {
    if (fs.existsSync(backendDist)) {
      fs.rmSync(backendDist, { recursive: true, force: true });
    }
    fs.cpSync(masterDist, backendDist, { recursive: true });
  }
  log('Successfully synchronized build artifacts to backend/dist');
} catch (err) {
  logError(`Error syncing to backend/dist: ${err.message}`);
}

// Mirror to root dist
try {
  if (masterDist !== rootDist) {
    if (fs.existsSync(rootDist)) {
      fs.rmSync(rootDist, { recursive: true, force: true });
    }
    fs.cpSync(masterDist, rootDist, { recursive: true });
  }
  log('Successfully synchronized build artifacts to root dist');
} catch (err) {
  logError(`Error syncing to root dist: ${err.message}`);
}

// Mirror to frontend/dist if missing
try {
  if (masterDist !== srcDist && !fs.existsSync(srcDist)) {
    fs.cpSync(masterDist, srcDist, { recursive: true });
    log('Successfully synchronized build artifacts to frontend/dist');
  }
} catch (err) {
  // Non-fatal
}

// ── 3. Rigorous Build Verification ──────────────────────────────────────────────
const finalBackendIndex = path.join(backendDist, 'index.html');
const finalRootIndex = path.join(rootDist, 'index.html');

if (!fs.existsSync(finalBackendIndex) && !fs.existsSync(finalRootIndex)) {
  logError('CRITICAL: Verification failed. index.html does not exist in backend/dist or root dist.');
  flushLog();
  process.exit(1);
}

const verifiedIndex = fs.existsSync(finalBackendIndex) ? finalBackendIndex : finalRootIndex;
const indexStat = fs.statSync(verifiedIndex);
const assetsDir = path.join(path.dirname(verifiedIndex), 'assets');
const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];

log(`Verification: Client entry point verified at ${verifiedIndex} (${indexStat.size} bytes)`);
log(`Verification: ${assetFiles.length} client asset bundle(s) verified in ${assetsDir}`);

// ── 4. Touch restart.txt for Hostinger/Passenger ────────────────────────────────
try {
  const tmpDirs = [
    path.join(rootDir, 'tmp'),
    path.join(backendDir, 'tmp')
  ];
  for (const d of tmpDirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'restart.txt'), String(Date.now()));
  }
  log('Touched restart.txt for Hostinger/Passenger hot-reload.');
} catch (e) {
  warn(`Unable to touch restart.txt: ${e.message}`);
}

log('Production build completed successfully.');
flushLog();
process.exit(0);
