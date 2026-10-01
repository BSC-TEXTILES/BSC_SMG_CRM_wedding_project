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
  'src/pages/wedding/pipeline/TodaysWorkPanel.tsx',
  'src/pages/wedding/pipeline/PipelineFilters.tsx',
  'src/pages/wedding/pipeline/OverdueFollowUps.tsx',
  'src/pages/wedding/pipeline/PipelineCard.tsx',
  'src/pages/wedding/weddingTypes.ts',
  'src/pages/wedding/WeddingCrmDashboard.tsx',
  'src/pages/wedding/WeddingCustomerRegister.tsx',
  'src/pages/wedding/WeddingCustomerCreate.tsx',
  'src/pages/wedding/WeddingCustomerDetail.tsx',
  'src/pages/wedding/WeddingCallHistory.tsx',
  'src/pages/wedding/WeddingFollowUpCalendar.tsx',
  'src/pages/wedding/WeddingStatusBoard.tsx',
  'src/pages/wedding/WeddingReports.tsx',
  'src/pages/wedding/WeddingImport.tsx',
  'src/pages/wedding/WeddingOldCustomers.tsx',
  'src/pages/wedding/TelecallerDeskPage.tsx',
  'src/components/wedding/TellCallerModal.tsx',
  'src/components/wedding/TelecallerInbox.tsx',
  'src/components/wedding/WeddingCustomerFlowModal.tsx'
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
