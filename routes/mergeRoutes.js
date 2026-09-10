const express = require('express');
const router = express.Router();
const mergeController = require('../controllers/mergeController');
const { uploadMultiple } = require('../middleware/upload');
const { validateFileUpload } = require('../middleware/validation');
const { uploadLimiter } = require('../middleware/rateLimiter');

router.post('/', 
  uploadLimiter,
  uploadMultiple.array('files', 20), 
  validateFileUpload,
  mergeController.merge
);

router.post('/with-options', 
  uploadLimiter,
  uploadMultiple.array('files', 20), 
  validateFileUpload,
  mergeController.mergeWithOptions
);

module.exports = router;