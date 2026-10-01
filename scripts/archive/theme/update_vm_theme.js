import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mapping = {
  '#4A173A': '#123C35',
  '#6A2853': '#082821',
  '#B76E79': '#C9A45C',
  '#E8D9D4': '#E1DDD3',
  '#E8C7A8': '#E4CB92',
  '#FFF7F2': '#EDF3F0',
  '#FFFAF7': '#F7F5F0',
  '#FFFDFC': '#FFFFFF',
  '#6F5963': '#65716C',
  '#2B1722': '#17201D',
  '#F6E2E5': '#EDF3F0',
  '#F3E7E2': '#E1DDD3',
  '#EDE7F6': '#EDF3F0'
};

const targetFiles = [
  'src/pages/VmChecklist.tsx',
  'src/pages/vm/vmFlowUtils.ts',
  'src/pages/vm/AuditStep.tsx',
  'src/pages/vm/FloorStep.tsx',
  'src/pages/vm/SectionStep.tsx',
  'src/pages/vm/ReviewStep.tsx',
  'src/pages/vm/HistoryStep.tsx',
  'src/pages/vm/PhotoLightbox.tsx',
  'src/pages/vm/PhotoUploader.tsx',
  'src/pages/vm/CreateFloorModal.tsx',
  'src/pages/vm/StepIndicator.tsx',
  'src/pages/vm/VmPrimitives.tsx',
  'src/pages/DojDesk.tsx',
  'src/pages/footfall/FootfallBadges.tsx',
  'src/components/ui/ChangePasswordModal.tsx',
  'src/components/ui/QuickActionCenter.tsx'
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
