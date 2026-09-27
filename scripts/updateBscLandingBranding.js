const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, '..', 'workspace-01a0dd39-a89f-71de-ac0d-49049a7f44d8'),
  path.join(__dirname, '..', 'frontend', 'src', 'pages', 'madt')
];

function replaceInFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

  // Brand Name & Logo
  content = content.replace(/<span className="logo-word">MADT<\/span>\s*<span className="logo-sub">Hubballi<\/span>/g,
    '<span className="logo-word">BSC</span>\n            <span className="logo-sub">Textiles</span>');
  content = content.replace(/<span className="logo-word">MADT<\/span>\s*<span className="logo-sub">Textiles<\/span>/g,
    '<span className="logo-word">BSC</span>\n            <span className="logo-sub">Textiles</span>');
  content = content.replace(/MADT, Hubballi — home/g, 'BSC Textiles — Belagavi, Davanagere, Shivamogga');
  content = content.replace(/MADT — Cloth, jewellery and home in Hubballi/g, 'BSC Textiles — Pure Silk Sarees, Wedding & Menswear');
  content = content.replace(/MADT is a cloth and lifestyle house in Hubballi/g, 'BSC Textiles is a premier textile and bridal house in Belagavi, Davanagere, and Shivamogga');
  content = content.replace(/Cloth house · Hubballi/g, 'Cloth house · Belagavi · Davanagere · Shivamogga');
  content = content.replace(/Koppikar Road flagship · 10:30 to 8:30 · seven days/g, 'Belagavi Flagship · Davanagere · Shivamogga · 10:30 to 8:30 · seven days');
  content = content.replace(/© 2026 MADT House, Hubballi\./g, '© 2026 BSC Textiles. Belagavi · Davanagere · Shivamogga.');
  content = content.replace(/© 2026 MADT House\./g, '© 2026 BSC Textiles.');
  content = content.replace(/Ask for MADT when you arrive/g, 'Ask for BSC Textiles when you arrive');
  content = content.replace(/MADT House/g, 'BSC Textiles');

  // Locations in store row & modals
  content = content.replace(/Flagship, Koppikar Road/g, 'Belagavi Flagship (Khade Bazar)');
  content = content.replace(/Home floor, Vidyanagar/g, 'Davanagere Heritage (Mandipet)');
  content = content.replace(/Suit desk, Coen Road/g, 'Shivamogga Store (Nehru Road)');

  content = content.replace(/Koppikar Road, Hubballi 580020/g, 'Khade Bazar / Raviwar Peth, Belagavi 590001');
  content = content.replace(/Vidyanagar, Hubballi 580021/g, 'Mandipet / PB Road, Davanagere 577001');
  content = content.replace(/Coen Road, Hubballi 580020/g, 'Nehru Road / Durgigudi, Shivamogga 577201');

  // Stores in lists / navigation
  content = content.replace(/>Koppikar Road</g, '>Belagavi Flagship<');
  content = content.replace(/>Vidyanagar</g, '>Davanagere Heritage<');
  content = content.replace(/>Coen Road</g, '>Shivamogga Store<');

  // Map links
  content = content.replace(/query=Koppikar\+Road\+Hubballi\+580020/g, 'query=BSC+Textiles+Khade+Bazar+Belagavi');
  content = content.replace(/query=Vidyanagar\+Hubballi\+580021/g, 'query=BSC+Textiles+Mandipet+Davanagere');
  content = content.replace(/query=Coen\+Road\+Hubballi\+580020/g, 'query=BSC+Textiles+Nehru+Road+Shivamogga');
  content = content.replace(/Open Koppikar Road in maps/g, 'Open Belagavi Store in maps');
  content = content.replace(/Open Vidyanagar in maps/g, 'Open Davanagere Store in maps');
  content = content.replace(/Open Coen Road in maps/g, 'Open Shivamogga Store in maps');

  // Titles
  content = content.replace(/title="MADT"/g, 'title="BSC Textiles"');
  content = content.replace(/<title>Contact — MADT<\/title>/g, '<title>Contact — BSC Textiles</title>');
  content = content.replace(/<title>Consultation — MADT<\/title>/g, '<title>Consultation — BSC Textiles</title>');
  content = content.replace(/<title>Wedding Shopping — MADT<\/title>/g, '<title>Wedding Shopping — BSC Textiles</title>');
  content = content.replace(/<title>Privacy — MADT<\/title>/g, '<title>Privacy — BSC Textiles</title>');
  content = content.replace(/<title>Terms — MADT<\/title>/g, '<title>Terms — BSC Textiles</title>');
  content = content.replace(/<title>House Desk — MADT<\/title>/g, '<title>Store Desk — BSC Textiles</title>');
  content = content.replace(/<title>Sign in — MADT<\/title>/g, '<title>Sign in — BSC Textiles</title>');

  // Ref generation prefix
  content = content.replace(/MADT-C-/g, 'BSC-C-');
  content = content.replace(/MADT-W-/g, 'BSC-W-');
  content = content.replace(/MADT-M-/g, 'BSC-M-');
  content = content.replace(/'MADT-M-1801'/g, "'BSC-M-1801'");
  content = content.replace(/'MADT-C-1801'/g, "'BSC-C-1801'");
  content = content.replace(/'MADT-W-1801'/g, "'BSC-W-1801'");

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated branding in:', path.basename(filePath));
}

function processDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        processDirectory(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.jsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
      replaceInFile(fullPath);
    }
  }
}

console.log('🔄 Updating landing page branding for BSC Textiles across workspace & frontend...');
for (const dir of targetDirs) {
  processDirectory(dir);
}
console.log('✅ Branding successfully updated!');
