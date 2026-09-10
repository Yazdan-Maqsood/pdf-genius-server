const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

class FileHelper {
  static ensureDirectoryExists(dirPath) {
    fs.ensureDirSync(dirPath);
    return dirPath;
  }

  static generateUniqueFilename(originalName) {
    const ext = path.extname(originalName);
    const uniqueId = uuidv4();
    return `${uniqueId}${ext}`;
  }

  static async saveBuffer(buffer, directory, filename) {
    const dir = this.ensureDirectoryExists(directory);
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  static async readBuffer(filePath) {
    return await fs.readFile(filePath);
  }

  static async deleteFile(filePath) {
    try {
      await fs.remove(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
      return false;
    }
  }

  static async deleteDirectory(dirPath) {
    try {
      await fs.remove(dirPath);
      return true;
    } catch (error) {
      console.error(`Error deleting directory ${dirPath}:`, error);
      return false;
    }
  }

  static async cleanupTempFiles(directory, maxAge = 3600000) {
    try {
      const files = await fs.readdir(directory);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.remove(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning temp files:', error);
    }
  }

  static getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  static isValidFileType(filename, allowedTypes) {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    return allowedTypes.includes(ext);
  }
}

module.exports = FileHelper;