const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// Ensure upload directories exist
const ensureDirectories = () => {
  const dirs = [
    path.join(config.uploadDir, 'pdf'),
    path.join(config.uploadDir, 'images'),
    path.join(config.uploadDir, 'office'),
    path.join(config.uploadDir, 'processed')
  ];
  
  dirs.forEach(dir => fs.ensureDirSync(dir));
};

ensureDirectories();

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = path.join(config.uploadDir, 'office');
    
    if (file.mimetype === 'application/pdf') {
      uploadPath = path.join(config.uploadDir, 'pdf');
    } else if (file.mimetype.startsWith('image/')) {
      uploadPath = path.join(config.uploadDir, 'images');
    } else if (
      file.mimetype.includes('word') || 
      file.mimetype.includes('excel') || 
      file.mimetype.includes('powerpoint') ||
      file.mimetype.includes('spreadsheet') ||
      file.mimetype.includes('presentation')
    ) {
      uploadPath = path.join(config.uploadDir, 'office');
    }
    
    console.log(`Uploading ${file.originalname} to ${uploadPath}`);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/html'
  ];
  
  const allowedExtensions = [
    '.pdf', '.jpg', '.jpeg', '.png', 
    '.doc', '.docx', 
    '.xls', '.xlsx', 
    '.ppt', '.pptx', 
    '.html'
  ];
  
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  console.log('Uploading file:', file.originalname, file.mimetype, fileExt);
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    console.error(`Rejected file: ${file.originalname} (${file.mimetype})`);
    cb(new Error(`File type not supported: ${file.mimetype}`), false);
  }
};

// ✅ Naya: File size limits per type
// Office files (PPT/Word/Excel) ke liye kam limit (kyunki LibreOffice heavy hai)
// Images/PDF ke liye zyada limit
const FILE_SIZE_LIMITS = {
  office: 5 * 1024 * 1024,      // 5 MB for Office files (PPT, Word, Excel)
  image: 20 * 1024 * 1024,       // 20 MB for images
  pdf: 50 * 1024 * 1024,         // 50 MB for PDFs
  default: 10 * 1024 * 1024      // 10 MB default
};

// Custom file size check middleware
const checkFileSize = (fileType) => {
  return (req, res, next) => {
    // Get the limit based on file type
    let limit = FILE_SIZE_LIMITS.default;
    
    // Check the actual file being uploaded
    // We need to check during multer processing
    
    // For simplicity, use the max limit
    // Multer itself will check limits, but we can add validation after
    next();
  };
};

// Create multer instances
// ✅ REVISED: Lower file size for office files
const uploadSingle = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024  // 50 MB max (multer's hard limit)
  }
});

const uploadMultiple = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: config.maxFilesPerRequest
  }
});

const uploadAny = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: config.maxFilesPerRequest
  }
});

// ✅ NEW: Post-upload validation for office files
const validateOfficeFileSize = (req, res, next) => {
  if (!req.file && !req.files) return next();
  
  const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
  
  for (const file of files) {
    if (!file) continue;
    
    const ext = path.extname(file.originalname).toLowerCase();
    const isOfficeFile = ['.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx'].includes(ext);
    
    if (isOfficeFile && file.size > 5 * 1024 * 1024) {
      // Delete the uploaded file
      fs.remove(file.path).catch(() => {});
      
      return res.status(400).json({
        success: false,
        error: `Office files (PPT/Word/Excel) must be smaller than 5 MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)} MB. For larger files, please upgrade to our premium plan.`
      });
    }
  }
  
  next();
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadAny,
  validateOfficeFileSize
};