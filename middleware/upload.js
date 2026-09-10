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
    
    // Determine upload directory based on file type
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
  
  // Also check by extension
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

// Create multer instances
const uploadSingle = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.maxFileSize
  }
});

const uploadMultiple = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.maxFileSize,
    files: config.maxFilesPerRequest
  }
});

const uploadAny = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.maxFileSize,
    files: config.maxFilesPerRequest
  }
});

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadAny
};