const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { uploadSingle } = require('../middleware/upload');
const { validateSingleFile } = require('../middleware/validation');
const { uploadLimiter } = require('../middleware/rateLimiter');

router.post('/info', 
  uploadLimiter,
  uploadSingle.single('file'), 
  validateSingleFile,
  pdfController.getInfo
);

router.get('/download/:filename', pdfController.download);

module.exports = router;