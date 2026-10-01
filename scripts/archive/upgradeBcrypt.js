const fs = require('fs');

function updateFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [from, to] of replacements) {
    if (!content.includes(from)) {
      console.warn(`Pattern not found in ${filePath}:`, from);
    }
    content = content.replace(from, to);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated:', filePath);
}

updateFile('backend/src/controllers/crmController.js', [
  ['await bcrypt.hash(pin, 10);', 'await bcrypt.hash(pin, 12);'],
  ["await bcrypt.hash('1234', 10);", "await bcrypt.hash('1234', 12);"]
]);

updateFile('backend/src/controllers/kioskPinController.js', [
  ['await bcrypt.hash(pin, 10);', 'await bcrypt.hash(pin, 12);']
]);

updateFile('backend/src/scripts/seed.js', [
  ["bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin@2026', 10);", "bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin@2026', 12);"],
  ["bcrypt.hash(process.env.DEFAULT_USER_PASSWORD || 'bsc@2026', 10);", "bcrypt.hash(process.env.DEFAULT_USER_PASSWORD || 'bsc@2026', 12);"],
  ["bcrypt.hash(process.env.GREETER_PASSWORD || 'bsc@123', 10);", "bcrypt.hash(process.env.GREETER_PASSWORD || 'bsc@123', 12);"]
]);
