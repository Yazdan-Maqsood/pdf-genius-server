const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const { logger } = require('./logger');

class CleanupHelper {
  static async cleanupOldFiles(directory, maxAge = 3600000) {
    try {
      if (!fs.existsSync(directory)) return;
      
      const files = await fs.readdir(directory);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.remove(filePath);
          logger.info(`Cleaned up old file: ${filePath}`);
        }
      }
    } catch (error) {
      logger.error(`Error cleaning up directory ${directory}:`, error);
    }
  }

  static async cleanupAll() {
    const directories = [
      config.uploadDir,
      config.tempDir,
      path.join(config.uploadDir, 'pdf'),
      path.join(config.uploadDir, 'images'),
      path.join(config.uploadDir, 'office'),
      path.join(config.uploadDir, 'processed'),
      path.join(config.tempDir, 'merge'),
      path.join(config.tempDir, 'split'),
      path.join(config.tempDir, 'compress'),
      path.join(config.tempDir, 'convert')
    ];
    
    for (const dir of directories) {
      await this.cleanupOldFiles(dir);
    }
  }

  static startCleanupSchedule() {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanupAll();
    }, 3600000);
    
    logger.info('Cleanup schedule started');
  }
}

module.exports = CleanupHelper;