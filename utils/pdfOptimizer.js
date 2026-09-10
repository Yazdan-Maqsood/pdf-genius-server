const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs-extra');

class PDFOptimizer {
  static async optimizePDF(inputPath, outputPath, options = {}) {
    const {
      quality = 60,
      maxWidth = 2000,
      maxHeight = 2000,
      removeMetadata = true,
      useObjectStreams = true
    } = options;
    
    try {
      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        updateMetadata: false,
        ignoreEncryption: true
      });
      
      // Remove metadata
      if (removeMetadata) {
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('');
        pdfDoc.setCreator('');
      }
      
      // Optimize save settings
      const optimizedBytes = await pdfDoc.save({
        useObjectStreams: useObjectStreams,
        addDefaultPage: false,
        objectsPerTick: 100
      });
      
      await fs.writeFile(outputPath, optimizedBytes);
      
      return {
        originalSize: pdfBytes.length,
        optimizedSize: optimizedBytes.length,
        ratio: ((pdfBytes.length - optimizedBytes.length) / pdfBytes.length * 100).toFixed(2)
      };
    } catch (error) {
      console.error('PDF optimization error:', error);
      throw error;
    }
  }
  
  static async getPDFSize(inputPath) {
    const stats = await fs.stat(inputPath);
    return stats.size;
  }
  
  static async compareSize(originalPath, compressedPath) {
    const originalSize = await this.getPDFSize(originalPath);
    const compressedSize = await this.getPDFSize(compressedPath);
    
    return {
      originalSize,
      compressedSize,
      reduction: ((originalSize - compressedSize) / originalSize * 100).toFixed(2)
    };
  }
}

module.exports = PDFOptimizer;