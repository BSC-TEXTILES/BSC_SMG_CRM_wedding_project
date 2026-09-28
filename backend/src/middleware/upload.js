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
  'employee-photos',
  'employee-documents',
  'offer-letters',
  'relieving-letters',
  'experience-certificates',
  'mcheck-photos',
  'vm-checklist',
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

const allowedExts = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'];
const allowedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
];

const fileFilter = (req, file, cb) => {
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
    cb(new Error(`Invalid file format: ${ext} or mimetype: ${file.mimetype}. Allowed formats: PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 800 * 1024 } // 800KB max document limit strictly enforced for legacy endpoints
});

// Dedicated storage for Employee Photos
const employeePhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'employee-photos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const empId = req.params.id || req.body.employeeId || 'EMP';
    const cleanId = String(empId).replace(/[^a-zA-Z0-9_-]/g, '');
    const uuid = require('crypto').randomBytes(8).toString('hex');
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) ext = '.jpg';
    cb(null, `photo_${cleanId}_${uuid}${ext}`);
  }
});

const imageOnlyFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
  const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (validExts.includes(ext) && validMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Only image files (JPG, JPEG, PNG, WEBP) are allowed. Provided: ${ext}`));
  }
};

const uploadEmployeePhoto = multer({
  storage: employeePhotoStorage,
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Dedicated storage for Employee Documents
const employeeDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'employee-documents');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const empId = req.params.id || req.body.employeeId || 'EMP';
    const docType = req.body.documentType ? String(req.body.documentType).replace(/[^a-zA-Z0-9_-]/g, '') : 'Doc';
    const cleanId = String(empId).replace(/[^a-zA-Z0-9_-]/g, '');
    const uuid = require('crypto').randomBytes(8).toString('hex');
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!allowedExts.includes(ext)) ext = '.pdf';
    cb(null, `${cleanId}_${docType}_${uuid}${ext}`);
  }
});

const uploadEmployeeDocument = multer({
  storage: employeeDocumentStorage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Dedicated storage for VM Checklist Photos
const vmChecklistStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadDir, 'vm-checklist');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const loc = req.body.locationName || req.body.location || req.body.locationId || 'STORE';
    const cleanLoc = String(loc).replace(/[^a-zA-Z0-9_-]/g, '');
    const floor = req.body.floor ? String(req.body.floor).replace(/[^a-zA-Z0-9_-]/g, '') : 'F';
    const uuid = require('crypto').randomBytes(8).toString('hex');
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) ext = '.jpg';
    cb(null, `vm_${cleanLoc}_${floor}_${uuid}${ext}`);
  }
});

const uploadVmPhotos = multer({
  storage: vmChecklistStorage,
  fileFilter: imageOnlyFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
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
        } else if (ext === '.webp') {
          // WebP begins with RIFF....WEBP (0x52 0x49 0x46 0x46 ... 0x57 0x45 0x42 0x50)
          isValid = buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
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
upload.uploadEmployeePhoto = uploadEmployeePhoto;
upload.uploadEmployeeDocument = uploadEmployeeDocument;
upload.uploadVmPhotos = uploadVmPhotos;
upload.uploadDir = uploadDir;

module.exports = upload;
