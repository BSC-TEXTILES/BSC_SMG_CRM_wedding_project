const multer = require('multer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const securityLogger = require('../security/securityLogger');

dotenv.config({ path: path.join(__dirname, '../../../.env') });

let uploadDir = process.env.UPLOAD_DIR;

if (!uploadDir) {
  uploadDir = path.join(__dirname, '../../../uploads'); // 1 level above BSC-Candidate-Followup-main
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    // Fallback to local uploads if parent is not writable
    uploadDir = path.join(__dirname, '../../uploads'); // hrms-system/uploads
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  }
} else {
  try {
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    uploadDir = path.join(__dirname, '../../uploads');
    try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); } catch (err) {}
  }
}

const subdirs = [
  'applicants',
  'candidate-resumes',
  'candidate-photos',
  'employee-documents',
  'offer-letters',
  'relieving-letters',
  'experience-certificates',
  'mcheck-photos',
  'misc'
];

subdirs.forEach((dir) => {
  try {
    const fullPath = path.join(uploadDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  } catch (e) {}
});

// Dangerous double extension pattern to prevent disguised executable uploads
const DANGEROUS_DOUBLE_EXT = /\.(php|phtml|phar|exe|sh|bat|cmd|vbs|js|py|cgi|pl|jsp|asp|aspx)\./i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let appNoRaw = req.headers['x-app-no'] || req.body.appNo || req.query.appNo;
    // Strict alphanumeric sanitization to prevent path traversal
    let cleanAppNo = appNoRaw && appNoRaw !== 'undefined' && appNoRaw !== 'null'
      ? String(appNoRaw).replace(/[^a-zA-Z0-9_-]/g, '').trim()
      : null;
    
    if (cleanAppNo) {
      // Structure: /uploads/applicants/BSC-2026-0001
      const applicantDir = path.join(uploadDir, 'applicants', cleanAppNo);
      if (!fs.existsSync(applicantDir)) {
        fs.mkdirSync(applicantDir, { recursive: true });
      }
      cb(null, applicantDir);
    } else {
      // Backward compatibility / Misc uploads if no appNo
      let dest = 'misc';
      if (file.fieldname === 'resume') dest = 'candidate-resumes';
      else if (file.fieldname === 'photo') dest = 'candidate-photos';
      else if (file.fieldname === 'document' || file.fieldname === 'aadhar' || file.fieldname === 'pan') dest = 'employee-documents';
      else if (file.fieldname === 'offerLetter') dest = 'offer-letters';
      else if (file.fieldname === 'relievingLetter') dest = 'relieving-letters';
      else if (file.fieldname === 'experienceCert') dest = 'experience-certificates';
      else if (file.fieldname === 'photo' && (req.baseUrl.includes('mcheck') || req.path.includes('mcheck'))) dest = 'mcheck-photos';
      cb(null, path.join(uploadDir, dest));
    }
  },
  filename: (req, file, cb) => {
    let rawName = (req.body && (req.body.name || req.body.candidateName || req.body.candName)) || '';
    if (!rawName && req.headers && req.headers['x-candidate-name']) {
      try { rawName = decodeURIComponent(req.headers['x-candidate-name']); } catch(e) {}
    }
    if (!rawName && req.query && req.query.name) {
      rawName = req.query.name;
    }
    const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, '');
    const prefixName = cleanName ? cleanName : 'Candidate';

    let appNoRaw = req.headers['x-app-no'] || req.body.appNo || req.query.appNo;
    let cleanAppNo = appNoRaw && appNoRaw !== 'undefined' && appNoRaw !== 'null'
      ? String(appNoRaw).replace(/[^a-zA-Z0-9_-]/g, '').trim()
      : null;
    const prefix = cleanAppNo ? `${cleanAppNo}_${prefixName}` : prefixName;

    let docType = 'Document';
    if (file.fieldname === 'photo') docType = 'Photo';
    else if (file.fieldname === 'aadhar' || file.fieldname === 'aadhaar' || file.fieldname === 'document') docType = 'Aadhaar';
    else if (file.fieldname === 'resume') docType = 'Resume';
    else if (file.fieldname === 'offerLetter') docType = 'OfferLetter';
    else if (file.fieldname === 'relievingLetter') docType = 'RelievingLetter';
    else if (file.fieldname === 'experienceCert') docType = 'ExperienceCert';

    const originalName = file.originalname || 'unknown.file';
    let ext = path.extname(originalName).toLowerCase() || '.jpg';
    if (!['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'].includes(ext)) {
      ext = '.jpg';
    }

    const baseFileName = `${prefix}_${docType}`;
    // Prevent path traversal and arbitrary file overwrite by randomizing filename
    const uuid = require('crypto').randomBytes(16).toString('hex');
    const safeBaseName = baseFileName.replace(/[^a-zA-Z0-9_-]/g, '');
    const finalFileName = `${safeBaseName}_${uuid}${ext}`;

    cb(null, finalFileName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ];
  
  const originalName = file.originalname || '';
  const ext = path.extname(originalName).toLowerCase();

  // 1. Block dangerous double extensions
  if (DANGEROUS_DOUBLE_EXT.test(originalName)) {
    securityLogger.log('UPLOAD_DOUBLE_EXTENSION_BLOCKED', req, { originalName });
    return cb(new Error('File rejected: Disallowed double file extension pattern.'));
  }

  // 2. Extension and MIME type verification
  if (allowedExts.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    securityLogger.log('UPLOAD_FORMAT_REJECTED', req, { originalName, ext, mime: file.mimetype });
    cb(new Error(`Invalid file format: ${ext} or mimetype: ${file.mimetype}. Allowed formats: PDF, DOC, DOCX, JPG, JPEG, PNG.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 800 * 1024 } // 800KB max document limit strictly enforced
});

/**
 * Post-upload magic bytes / file signature validation middleware.
 * Inspects header bytes of saved files to prevent disguised executables.
 */
function verifyUploadedSignatures(req, res, next) {
  const files = [];
  if (req.file) files.push(req.file);
  if (req.files) {
    if (Array.isArray(req.files)) {
      files.push(...req.files);
    } else {
      Object.values(req.files).forEach(fList => {
        if (Array.isArray(fList)) files.push(...fList);
      });
    }
  }

  for (const f of files) {
    if (f && f.path && fs.existsSync(f.path)) {
      try {
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(f.path, 'r');
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        const ext = path.extname(f.originalname || '').toLowerCase();
        let isValid = false;

        if (ext === '.pdf') {
          // PDF begins with %PDF- (0x25 0x50 0x44 0x46)
          isValid = buffer.slice(0, 4).toString('ascii') === '%PDF';
        } else if (ext === '.png') {
          // PNG begins with 89 50 4E 47
          isValid = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
        } else if (ext === '.jpg' || ext === '.jpeg') {
          // JPEG begins with FF D8 FF
          isValid = buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
        } else if (ext === '.doc') {
          // OLE CFB begins with D0 CF 11 E0
          isValid = buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0;
        } else if (ext === '.docx') {
          // PK ZIP begins with 50 4B (0x50 0x4B)
          isValid = buffer[0] === 0x50 && buffer[1] === 0x4B;
        } else {
          isValid = false;
        }

        if (!isValid) {
          try { fs.unlinkSync(f.path); } catch (e) {}
          securityLogger.log('UPLOAD_SIGNATURE_MISMATCH', req, {
            originalName: f.originalname,
            claimedExt: ext
          });
          return res.status(400).json({
            success: false,
            code: 'INVALID_FILE_SIGNATURE',
            message: `The file "${f.originalname}" does not match its declared file signature and was rejected.`
          });
        }
      } catch (readErr) {
        console.warn('[Upload Signature Check Warning]', readErr.message);
      }
    }
  }

  next();
}

upload.verifyUploadedSignatures = verifyUploadedSignatures;

module.exports = upload;
