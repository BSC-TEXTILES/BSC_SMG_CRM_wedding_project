'use strict';

/**
 * Wedding CRM — Bulk import template + error report generators.
 *
 * Single source of truth for:
 *   1. The .xlsx import template (BSC_Wedding_Customers_Template.xlsx)
 *   2. The legacy .csv import template (UTF-8 with BOM)
 *   3. The post-import error report .xlsx
 *
 * Column order, header names and formats here are mirrored by
 * weddingController.importCsv (parser) and WeddingImport.tsx (UI legend).
 */

const ExcelJS = require('exceljs');

const TEMPLATE_FILENAME = 'BSC_Wedding_Customers_Template.xlsx';
const TEMPLATE_FILENAME_CSV = 'BSC_Wedding_Customers_Template.csv';
const ERROR_REPORT_FILENAME = 'BSC_Wedding_Import_Errors.xlsx';

const MAX_IMPORT_ROWS = 5000;
const FIRST_DATA_ROW = 2;
const LAST_DATA_ROW = FIRST_DATA_ROW + MAX_IMPORT_ROWS - 1; // row 5001

const COLORS = {
  required: 'FFC00000',
  requiredEdge: 'FF7F1D1D',
  optional: 'FF548235',
  optionalEdge: 'FF375623',
  sampleFill: 'FFF2F2F2',
  sampleFont: 'FF595959',
  border: 'FFBFBFBF',
  gridBorder: 'FFD9D9D9',
  title: 'FF1F3864',
  heading: 'FF2F5597',
  text: 'FF1A1A1A',
  muted: 'FF666666',
  white: 'FFFFFFFF',
  requiredLight: 'FFFCE4E4',
  optionalLight: 'FFEAF3E3',
  errorFill: 'FFFFF2F2',
  warnFill: 'FFFFF7E6'
};

/**
 * Template columns — display name == database column name (aliases accepted on import).
 *
 * required  : red header, mandatory for a row to be imported
 * numFmt    : Excel column number format
 * type      : drives data validation + instructions text
 * note      : hover comment attached to the header cell
 * aliases   : other header spellings the importer accepts (legacy templates / prompt names)
 */
const COLUMNS = [
  {
    header: 'customer_name',
    required: true,
    width: 26,
    type: 'text',
    example: 'Ananya Hegde',
    description: 'Full name of the bride / groom / customer being registered (max 150 characters).',
    note: 'REQUIRED. Full name of the bride / groom / customer (max 150 characters).',
    aliases: ['name', 'customer', 'customername', 'bride_groom_name']
  },
  {
    header: 'mobile_number',
    required: true,
    width: 18,
    type: 'mobile',
    numFmt: '@',
    example: '9845012345',
    description: '10-digit Indian mobile number starting with 6, 7, 8 or 9. Used as the duplicate key.',
    note: 'REQUIRED. 10 digits, starts 6-9. Stored as text so leading digits are never lost. Duplicates are skipped.',
    aliases: ['mobile', 'phone', 'contact', 'phone_number', 'moble_number']
  },
  {
    header: 'alternate_mobile',
    required: false,
    width: 18,
    type: 'mobile',
    numFmt: '@',
    example: '9845099999',
    description: 'Optional secondary contact number (same 10-digit format).',
    note: 'OPTIONAL. Secondary contact number (10 digits, starts 6-9).',
    aliases: ['alternate_number', 'alt_phone', 'alternate_phone', 'alt_mobile']
  },
  {
    header: 'email',
    required: false,
    width: 30,
    type: 'email',
    example: 'ananya.hegde@example.com',
    description: 'Optional e-mail address. Invalid addresses are stored as blank.',
    note: 'OPTIONAL. Valid e-mail address, e.g. name@example.com',
    aliases: ['email_id', 'mail']
  },
  {
    header: 'wedding_date',
    required: false,
    width: 15,
    type: 'date',
    numFmt: 'dd-mm-yyyy',
    example: '15-05-2025',
    description: 'Date of the wedding — dd-mm-yyyy (also accepts yyyy-mm-dd).',
    note: 'OPTIONAL. Wedding date in dd-mm-yyyy format (yyyy-mm-dd also accepted).',
    aliases: ['marriage_date', 'weddingdate', 'wedding']
  },
  {
    header: 'expected_shopping_date',
    required: false,
    width: 21,
    type: 'date',
    numFmt: 'dd-mm-yyyy',
    example: '20-04-2025',
    description: 'When the family is expected to shop. Left blank it is derived (15 days before the wedding).',
    note: 'OPTIONAL. Expected store visit / shopping date (dd-mm-yyyy). Auto-derived from wedding_date when blank.',
    aliases: ['expected_visit_date', 'expected_date', 'shopping_date', 'shop_date', 'shopeing_date', 'shoppingdate', 'expected_shopping']
  },
  {
    header: 'preferred_shopping_category',
    required: false,
    width: 32,
    type: 'list',
    example: 'Bridal Lehengas',
    description: 'Collection the family is interested in — pick from the drop-down list.',
    note: 'OPTIONAL. Choose a collection from the drop-down list (list is filled from the CRM database).',
    aliases: ['preferred_collection', 'category', 'shopping_category', 'preferred_category']
  },
  {
    header: 'estimated_family_size',
    required: false,
    width: 21,
    type: 'whole',
    example: '4',
    description: 'Number of family members expected to shop (1 - 50).',
    note: 'OPTIONAL. Expected number of shoppers (whole number between 1 and 50).',
    aliases: ['estimated_members', 'family_size', 'estimated_family', 'familysize']
  },
  {
    header: 'budget_min',
    required: false,
    width: 15,
    type: 'currency',
    numFmt: '"₹"#,##,##0',
    example: '75000',
    description: 'Lower end of the expected budget in rupees (numbers only, no commas).',
    note: 'OPTIONAL. Lower budget limit in rupees (numbers only, e.g. 75000).',
    aliases: []
  },
  {
    header: 'budget_max',
    required: false,
    width: 15,
    type: 'currency',
    numFmt: '"₹"#,##,##0',
    example: '150000',
    description: 'Upper end of the expected budget in rupees (must be >= budget_min).',
    note: 'OPTIONAL. Upper budget limit in rupees (numbers only, e.g. 150000).',
    aliases: []
  },
  {
    header: 'assigned_telecaller',
    required: false,
    width: 24,
    type: 'list',
    example: 'Pooja Sharma',
    description: 'Telecaller who owns this customer — pick from the drop-down list.',
    note: 'OPTIONAL. Telecaller assigned to this customer (drop-down is filled from active CRM users).',
    aliases: ['telecaller', 'assigned_to', 'caller']
  },
  {
    header: 'customer_notes',
    required: false,
    width: 46,
    type: 'text',
    example: 'Interested in pure zari wedding collection',
    description: 'Free text remarks, requirements or wishes for the customer.',
    note: 'OPTIONAL. Any remarks, requirements or wishes for this customer.',
    aliases: ['notes', 'remarks', 'comments', 'customernotes', 'additional_notes']
  }
];

/**
 * Header alias map used by the importer:
 *   canonical header -> every spelling accepted for it
 * Legacy single-column templates (budget / store_location / followup_call_date)
 * are also understood but are not part of the new template.
 */
const HEADER_ALIASES = (() => {
  const map = {};
  COLUMNS.forEach((col) => {
    map[col.header] = [col.header, ...(col.aliases || [])];
  });
  // Legacy / alternate headers that are still accepted on upload
  map.budget = ['budget', 'budget_range', 'shopping_budget'];
  map.store_location = ['store_location', 'location', 'store', 'branch'];
  map.followup_call_date = [
    'followup_call_date',
    'follow_up_call_date',
    'follwup_call_date',
    'follwup_date',
    'follow_up_date',
    'followup_date',
    'next_follow_up_date',
    'next_followup_date',
    'follow_up',
    'call_date'
  ];
  return map;
})();

const DEFAULT_CATEGORIES = [
  'Bridal Lehengas',
  'Pure Silk Sarees',
  'Bridal Kanjeevaram Silk Sarees',
  'Designer Lehengas & Sherwanis',
  'Sherwanis & Suits',
  'Family Matching Sets',
  'Family Silk & Festive Wear',
  'Wedding Shopping'
];

/** 3 sample rows (grey + italic) — the user deletes them before importing. */
function sampleRows(telecallers = []) {
  const tc = telecallers[0] || '';
  return [
    {
      customer_name: 'Ananya Hegde',
      mobile_number: '9845012345',
      alternate_mobile: '9845099999',
      email: 'ananya.hegde@example.com',
      wedding_date: new Date(2025, 4, 15),
      expected_shopping_date: new Date(2025, 3, 20),
      preferred_shopping_category: 'Bridal Lehengas',
      estimated_family_size: 4,
      budget_min: 75000,
      budget_max: 150000,
      assigned_telecaller: tc,
      customer_notes: 'Interested in pure zari wedding collection'
    },
    {
      customer_name: 'Pooja Patil',
      mobile_number: '9880198765',
      alternate_mobile: '',
      email: 'pooja.patil@example.com',
      wedding_date: new Date(2025, 5, 10),
      expected_shopping_date: new Date(2025, 4, 15),
      preferred_shopping_category: 'Bridal Lehengas',
      estimated_family_size: 6,
      budget_min: 100000,
      budget_max: 250000,
      assigned_telecaller: '',
      customer_notes: 'Looking for designer lehengas and matching family sets'
    },
    {
      customer_name: 'Kavya Suresh',
      mobile_number: '9741234567',
      alternate_mobile: '',
      email: '',
      wedding_date: new Date(2025, 6, 22),
      expected_shopping_date: new Date(2025, 5, 25),
      preferred_shopping_category: 'Family Matching Sets',
      estimated_family_size: 8,
      budget_min: 50000,
      budget_max: 100000,
      assigned_telecaller: '',
      customer_notes: 'Family wedding shopping for 10 members'
    }
  ];
}

function thinBorder(style = 'thin', color = COLORS.gridBorder) {
  const side = { style, color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

/**
 * Guard against spreadsheet formula injection when a cell value
 * originates from user input (error report / exports).
 */
function sanitizeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) return `'${str}`;
  return str;
}

function csvEscape(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Instructions sheet (Sheet 2)
// ─────────────────────────────────────────────────────────────────────────────
function addInstructionsSheet(workbook, categories, telecallers) {
  const ws = workbook.addWorksheet('Instructions', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 34 }, { width: 30 }, { width: 30 }, { width: 44 }, { width: 46 }];

  const rows = [];
  const push = (kind, ...cells) => rows.push({ kind, cells });

  push('title', 'BSC WEDDING CUSTOMERS — BULK IMPORT TEMPLATE');
  push('subtitle', 'Read this sheet before filling Sheet 1 ("Wedding_Customers_Template").');
  push('blank');

  push('heading', '1. HOW TO USE THIS FILE');
  push('text', '1. Open Sheet 1 "Wedding_Customers_Template" and delete the 3 grey sample rows (rows 2-4).');
  push('text', '2. Paste your customer data starting from row 2, keeping the header row (row 1) unchanged.');
  push('text', `3. Save as .xlsx (File > Save As > Excel Workbook). Maximum ${MAX_IMPORT_ROWS} data rows per file.`);
  push('text', '4. Go to Wedding CRM > Import Customers, choose your store location, upload the file and click Start Bulk Import.');
  push('text', '5. Download the error report after the run, fix the listed rows and re-upload only those rows.');
  push('blank');

  push('heading', '2. COLOUR LEGEND (SHEET 1)');
  push('legendRequired', 'RED header', 'Mandatory — a row without it is reported as an error.');
  push('legendOptional', 'GREEN header', 'Optional — the row imports fine when the cell is blank.');
  push('legendSample', 'GREY italic rows', 'Sample data only — delete them before importing.');
  push('blank');

  push('heading', '3. COLUMN REFERENCE');
  push('colhead', 'Column', 'Required', 'Excel format', 'What to enter', 'Also accepted as (legacy header)');
  COLUMNS.forEach((col) => {
    const fmt = col.numFmt === '@'
      ? 'Text (@)'
      : col.numFmt === 'dd-mm-yyyy'
        ? 'Date (dd-mm-yyyy)'
        : col.numFmt
          ? 'Currency / number'
          : col.type === 'whole'
            ? 'Whole number'
            : 'General';
    push(
      'col',
      col.header,
      col.required ? 'REQUIRED' : 'Optional',
      fmt,
      col.description,
      (col.aliases || []).length ? col.aliases.join(', ') : '—'
    );
  });
  push('col', 'budget (legacy)', 'Optional', 'Text', 'Accepted for older templates — stored as the budget range.', 'budget, budget_range, shopping_budget');
  push('col', 'store_location (legacy)', 'Optional', 'Text', 'Older templates only. The store is now selected on the import screen.', 'store_location, location, store, branch');
  push('col', 'followup_call_date (legacy)', 'Optional', 'Date', 'Older templates only — defaults to today when blank.', 'followup_call_date, follow_up_date');
  push('blank');

  push('heading', '4. VALIDATION RULES');
  push('text', '• mobile_number / alternate_mobile: exactly 10 digits, first digit 6-9. +91, spaces and dashes are stripped automatically.');
  push('text', '• wedding_date / expected_shopping_date: dd-mm-yyyy (yyyy-mm-dd and d/m/yyyy are also accepted).');
  push('text', '• estimated_family_size: whole number between 1 and 50.');
  push('text', '• budget_min / budget_max: numbers only (75000, not 75,000 or 75000/-). budget_max should be >= budget_min.');
  push('text', '• preferred_shopping_category and assigned_telecaller have drop-downs; typing a new value shows a confirmation prompt.');
  push('text', '• Any cell starting with =, +, - or @ is treated as text, never as a formula.');
  push('blank');

  push('heading', '5. DUPLICATES');
  push('text', '• A mobile number that already exists in the CRM is skipped and listed in the error report (with the existing customer code).');
  push('text', '• The same mobile number repeated inside one file is imported once; the later rows are skipped.');
  push('text', '• Skipped rows never delete or overwrite existing customers.');
  push('blank');

  push('heading', '6. STORE LOCATION');
  push('text', '• The store is chosen on the import screen, not inside the file. Every row is imported into that store.');
  push('text', '• Users with a single assigned store cannot import into any other branch.');
  push('blank');

  push('heading', '7. FILE TYPES & LIMITS');
  push('text', '• Accepted: .xlsx (recommended) and .csv saved as UTF-8.');
  push('text', '• Legacy .xls must be re-saved as .xlsx (File > Save As) before uploading.');
  push('text', `• Maximum file size 10 MB, maximum ${MAX_IMPORT_ROWS} data rows per import.`);
  push('blank');

  push('heading', '8. DROPDOWN VALUES CURRENTLY IN THE CRM');
  push('text', `Collections: ${(categories || []).join(', ')}`);
  push('text', `Telecallers: ${(telecallers || []).length ? telecallers.join(', ') : 'None active — leave the column blank'}`);
  push('blank');
  push('text', `Generated by BSC Textiles Wedding Concierge — ${new Date().toLocaleString('en-IN')}`);

  rows.forEach((row, idx) => {
    const r = ws.addRow(row.cells);
    const line = idx + 1;
    switch (row.kind) {
      case 'title':
        r.height = 30;
        ws.mergeCells(line, 1, line, 5);
        r.getCell(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.white } };
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.title } };
        r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        break;
      case 'subtitle':
        ws.mergeCells(line, 1, line, 5);
        r.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.muted } };
        r.getCell(1).alignment = { vertical: 'middle', indent: 1 };
        break;
      case 'heading':
        r.height = 22;
        ws.mergeCells(line, 1, line, 5);
        r.getCell(1).font = { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.white } };
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.heading } };
        r.getCell(1).alignment = { vertical: 'middle', indent: 1 };
        break;
      case 'text':
        ws.mergeCells(line, 1, line, 5);
        r.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: COLORS.text } };
        r.getCell(1).alignment = { vertical: 'top', wrapText: true, indent: 1 };
        break;
      case 'legendRequired':
      case 'legendOptional':
      case 'legendSample': {
        const fill = row.kind === 'legendRequired' ? COLORS.required
          : row.kind === 'legendOptional' ? COLORS.optional : COLORS.sampleFill;
        r.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } };
        r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
        r.getCell(1).border = thinBorder();
        r.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: COLORS.text } };
        ws.mergeCells(line, 2, line, 5);
        break;
      }
      case 'colhead':
        r.height = 24;
        for (let c = 1; c <= 5; c++) {
          const cell = r.getCell(c);
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.title } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = thinBorder();
        }
        break;
      case 'col': {
        r.height = 30;
        for (let c = 1; c <= 5; c++) {
          const cell = r.getCell(c);
          cell.font = {
            name: c === 1 ? 'Consolas' : 'Calibri',
            size: 10,
            bold: c === 1,
            color: { argb: c === 2 && row.cells[1] === 'REQUIRED' ? COLORS.required : COLORS.text }
          };
          cell.alignment = { vertical: 'top', wrapText: true, horizontal: c === 2 ? 'center' : 'left' };
          cell.border = thinBorder();
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: c === 2 && row.cells[1] === 'REQUIRED' ? COLORS.requiredLight : COLORS.white }
          };
        }
        break;
      }
      default:
        break;
    }
  });

  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hidden helper sheet feeding the drop-downs
// ─────────────────────────────────────────────────────────────────────────────
function addListsSheet(workbook, categories, telecallers) {
  const ws = workbook.addWorksheet('_Lists', { state: 'veryHidden' });
  ws.getCell('A1').value = 'Collections';
  ws.getCell('B1').value = 'Telecallers';
  ws.getRow(1).font = { bold: true };
  categories.forEach((value, idx) => {
    ws.getCell(idx + 2, 1).value = value;
  });
  telecallers.forEach((value, idx) => {
    ws.getCell(idx + 2, 2).value = value;
  });
  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the .xlsx template workbook.
 * @param {object} options
 * @param {string[]} options.categories - distinct preferred_shopping_category values
 * @param {string[]} options.telecallers - active telecaller display names
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function buildTemplateWorkbook({ categories = [], telecallers = [] } = {}) {
  const cats = Array.from(new Set([...DEFAULT_CATEGORIES, ...categories].filter(Boolean))).slice(0, 60);
  const tels = Array.from(new Set((telecallers || []).filter(Boolean))).slice(0, 100);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BSC Textiles — Wedding Concierge';
  workbook.lastModifiedBy = 'BSC Textiles — Wedding Concierge';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = 'BSC Textiles';
  workbook.title = 'Wedding Customers Import Template';

  const ws = workbook.addWorksheet('Wedding_Customers_Template', {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: true }]
  });

  ws.columns = COLUMNS.map((col) => ({
    header: col.header,
    key: col.header,
    width: col.width,
    style: col.numFmt ? { numFmt: col.numFmt } : undefined
  }));

  // Freeze the header row + auto filter
  ws.views = [{ state: 'frozen', ySplit: 1, activeCell: 'A2' }];
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: COLUMNS.length }
  };

  // Header row: RED = required, GREEN = optional
  const headerRow = ws.getRow(1);
  headerRow.height = 34;
  COLUMNS.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    const fill = col.required ? COLORS.required : COLORS.optional;
    const edge = col.required ? COLORS.requiredEdge : COLORS.optionalEdge;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: edge } },
      left: { style: 'thin', color: { argb: COLORS.white } },
      bottom: { style: 'medium', color: { argb: edge } },
      right: { style: 'thin', color: { argb: COLORS.white } }
    };
    cell.note = {
      texts: [
        { font: { size: 10, bold: true }, text: `${col.header}${col.required ? ' (REQUIRED)' : ' (optional)'}\n` },
        { font: { size: 9 }, text: col.note }
      ]
    };
  });

  // Sample rows (rows 2-4): grey fill, italic text
  const samples = sampleRows(tels);
  samples.forEach((data, idx) => {
    const row = ws.getRow(FIRST_DATA_ROW + idx);
    row.height = 20;
    COLUMNS.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = data[col.header] !== undefined ? data[col.header] : null;
      if (col.numFmt) cell.numFmt = col.numFmt;
      cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.sampleFont } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sampleFill } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: ['mobile_number', 'alternate_mobile', 'wedding_date', 'expected_shopping_date',
          'estimated_family_size', 'budget_min', 'budget_max'].includes(col.header) ? 'center' : 'left'
      };
      cell.border = thinBorder('thin', COLORS.border);
    });
  });

  // Data validation (rows 2 .. 5001)
  const mobileFormula = 'AND(LEN(TRIM({col}2))=10,ISNUMBER(VALUE(TRIM({col}2))),LEFT(TRIM({col}2),1)>="6",LEFT(TRIM({col}2),1)<="9")';
  const addValidation = (range, rule) => {
    ws.dataValidations.add(range, {
      allowBlank: true,
      showInputMessage: true,
      showErrorMessage: true,
      ...rule
    });
  };

  const colLetter = (idx) => {
    let n = idx;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  const colIndex = (header) => COLUMNS.findIndex((c) => c.header === header) + 1;
  const rangeFor = (header) => {
    const letter = colLetter(colIndex(header));
    return `${letter}${FIRST_DATA_ROW}:${letter}${LAST_DATA_ROW}`;
  };

  ['mobile_number', 'alternate_mobile'].forEach((header) => {
    const letter = colLetter(colIndex(header));
    addValidation(rangeFor(header), {
      type: 'custom',
      formulae: [mobileFormula.replace(/\{col\}/g, letter)],
      promptTitle: header === 'mobile_number' ? 'Mobile number' : 'Alternate mobile',
      prompt: 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.',
      errorTitle: 'Invalid mobile number',
      error: 'Enter exactly 10 digits starting with 6, 7, 8 or 9 (no +91, spaces or dashes).',
      errorStyle: 'stop'
    });
  });

  ['wedding_date', 'expected_shopping_date'].forEach((header) => {
    addValidation(rangeFor(header), {
      type: 'date',
      operator: 'between',
      formulae: [new Date(2020, 0, 1), new Date(2035, 11, 31)],
      promptTitle: 'Date format',
      prompt: 'Enter a date in dd-mm-yyyy format between 2020 and 2035.',
      errorTitle: 'Invalid date',
      error: 'Enter a valid date between 01-01-2020 and 31-12-2035 (dd-mm-yyyy).',
      errorStyle: 'stop'
    });
  });

  addValidation(rangeFor('estimated_family_size'), {
    type: 'whole',
    operator: 'between',
    formulae: ['1', '50'],
    promptTitle: 'Family size',
    prompt: 'Number of family members expected to shop (1 - 50).',
    errorTitle: 'Invalid family size',
    error: 'Enter a whole number between 1 and 50.',
    errorStyle: 'stop'
  });

  ['budget_min', 'budget_max'].forEach((header) => {
    addValidation(rangeFor(header), {
      type: 'decimal',
      operator: 'greaterThan',
      formulae: ['0'],
      promptTitle: 'Budget (₹)',
      prompt: 'Enter the amount in rupees using digits only, e.g. 75000.',
      errorTitle: 'Invalid budget',
      error: 'Enter a positive amount using digits only, e.g. 75000.',
      errorStyle: 'stop'
    });
  });

  addValidation(rangeFor('preferred_shopping_category'), {
    type: 'list',
    formulae: ['CollectionOptions'],
    promptTitle: 'Collection',
    prompt: 'Choose a collection from the list, or type a new one and confirm.',
    errorTitle: 'Collection not in list',
    error: 'Pick a value from the list, or type a new collection and click Yes to keep it.',
    errorStyle: 'warning'
  });

  addValidation(rangeFor('assigned_telecaller'), {
    type: 'list',
    formulae: ['TelecallerOptions'],
    promptTitle: 'Assigned telecaller',
    prompt: 'Choose an active telecaller from the list.',
    errorTitle: 'Telecaller not in list',
    error: 'Pick a telecaller from the list, or type a new name and click Yes to keep it.',
    errorStyle: 'warning'
  });

  // Instructions must be Sheet 2 — the hidden "_Lists" sheet is appended last
  addInstructionsSheet(workbook, cats, tels);

  // Helper sheet + workbook-level names feeding the two drop-downs
  addListsSheet(workbook, cats, tels);
  const categoryLast = Math.max(cats.length + 1, 2);
  const telecallerLast = Math.max(tels.length + 1, 2);
  workbook.definedNames.add(`_Lists!$A$2:$A$${categoryLast}`, 'CollectionOptions');
  workbook.definedNames.add(`_Lists!$B$2:$B$${telecallerLast}`, 'TelecallerOptions');

  return workbook;
}

/**
 * CSV template (UTF-8 BOM) — same columns & sample rows as the .xlsx.
 */
function buildTemplateCsv({ telecallers = [] } = {}) {
  const samples = sampleRows(telecallers);
  const lines = [COLUMNS.map((c) => c.header).join(',')];
  samples.forEach((row) => {
    lines.push(COLUMNS.map((col) => {
      const value = row[col.header];
      if (col.type === 'date') return csvEscape(csvDate(value));
      if (col.type === 'mobile' && value) return `="${value}"`; // keep as text in Excel
      if (value === undefined || value === null) return '';
      return csvEscape(value);
    }).join(','));
  });
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * Post-import error report workbook.
 * @param {object} payload
 * @param {string} payload.fileName - uploaded file name
 * @param {string} payload.summary - "X customers imported, Y duplicates skipped, Z errors."
 * @param {Array<{row:number,customerName?:string,mobile?:string,reason:string}>} payload.errors
 * @param {object} payload.counts - { imported, duplicates, errors, totalRows }
 */
function buildErrorReportWorkbook({ fileName = '', summary = '', errors = [], counts = {} } = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BSC Textiles — Wedding Concierge';
  workbook.created = new Date();
  workbook.title = 'Wedding Customer Import — Error Report';

  const ws = workbook.addWorksheet('Import_Errors', { views: [{ showGridLines: true }] });
  ws.columns = [
    { header: 'Row', key: 'row', width: 8 },
    { header: 'customer_name', key: 'customer_name', width: 26 },
    { header: 'mobile_number', key: 'mobile_number', width: 16 },
    { header: 'Problem & how to fix', key: 'reason', width: 90 },
    { header: 'Status', key: 'status', width: 16 }
  ];

  ws.mergeCells('A1:E1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'BSC WEDDING CUSTOMERS — IMPORT ERROR REPORT';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.title } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 28;

  const meta = [
    ['Source file', sanitizeCell(fileName)],
    ['Run summary', sanitizeCell(summary)],
    ['Imported', counts.imported ?? 0],
    ['Duplicates skipped', counts.duplicates ?? 0],
    ['Errors', counts.errors ?? errors.length],
    ['Generated', new Date().toLocaleString('en-IN')],
    ['Next step', 'Fix the rows listed below in the original file, then upload only those rows again.']
  ];
  meta.forEach(([label, value], idx) => {
    const row = ws.getRow(idx + 2);
    row.values = [label, value];
    ws.mergeCells(idx + 2, 2, idx + 2, 5);
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.text } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDF2F9' } };
    row.getCell(1).alignment = { vertical: 'middle', indent: 1 };
    row.getCell(1).border = thinBorder();
    row.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: COLORS.text } };
    row.getCell(2).alignment = { vertical: 'middle', wrapText: true, indent: 1 };
    row.getCell(2).border = thinBorder();
  });

  const headerRowIndex = meta.length + 3;
  const headerRow = ws.getRow(headerRowIndex);
  ['Row', 'customer_name', 'mobile_number', 'Problem & how to fix', 'Status'].forEach((text, cIdx) => {
    const cell = headerRow.getCell(cIdx + 1);
    cell.value = text;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.required } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder();
  });
  headerRow.height = 22;

  const capped = errors.slice(0, MAX_IMPORT_ROWS);
  capped.forEach((err, idx) => {
    const row = ws.addRow([
      err.row || '',
      sanitizeCell(err.customerName),
      sanitizeCell(err.mobile),
      sanitizeCell(err.reason),
      /duplicate/i.test(String(err.reason || '')) ? 'Duplicate — skip' : 'Fix & re-upload'
    ]);
    row.height = 18;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: colNumber === 1 || colNumber === 3 ? 'Consolas' : 'Calibri', size: 10, color: { argb: COLORS.text } };
      cell.alignment = { vertical: 'middle', wrapText: colNumber === 4, horizontal: colNumber === 1 ? 'center' : 'left' };
      cell.border = thinBorder();
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? COLORS.white : COLORS.errorFill }
      };
    });
    row.getCell(5).font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: /duplicate/i.test(String(err.reason || '')) ? 'FFB26A00' : COLORS.required }
    };
  });

  if (errors.length > capped.length) {
    ws.addRow([`… ${errors.length - capped.length} more rows truncated`]);
  }

  ws.views = [{ state: 'frozen', ySplit: headerRowIndex, activeCell: `A${headerRowIndex + 1}` }];
  ws.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: 5 }
  };

  const info = workbook.addWorksheet('Instructions', { views: [{ showGridLines: false }] });
  info.columns = [{ width: 110 }];
  [
    'HOW TO USE THIS ERROR REPORT',
    '',
    '1. Every row listed on the "Import_Errors" sheet was NOT imported.',
    '2. Open your original import file and correct the highlighted rows (match the "Row" number to the row in your file).',
    '3. Duplicates are informational only — that mobile number already exists in the CRM. Do not re-upload those rows.',
    '4. Rows marked "Fix & re-upload" failed validation (mobile, date, name, budget or a database error).',
    '5. Delete the rows that imported successfully, then upload the corrected file again.',
    '6. Only corrected rows are processed again — already imported customers are never duplicated.',
    '',
    'Common fixes:',
    '• mobile_number must be exactly 10 digits starting with 6, 7, 8 or 9.',
    '• Dates must be dd-mm-yyyy (yyyy-mm-dd also accepted).',
    '• customer_name must not be empty.',
    '• budget_min / budget_max must contain digits only (75000 — not 75,000 or ₹75,000).',
    '• File must contain the customer_name and mobile_number header columns.'
  ].forEach((text, idx) => {
    const row = info.addRow([text]);
    row.getCell(1).font = idx === 0
      ? { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.white } }
      : { name: 'Calibri', size: 10, color: { argb: COLORS.text } };
    if (idx === 0) {
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.title } };
      row.height = 26;
    }
    row.getCell(1).alignment = { vertical: 'middle', wrapText: true, indent: 1 };
  });

  return workbook;
}

module.exports = {
  TEMPLATE_FILENAME,
  TEMPLATE_FILENAME_CSV,
  ERROR_REPORT_FILENAME,
  MAX_IMPORT_ROWS,
  FIRST_DATA_ROW,
  LAST_DATA_ROW,
  COLUMNS,
  HEADER_ALIASES,
  DEFAULT_CATEGORIES,
  buildTemplateWorkbook,
  buildTemplateCsv,
  buildErrorReportWorkbook,
  sanitizeCell
};
