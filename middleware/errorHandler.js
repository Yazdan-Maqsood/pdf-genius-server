const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  console.error('Error caught by handler:', err);
  
  // Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds the limit' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files uploaded' });
    }
    return res.status(400).json({ error: err.message });
  }
  
  // Custom errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  
  // Default error - always return JSON
  return res.status(500).json({ 
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = { errorHandler };