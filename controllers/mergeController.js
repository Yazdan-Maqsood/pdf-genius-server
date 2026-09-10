const MergeService = require('../services/mergeService');
const FileHelper = require('../utils/fileHelper');
const ResponseHelper = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

class MergeController {
  async merge(req, res, next) {
    try {
      const filePaths = req.files.map(file => file.path);
      
      if (filePaths.length < 2) {
        return ResponseHelper.badRequest(res, 'At least 2 PDF files are required');
      }
      
      const result = await MergeService.mergePDFs(filePaths);
      const buffer = await FileHelper.readBuffer(result.outputPath);
      
      // Clean up uploaded files
      for (const filePath of filePaths) {
        await FileHelper.deleteFile(filePath);
      }
      
      // Clean up output file after sending
      res.on('finish', async () => {
        await FileHelper.deleteFile(result.outputPath);
      });
      
      return ResponseHelper.file(res, buffer, 'merged.pdf');
    } catch (error) {
      logger.error('Error merging PDFs:', error);
      next(error);
    }
  }

  async mergeWithOptions(req, res, next) {
    try {
      const filePaths = req.files.map(file => file.path);
      const options = req.body;
      
      const result = await MergeService.mergeWithOptions(filePaths, options);
      const buffer = await FileHelper.readBuffer(result.outputPath);
      
      // Clean up
      for (const filePath of filePaths) {
        await FileHelper.deleteFile(filePath);
      }
      
      res.on('finish', async () => {
        await FileHelper.deleteFile(result.outputPath);
      });
      
      return ResponseHelper.file(res, buffer, 'merged.pdf');
    } catch (error) {
      logger.error('Error merging PDFs with options:', error);
      next(error);
    }
  }
}

module.exports = new MergeController();