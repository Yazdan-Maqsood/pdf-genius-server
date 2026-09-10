const ResponseHelper = require('../utils/responseHelper');

const validateFileUpload = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return ResponseHelper.badRequest(res, 'No files uploaded');
  }
  next();
};

const validateSingleFile = (req, res, next) => {
  if (!req.file) {
    return ResponseHelper.badRequest(res, 'No file uploaded');
  }
  next();
};

const validatePageNumbers = (req, res, next) => {
  const { pageNumbers } = req.body;
  
  if (!pageNumbers) {
    return ResponseHelper.badRequest(res, 'Page numbers are required');
  }
  
  let pages;
  try {
    pages = JSON.parse(pageNumbers);
  } catch (error) {
    return ResponseHelper.badRequest(res, 'Invalid page numbers format');
  }
  
  if (!Array.isArray(pages) || pages.length === 0) {
    return ResponseHelper.badRequest(res, 'Page numbers must be a non-empty array');
  }
  
  req.pageNumbers = pages;
  next();
};

const validateSplitOptions = (req, res, next) => {
  const mode = req.body.mode;
  
  if (!mode) {
    return ResponseHelper.badRequest(res, 'Split mode is required');
  }
  
  const validModes = ['range', 'extract', 'every_n'];
  if (!validModes.includes(mode)) {
    return ResponseHelper.badRequest(res, `Invalid split mode. Must be one of: ${validModes.join(', ')}`);
  }
  
  next();
};

const validateCompressionLevel = (req, res, next) => {
  const { level } = req.body;
  const validLevels = ['low', 'medium', 'high', 'extreme'];
  
  if (level && !validLevels.includes(level)) {
    return ResponseHelper.badRequest(res, 'Invalid compression level');
  }
  
  req.compressionLevel = level || 'medium';
  next();
};

module.exports = {
  validateFileUpload,
  validateSingleFile,
  validatePageNumbers,
  validateSplitOptions,
  validateCompressionLevel
};