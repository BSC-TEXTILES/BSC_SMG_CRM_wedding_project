import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mapping = {
  // Navy to Forest Green
  '#101C36': '#123C35',
  '#07101F': '#082821',
  '#182033': '#17201D',
  '#687080': '#65716C',
  '#DFDDD7': '#E1DDD3',
  '#F6F4EF': '#F7F5F0',
  '#FAF8F5': '#FFFFFF',
  '#FAF8F3': '#EDF3F0',
  '#8B776A': '#65716C',
  // Old plum/rosegold remnants
  '#4A173A': '#123C35',
  '#6A2853': '#082821',
  '#B76E79': '#C9A45C',
  '#E8D9D4': '#E1DDD3',
  '#E8C7A8': '#E4CB92',
  '#FFF7F2': '#EDF3F0',
  '#FFFAF7': '#F7F5F0',
  '#FFFDFC': '#FFFFFF',
  '#6F5963': '#65716C',
  '#2B1722': '#17201D'
};

const targetFiles = [
  'src/pages/Dashboard.tsx',
  'src/pages/HRDashboard.tsx',
  'src/pages/ManagerDashboard.tsx',
  'src/pages/SystemAdmin.tsx',
  'src/pages/UserManagement.tsx',
  'src/pages/DailyMCheck.tsx',
  'src/pages/FeedbackCollection.tsx',
  'src/pages/FeedbackList.tsx',
  'src/pages/FeedbackQR.tsx',
  'src/pages/FeedbackQRManagement.tsx',
  'src/pages/Footfall.tsx',
  'src/pages/Greeter.tsx',
  'src/pages/TVDisplay.tsx',
  'src/pages/Attendance.tsx',
  'src/pages/Employees.tsx',
  'src/pages/Candidates.tsx',
  'src/pages/SectionAllocation.tsx',
  'src/components/ui/ActivityPanel.tsx',
  'src/components/ui/EmployeeProfileModal.tsx'
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
