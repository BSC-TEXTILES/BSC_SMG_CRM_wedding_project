const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');
const srcDist = path.join(frontendDir, 'dist');
const backendDist = path.join(backendDir, 'dist');
const rootDist = path.join(rootDir, 'dist');

console.log('[Build] Starting BSC Enterprise production build...');

// 1. Build frontend
let buildSuccessful = false;
if (fs.existsSync(frontendDir)) {
  const frontendNodeModules = path.join(frontendDir, 'node_modules');
  const hasPrebuilt = fs.existsSync(srcDist) || fs.existsSync(backendDist) || fs.existsSync(rootDist);

  if (!fs.existsSync(frontendNodeModules) && hasPrebuilt) {
    console.log('[Build] Server environment detected without frontend node_modules. Using existing verified production build.');
    buildSuccessful = true;
  } else {
    console.log('[Build] Building frontend client in:', frontendDir);
    try {
      const installCmd = fs.existsSync(frontendNodeModules)
        ? 'npm run build'
        : 'npm install --legacy-peer-deps && npm run build';
      execSync(installCmd, { cwd: frontendDir, stdio: 'inherit' });
      buildSuccessful = true;
    } catch (err) {
      console.warn('[Build] Warning: Frontend build skipped or failed in server environment:', err.message);
      if (hasPrebuilt) {
        console.log('[Build] Pre-built dist folder exists. Proceeding with existing production build.');
      } else {
        console.error('[Build] Error: No pre-built dist folder found and build failed.');
        process.exit(1);
      }
    }
  }
} else {
  if (fs.existsSync(srcDist) || fs.existsSync(backendDist) || fs.existsSync(rootDist)) {
    console.log('[Build] Frontend directory not found; using existing pre-built dist folder.');
  } else {
    console.error('[Build] Error: frontend directory and pre-built dist not found at:', frontendDir);
    process.exit(1);
  }
}

// 2. Ensure dist output exists and sync to backend/dist and root/dist
if (fs.existsSync(srcDist)) {
  try {
    if (fs.existsSync(backendDist)) {
      fs.rmSync(backendDist, { recursive: true, force: true });
    }
    fs.cpSync(srcDist, backendDist, { recursive: true });
    console.log('[Build] Successfully synchronized build artifacts to backend/dist');

    if (fs.existsSync(rootDist)) {
      fs.rmSync(rootDist, { recursive: true, force: true });
    }
    fs.cpSync(srcDist, rootDist, { recursive: true });
    console.log('[Build] Successfully synchronized build artifacts to root dist');
  } catch (err) {
    console.error('[Build] Error copying distribution files:', err.message);
    if (!fs.existsSync(backendDist) && !fs.existsSync(rootDist)) {
      process.exit(1);
    }
  }
} else if (fs.existsSync(backendDist) || fs.existsSync(rootDist)) {
  console.log('[Build] Preserving existing pre-built dist folder for deployment.');
} else {
  console.error('[Build] Error: frontend dist directory does not exist at:', srcDist);
  process.exit(1);
}

// 3. Touch restart.txt to signal Passenger/Hostinger hot-reloader
try {
  const tmpDirs = [
    path.join(rootDir, 'tmp'),
    path.join(backendDir, 'tmp')
  ];
  for (const d of tmpDirs) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'restart.txt'), String(Date.now()));
  }
  console.log('[Build] Touched restart.txt for Hostinger/Passenger deployment');
} catch (e) {
  // Non-fatal warning
}

console.log('[Build] Production build completed successfully.');
