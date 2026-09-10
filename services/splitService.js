const PDFHelper = require('../utils/pdfHelper');
const FileHelper = require('../utils/fileHelper');
const path = require('path');
const config = require('../config');

class SplitService {
  async splitPDF(filePath, options) {
    const outputDir = path.join(config.tempDir, 'split', `${Date.now()}`);
    FileHelper.ensureDirectoryExists(outputDir);
    
    console.log('Split options received:', options); // Debug log
    
    const {
      mode,
      ranges,
      pageNumbers,
      everyNPages
    } = options;
    
    let outputPaths = [];
    
    switch (mode) {
      case 'range':
        if (!ranges || !Array.isArray(ranges) || ranges.length === 0) {
          throw new Error('Page ranges are required for range mode');
        }
        outputPaths = await PDFHelper.splitPDFByRanges(filePath, ranges, outputDir);
        break;
        
      case 'extract':
        if (!pageNumbers || !Array.isArray(pageNumbers) || pageNumbers.length === 0) {
          throw new Error('Page numbers are required for extract mode');
        }
        outputPaths = await PDFHelper.extractPages(filePath, pageNumbers, outputDir);
        break;
        
      case 'every_n':
        const n = parseInt(everyNPages) || 1;
        console.log(`Splitting every ${n} pages`);
        
        if (n < 1) {
          throw new Error('Pages per split must be at least 1');
        }
        
        outputPaths = await PDFHelper.splitEveryNPages(filePath, n, outputDir);
        break;
        
      default:
        throw new Error(`Invalid split mode: ${mode}`);
    }
    
    return {
      outputPaths,
      outputDir,
      fileCount: outputPaths.length
    };
  }

  async createZip(outputPaths, zipPath) {
    const archiver = require('archiver');
    const fs = require('fs-extra');
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 }
      });
      
      output.on('close', () => {
        console.log(`ZIP created with ${archive.pointer()} bytes`);
        resolve(zipPath);
      });
      
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        reject(err);
      });
      
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Archive warning:', err);
        } else {
          reject(err);
        }
      });
      
      archive.pipe(output);
      
      outputPaths.forEach((filePath, index) => {
        // Verify file exists
        if (fs.existsSync(filePath)) {
          archive.file(filePath, { name: `split_${index + 1}.pdf` });
          console.log(`Added to zip: ${filePath}`);
        } else {
          console.error(`File not found: ${filePath}`);
        }
      });
      
      archive.finalize();
    });
  }
}

module.exports = new SplitService();