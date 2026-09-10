const express = require('express');
const router = express.Router();
const compressController = require('../controllers/compressController');
const { uploadSingle } = require('../middleware/upload');
const { validateSingleFile, validateCompressionLevel } = require('../middleware/validation');
const { uploadLimiter } = require('../middleware/rateLimiter');

router.post('/', 
  uploadLimiter,
  uploadSingle.single('file'), 
  validateSingleFile,
  validateCompressionLevel,
  compressController.compress
);

router.get('/options', compressController.getOptions);

module.exports = router;