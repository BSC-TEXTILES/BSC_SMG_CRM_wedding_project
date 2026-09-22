const fs = require('fs');
const path = require('path');

// If root build.js exists, delegate to root build.js for unified consistency
const rootBuildScript = path.resolve(__dirname, '..', 'build.js');
if (fs.existsSync(rootBuildScript)) {
  require(rootBuildScript);
} else {
  console.log('[Backend Build] Running fallback backend build script...');
  const backendDist = path.join(__dirname, 'dist');
  const indexHtml = path.join(backendDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    console.log('[Backend Build] Verified backend/dist/index.html exists.');
  } else {
    console.error('[Backend Build] CRITICAL: backend/dist/index.html not found!');
    process.exit(1);
  }
  process.exit(0);
}
