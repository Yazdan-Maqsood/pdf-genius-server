const PDFHelper = require('../utils/pdfHelper');
const FileHelper = require('../utils/fileHelper');
const path = require('path');
const config = require('../config');

class PDFService {
  async getInfo(filePath) {
    return await PDFHelper.getPDFInfo(filePath);
  }

  async merge(filePaths) {
    const outputDir = path.join(config.tempDir, 'merge');
    FileHelper.ensureDirectoryExists(outputDir);
    
    const outputPath = path.join(outputDir, `merged_${Date.now()}.pdf`);
    await PDFHelper.mergePDFs(filePaths, outputPath);
    
    return outputPath;
  }

  async split(filePath, splitOptions) {
    const outputDir = path.join(config.tempDir, 'split');
    FileHelper.ensureDirectoryExists(outputDir);
    
    switch (splitOptions.mode) {
      case 'range':
        return await PDFHelper.splitPDFByRanges(filePath, splitOptions.ranges, outputDir);
      case 'extract':
        return await PDFHelper.extractPages(filePath, splitOptions.pageNumbers, outputDir);
      case 'remove':
        const outputPath = path.join(outputDir, `removed_${Date.now()}.pdf`);
        await PDFHelper.removePages(filePath, splitOptions.pageNumbers, outputPath);
        return [outputPath];
      case 'every_n_pages':
        // Implement splitting every N pages
        const pdfDoc = await PDFHelper.loadPDF(filePath);
        const pageCount = pdfDoc.getPageCount();
        const n = splitOptions.n || 1;
        const ranges = [];
        
        for (let i = 0; i < pageCount; i += n) {
          const range = [];
          for (let j = i; j < Math.min(i + n, pageCount); j++) {
            range.push(j);
          }
          ranges.push(range);
        }
        
        return await PDFHelper.splitPDFByRanges(filePath, ranges, outputDir);
      default:
        throw new Error('Invalid split mode');
    }
  }

  async compress(filePath, quality) {
    const outputDir = path.join(config.tempDir, 'compress');
    FileHelper.ensureDirectoryExists(outputDir);
    
    const outputPath = path.join(outputDir, `compressed_${Date.now()}.pdf`);
    await PDFHelper.compressPDF(filePath, outputPath, quality);
    
    return outputPath;
  }

  async convertToPDFA(filePath) {
    const outputDir = path.join(config.tempDir, 'convert');
    FileHelper.ensureDirectoryExists(outputDir);
    
    const outputPath = path.join(outputDir, `pdfa_${Date.now()}.pdf`);
    await PDFHelper.convertToPDFA(filePath, outputPath);
    
    return outputPath;
  }
}

module.exports = new PDFService();