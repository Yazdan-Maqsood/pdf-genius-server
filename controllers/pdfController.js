const PDFService = require('../services/pdfService');
const FileHelper = require('../utils/fileHelper');
const ResponseHelper = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

class PDFController {
  async getInfo(req, res, next) {
    try {
      const filePath = req.file.path;
      const info = await PDFService.getInfo(filePath);
      
      // Clean up uploaded file
      await FileHelper.deleteFile(filePath);
      
      return ResponseHelper.success(res, info, 'PDF info retrieved successfully');
    } catch (error) {
      logger.error('Error getting PDF info:', error);
      next(error);
    }
  }

  async download(req, res, next) {
    try {
      const { filename } = req.params;
      const filePath = path.join(config.uploadDir, 'processed', filename);
      
      if (!fs.existsSync(filePath)) {
        return ResponseHelper.notFound(res, 'File not found');
      }
      
      const buffer = await FileHelper.readBuffer(filePath);
      return ResponseHelper.file(res, buffer, filename);
    } catch (error) {
      logger.error('Error downloading file:', error);
      next(error);
    }
  }
}

module.exports = new PDFController();