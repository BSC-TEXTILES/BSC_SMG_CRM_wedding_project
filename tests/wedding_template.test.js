const http = require('http');
const ExcelJS = require('exceljs');

const TEST_BYPASS_HEADERS = {
  'x-test-bypass': 'bsc-test-secret-suite'
};

function get(url) {
  return new Promise((resolve, reject) => {
    const options = new URL(url);
    const reqOptions = {
      hostname: options.hostname,
      port: options.port,
      path: options.pathname + options.search,
      method: 'GET',
      headers: TEST_BYPASS_HEADERS
    };
    http.get(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          buffer: Buffer.concat(chunks)
        });
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- 1. Testing CSV Template Download ---');
  const csvRes = await get('http://localhost:5000/api/wedding-crm/template-csv');
  console.log('Status:', csvRes.statusCode);
  console.log('Content-Type:', csvRes.headers['content-type']);
  console.log('Content-Disposition:', csvRes.headers['content-disposition']);

  if (csvRes.statusCode !== 200) {
    throw new Error('CSV Template endpoint returned ' + csvRes.statusCode);
  }

  const rawText = csvRes.buffer.toString('utf8');
  const hasBom = csvRes.buffer[0] === 0xef && csvRes.buffer[1] === 0xbb && csvRes.buffer[2] === 0xbf;
  console.log('Has UTF-8 BOM:', hasBom);

  const lines = rawText.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  console.log('Row 1 Header:', lines[0]);
  const expectedHeader = 'customer_name,mobile_number,alternate_mobile,email,wedding_date,expected_shopping_date,preferred_shopping_category,estimated_family_size,budget_min,budget_max,assigned_telecaller,customer_notes';
  if (lines[0] !== expectedHeader) {
    throw new Error(`Header mismatch! Expected: ${expectedHeader}, got: ${lines[0]}`);
  }
  console.log('Sample rows count:', lines.length - 1);
  if (lines.length - 1 < 3) {
    throw new Error('Expected at least 3 sample rows');
  }
  console.log('CSV Template Test PASSED!\n');

  console.log('--- 2. Testing XLSX Template Download ---');
  const xlsxRes = await get('http://localhost:5000/api/wedding-crm/template-xlsx');
  console.log('Status:', xlsxRes.statusCode);
  console.log('Content-Type:', xlsxRes.headers['content-type']);
  console.log('Content-Disposition:', xlsxRes.headers['content-disposition']);

  if (xlsxRes.statusCode !== 200) {
    throw new Error('XLSX Template endpoint returned ' + xlsxRes.statusCode);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxRes.buffer);
  const worksheet = workbook.worksheets[0];
  console.log('Worksheet name:', worksheet.name);

  const row1Values = [];
  for (let c = 1; c <= 12; c++) {
    row1Values.push(worksheet.getRow(1).getCell(c).value);
  }
  console.log('Excel Row 1 Headers:', row1Values.join(', '));
  if (row1Values.join(',') !== expectedHeader) {
    throw new Error(`Excel Header mismatch! Got: ${row1Values.join(',')}`);
  }

  // Check color fills
  const reqCell = worksheet.getRow(1).getCell(1); // customer_name (Required)
  const optCell = worksheet.getRow(1).getCell(3); // alternate_mobile (Optional)
  console.log('Required cell fill color:', reqCell.fill?.fgColor?.argb);
  console.log('Optional cell fill color:', optCell.fill?.fgColor?.argb);

  console.log('XLSX Template Test PASSED!\n');

  console.log('ALL TEMPLATE DOWNLOAD TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
