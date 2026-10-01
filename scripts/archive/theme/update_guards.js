import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mapping = {
  '#101C36': '#123C35',
  '#07101F': '#082821',
  '#0B132B': '#082821',
  '#0A0F1E': '#082821',
  '#182033': '#17201D',
  '#687080': '#65716C',
  '#DFDDD7': '#E1DDD3',
  '#F6F4EF': '#F7F5F0',
  '#FAF8F5': '#FFFFFF'
};

const targetFiles = [
  'src/pages/VerifyEmail.tsx',
  'src/pages/ForgotPassword.tsx',
  'src/pages/tv/KioskAccessScreen.tsx',
  'src/components/AuthGuard.tsx',
  'src/components/RouteGuard.tsx',
  'src/components/Toast.tsx',
  'src/components/ui/NotificationDrawer.tsx'
];

targetFiles.forEach(relPath => {
  const fullPath = path.join(__dirname, relPath);
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');
    let count = 0;
    for (const [oldColor, newColor] of Object.entries(mapping)) {
      const regex = new RegExp(oldColor, 'gi');
      content = content.replace(regex, () => {
        count++;
        return newColor;
      });
    }
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated ${relPath}: ${count} replacements`);
  } else {
    console.log(`File not found: ${relPath}`);
  }
});
