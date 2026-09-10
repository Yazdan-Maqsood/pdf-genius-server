const CompressService = require('../services/compressService');
const PDFOptimizer = require('../utils/pdfOptimizer');
const FileHelper = require('../utils/fileHelper');
const ResponseHelper = require('../utils/responseHelper');
const { logger } = require('../utils/logger');
const path = require('path');
const config = require('../config');

class CompressController {
  async compress(req, res, next) {
    try {
      const filePath = req.file.path;
      const level = req.body.level || 'medium';
      
      console.log(`Starting compression with level: ${level}`);
      console.log(`Original file size: ${FileHelper.getFileSize(filePath)} bytes`);
      
      // Use the new compress service
      const result = await CompressService.compress(filePath, level);
      
      const buffer = await FileHelper.readBuffer(result.outputPath);
      
      // Clean up uploaded file
      await FileHelper.deleteFile(filePath);
      
      res.on('finish', async () => {
        await FileHelper.deleteFile(result.outputPath);
      });
      
      // Add compression info to headers
      res.setHeader('X-Original-Size', result.originalSize);
      res.setHeader('X-Compressed-Size', result.compressedSize);
      res.setHeader('X-Compression-Ratio', result.compressionRatio);
      
      console.log(`Compression complete: ${result.compressionRatio}% reduction`);
      
      return ResponseHelper.file(res, buffer, 'compressed.pdf');
    } catch (error) {
      logger.error('Error compressing PDF:', error);
      
      // Fallback: basic compression
      try {
        console.log('Falling back to basic compression...');
        const filePath = req.file.path;
        const outputDir = path.join(config.tempDir, 'compress');
        FileHelper.ensureDirectoryExists(outputDir);
        const outputPath = path.join(outputDir, `compressed_${Date.now()}.pdf`);
        
        await PDFOptimizer.optimizePDF(filePath, outputPath, {
          quality: 50,
          removeMetadata: true,
          useObjectStreams: true
        });
        
        const buffer = await FileHelper.readBuffer(outputPath);
        const originalSize = FileHelper.getFileSize(filePath);
        const compressedSize = FileHelper.getFileSize(outputPath);
        const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
        
        await FileHelper.deleteFile(filePath);
        
        res.on('finish', async () => {
          await FileHelper.deleteFile(outputPath);
        });
        
        res.setHeader('X-Original-Size', originalSize);
        res.setHeader('X-Compressed-Size', compressedSize);
        res.setHeader('X-Compression-Ratio', compressionRatio);
        
        return ResponseHelper.file(res, buffer, 'compressed.pdf');
      } catch (fallbackError) {
        logger.error('Fallback compression failed:', fallbackError);
        return ResponseHelper.badRequest(res, 'Failed to compress PDF');
      }
    }
  }

  async getOptions(req, res, next) {
    try {
      const options = await CompressService.getCompressionOptions();
      return ResponseHelper.success(res, options, 'Compression options retrieved');
    } catch (error) {
      logger.error('Error getting compression options:', error);
      next(error);
    }
  }
}

module.exports = new CompressController();