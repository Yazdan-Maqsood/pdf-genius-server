require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'https://pdf-genius-tawny.vercel.app',
  
  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  
  // Upload limits
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 50 * 1024 * 1024,
  maxFilesPerRequest: parseInt(process.env.MAX_FILES_PER_REQUEST) || 20,
  
  // Paths
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  tempDir: process.env.TEMP_DIR || './temp',
  logDir: process.env.LOG_DIR || './logs',
  
  // PDF Processing
  pdfCompressionQuality: process.env.PDF_COMPRESSION_QUALITY || 'medium',
  pdfImageQuality: parseInt(process.env.PDF_IMAGE_QUALITY) || 70,
  pdfDpi: parseInt(process.env.PDF_DPI) || 300,
  
  // LibreOffice
  libreOfficePath: process.env.LIBREOFFICE_PATH || 'soffice',
  libreOfficeTimeout: 60000,
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Allowed file types
  allowedFileTypes: process.env.ALLOWED_FILE_TYPES 
    ? process.env.ALLOWED_FILE_TYPES.split(',')
    : ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'html']
};

module.exports = config;