const express = require('express');
const router = express.Router();
const splitController = require('../controllers/splitController');
const { uploadSingle } = require('../middleware/upload');
const { validateSingleFile, validateSplitOptions } = require('../middleware/validation');
const { uploadLimiter } = require('../middleware/rateLimiter');

router.post('/', 
  uploadLimiter,
  uploadSingle.single('file'), 
  validateSingleFile,
  validateSplitOptions,
  splitController.split
);

router.post('/by-ranges', 
  uploadLimiter,
  uploadSingle.single('file'), 
  validateSingleFile,
  splitController.splitByRanges
);

module.exports = router;