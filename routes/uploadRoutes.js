const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const { uploadLimiter } = require('../middleware/rateLimiter');

router.post('/single', 
  uploadLimiter,
  uploadSingle.single('file'),
  uploadController.uploadSingle
);

router.post('/multiple', 
  uploadLimiter,
  uploadMultiple.array('files', 20),
  uploadController.uploadFiles
);

router.delete('/:filename', uploadController.deleteFile);

module.exports = router;