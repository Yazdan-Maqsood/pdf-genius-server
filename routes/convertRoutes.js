const express = require('express');
const router = express.Router();
const convertController = require('../controllers/convertController');
const { uploadMultiple } = require('../middleware/upload');
const { validateFileUpload } = require('../middleware/validation');
const { uploadLimiter } = require('../middleware/rateLimiter');

router.post('/', 
  uploadLimiter,
  uploadMultiple.array('files', 20), 
  validateFileUpload,
  convertController.convert
);

router.get('/supported', convertController.getSupportedConversions);

module.exports = router;