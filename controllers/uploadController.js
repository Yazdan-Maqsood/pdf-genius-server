const FileHelper = require('../utils/fileHelper');
const ResponseHelper = require('../utils/responseHelper');
const { logger } = require('../utils/logger');

class UploadController {
  async uploadFiles(req, res, next) {
    try {
      const files = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path
      }));
      
      return ResponseHelper.success(res, { files }, 'Files uploaded successfully');
    } catch (error) {
      logger.error('Error uploading files:', error);
      next(error);
    }
  }

  async uploadSingle(req, res, next) {
    try {
      const file = {
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      };
      
      return ResponseHelper.success(res, { file }, 'File uploaded successfully');
    } catch (error) {
      logger.error('Error uploading file:', error);
      next(error);
    }
  }

  async deleteFile(req, res, next) {
    try {
      const { filename } = req.params;
      const filePath = path.join(config.uploadDir, filename);
      
      const deleted = await FileHelper.deleteFile(filePath);
      
      if (deleted) {
        return ResponseHelper.success(res, null, 'File deleted successfully');
      } else {
        return ResponseHelper.notFound(res, 'File not found');
      }
    } catch (error) {
      logger.error('Error deleting file:', error);
      next(error);
    }
  }
}

module.exports = new UploadController();