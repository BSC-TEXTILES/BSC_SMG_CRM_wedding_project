const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'backend', 'index.js');
let content = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

// 1. Add validateContentType require
if (!content.includes("validateContentType")) {
  content = content.replace(
    "const { inputSanitizer } = require('./src/security/inputSanitizer');",
    "const { inputSanitizer } = require('./src/security/inputSanitizer');\nconst { validateContentType } = require('./src/middleware/validateContentType');"
  );
}

// 2. Mount validateContentType
if (!content.includes("app.use(validateContentType);")) {
  content = content.replace(
    "app.use(express.urlencoded({ extended: true, limit: '2mb' }));",
    "app.use(express.urlencoded({ extended: true, limit: '2mb' }));\napp.use(validateContentType);"
  );
}

// 3. Protect /db-status
content = content.replace(
  "app.get(['/db-status', '/api/db-status'], async (req, res) => {",
  "app.get(['/db-status', '/api/db-status'], authenticate, authorize('Admin', 'Super Admin'), async (req, res) => {"
);
content = content.replace(
  "res.status(500).json({ connected: false, error: err.message });",
  "res.status(500).json({ connected: false, error: 'Database service unavailable' });"
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated backend/index.js');
