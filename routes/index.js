const express = require('express');
const router = express.Router();

const pdfRoutes = require('./pdfRoutes');
const mergeRoutes = require('./mergeRoutes');
const splitRoutes = require('./splitRoutes');
const compressRoutes = require('./compressRoutes');
const convertRoutes = require('./convertRoutes');
const uploadRoutes = require('./uploadRoutes');

router.use('/pdf', pdfRoutes);
router.use('/merge', mergeRoutes);
router.use('/split', splitRoutes);
router.use('/compress', compressRoutes);
router.use('/convert', convertRoutes);
router.use('/upload', uploadRoutes);

module.exports = router;