const SplitService = require('../services/splitService');
const FileHelper = require('../utils/fileHelper');
const ResponseHelper = require('../utils/responseHelper');
const { logger } = require('../utils/logger');
const path = require('path');
const fs = require('fs-extra');

class SplitController {
  async split(req, res, next) {
    try {
      const filePath = req.file.path;
      
      // Parse options from request body
      let options = {};
      
      if (req.body.options) {
        // If options is sent as JSON string
        try {
          options = JSON.parse(req.body.options);
        } catch (error) {
          options = req.body;
        }
      } else {
        // If options are sent as individual fields
        options = {
          mode: req.body.mode,
          ranges: req.body.ranges ? JSON.parse(req.body.ranges) : null,
          pageNumbers: req.body.pageNumbers ? JSON.parse(req.body.pageNumbers) : null,
          everyNPages: req.body.everyNPages ? parseInt(req.body.everyNPages) : null
        };
      }
      
      console.log('Final parsed options:', options); // Debug log
      
      const result = await SplitService.splitPDF(filePath, options);
      
      console.log('Split result:', {
        fileCount: result.fileCount,
        outputPaths: result.outputPaths
      });
      
      // Clean up uploaded file
      await FileHelper.deleteFile(filePath);
      
      if (result.fileCount === 0) {
        return ResponseHelper.badRequest(res, 'No files were generated');
      }
      
      if (result.fileCount === 1) {
        // Single output file - send as PDF
        const filePath = result.outputPaths[0];
        
        // Verify file exists and has content
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
          throw new Error('Generated file is empty or missing');
        }
        
        const buffer = await FileHelper.readBuffer(filePath);
        
        res.on('finish', async () => {
          await FileHelper.deleteDirectory(result.outputDir);
        });
        
        return ResponseHelper.file(res, buffer, 'split.pdf');
      } else if (result.fileCount > 1) {
        // Multiple files - create zip
        const zipPath = path.join(result.outputDir, 'split_files.zip');
        
        // Check if zip already exists
        if (fs.existsSync(zipPath)) {
          await fs.remove(zipPath);
        }
        
        await SplitService.createZip(result.outputPaths, zipPath);
        
        // Verify zip file exists and has content
        if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size === 0) {
          throw new Error('ZIP file is empty or missing');
        }
        
        const buffer = await FileHelper.readBuffer(zipPath);
        
        res.on('finish', async () => {
          await FileHelper.deleteDirectory(result.outputDir);
        });
        
        return ResponseHelper.file(res, buffer, 'split_files.zip', 'application/zip');
      }
    } catch (error) {
      logger.error('Error splitting PDF:', error);
      return ResponseHelper.badRequest(res, error.message || 'Failed to split PDF');
    }
  }

  async splitByRanges(req, res, next) {
    try {
      const filePath = req.file.path;
      const { ranges } = req.body;
      
      if (!ranges) {
        return ResponseHelper.badRequest(res, 'Page ranges are required');
      }
      
      let parsedRanges;
      try {
        parsedRanges = JSON.parse(ranges);
      } catch (error) {
        return ResponseHelper.badRequest(res, 'Invalid ranges format');
      }
      
      const options = {
        mode: 'range',
        ranges: parsedRanges
      };
      
      const result = await SplitService.splitPDF(filePath, options);
      
      // Clean up
      await FileHelper.deleteFile(filePath);
      
      if (result.fileCount === 1) {
        const buffer = await FileHelper.readBuffer(result.outputPaths[0]);
        
        res.on('finish', async () => {
          await FileHelper.deleteDirectory(result.outputDir);
        });
        
        return ResponseHelper.file(res, buffer, 'split.pdf');
      } else {
        const zipPath = path.join(result.outputDir, 'split_files.zip');
        await SplitService.createZip(result.outputPaths, zipPath);
        
        const buffer = await FileHelper.readBuffer(zipPath);
        
        res.on('finish', async () => {
          await FileHelper.deleteDirectory(result.outputDir);
        });
        
        return ResponseHelper.file(res, buffer, 'split_files.zip', 'application/zip');
      }
    } catch (error) {
      logger.error('Error splitting PDF by ranges:', error);
      return ResponseHelper.badRequest(res, error.message || 'Failed to split PDF');
    }
  }
}

module.exports = new SplitController();