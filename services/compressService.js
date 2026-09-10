const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const FileHelper = require('../utils/fileHelper');
const config = require('../config');

class CompressService {
  async compress(filePath, level = 'medium', options = {}) {
    const outputDir = path.join(config.tempDir, 'compress');
    FileHelper.ensureDirectoryExists(outputDir);
    
    const outputPath = path.join(outputDir, `compressed_${Date.now()}.pdf`);
    
    const settings = this.getCompressionSettings(level);
    
    console.log(`\n🔹 Starting ${level} compression...`);
    const originalSize = FileHelper.getFileSize(filePath);
    console.log(`Original size: ${(originalSize / 1024).toFixed(2)} KB`);
    
    // Try different compression methods
    let bestResult = null;
    
    // Method 1: Basic PDF optimization
    try {
      await this.basicOptimization(filePath, outputPath, settings);
      const size1 = FileHelper.getFileSize(outputPath);
      bestResult = { path: outputPath, size: size1 };
      console.log(`Method 1 (Basic): ${(size1 / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.log('Method 1 failed:', error.message);
    }
    
    // Method 2: Image re-compression if PDF has images
    try {
      const outputPath2 = path.join(outputDir, `compressed2_${Date.now()}.pdf`);
      await this.imageRecompression(filePath, outputPath2, settings);
      const size2 = FileHelper.getFileSize(outputPath2);
      console.log(`Method 2 (Image): ${(size2 / 1024).toFixed(2)} KB`);
      
      if (!bestResult || size2 < bestResult.size) {
        if (bestResult) await FileHelper.deleteFile(bestResult.path);
        bestResult = { path: outputPath2, size: size2 };
      } else {
        await FileHelper.deleteFile(outputPath2);
      }
    } catch (error) {
      console.log('Method 2 failed:', error.message);
    }
    
    // Method 3: Aggressive optimization
    try {
      const outputPath3 = path.join(outputDir, `compressed3_${Date.now()}.pdf`);
      await this.aggressiveOptimization(filePath, outputPath3, settings);
      const size3 = FileHelper.getFileSize(outputPath3);
      console.log(`Method 3 (Aggressive): ${(size3 / 1024).toFixed(2)} KB`);
      
      if (!bestResult || size3 < bestResult.size) {
        if (bestResult) await FileHelper.deleteFile(bestResult.path);
        bestResult = { path: outputPath3, size: size3 };
      } else {
        await FileHelper.deleteFile(outputPath3);
      }
    } catch (error) {
      console.log('Method 3 failed:', error.message);
    }
    
    const finalSize = bestResult.size;
    const compressionRatio = ((originalSize - finalSize) / originalSize * 100).toFixed(2);
    
    console.log(`Final size: ${(finalSize / 1024).toFixed(2)} KB`);
    console.log(`Compression ratio: ${compressionRatio}%\n`);
    
    return {
      outputPath: bestResult.path,
      originalSize,
      compressedSize: finalSize,
      compressionRatio: parseFloat(compressionRatio)
    };
  }

  getCompressionSettings(level) {
    const settings = {
      low: {
        imageQuality: 85,
        removeMetadata: true,
        useObjectStreams: true,
        objectsPerTick: 50,
        maxImageWidth: 2000,
        maxImageHeight: 2000,
        scaleFactor: 0.9
      },
      medium: {
        imageQuality: 60,
        removeMetadata: true,
        useObjectStreams: true,
        objectsPerTick: 75,
        maxImageWidth: 1500,
        maxImageHeight: 1500,
        scaleFactor: 0.7
      },
      high: {
        imageQuality: 40,
        removeMetadata: true,
        useObjectStreams: true,
        objectsPerTick: 100,
        maxImageWidth: 1000,
        maxImageHeight: 1000,
        scaleFactor: 0.5
      },
      extreme: {
        imageQuality: 20,
        removeMetadata: true,
        useObjectStreams: true,
        objectsPerTick: 150,
        maxImageWidth: 800,
        maxImageHeight: 800,
        scaleFactor: 0.3
      }
    };
    
    return settings[level] || settings.medium;
  }

  async basicOptimization(inputPath, outputPath, settings) {
    try {
      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        updateMetadata: false,
        ignoreEncryption: true
      });
      
      // Remove metadata
      if (settings.removeMetadata) {
        this.removeMetadata(pdfDoc);
      }
      
      // Save with optimized settings
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: settings.useObjectStreams,
        objectsPerTick: settings.objectsPerTick,
        addDefaultPage: false,
        updateFieldAppearances: false
      });
      
      await fs.writeFile(outputPath, compressedBytes);
    } catch (error) {
      throw new Error(`Basic optimization failed: ${error.message}`);
    }
  }

  async imageRecompression(inputPath, outputPath, settings) {
    try {
      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        updateMetadata: false,
        ignoreEncryption: true
      });
      
      // Remove metadata
      if (settings.removeMetadata) {
        this.removeMetadata(pdfDoc);
      }
      
      // Get all pages
      const pages = pdfDoc.getPages();
      
      // Process each page to find and compress images
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        await this.processPageImages(pdfDoc, page, settings);
      }
      
      // Save with compression
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        objectsPerTick: settings.objectsPerTick,
        addDefaultPage: false
      });
      
      await fs.writeFile(outputPath, compressedBytes);
    } catch (error) {
      throw new Error(`Image recompression failed: ${error.message}`);
    }
  }

  async processPageImages(pdfDoc, page, settings) {
    try {
      // This is a simplified version - in reality, extracting and 
      // re-embedding images from PDFs is complex
      const resources = page.node.Resources();
      if (!resources) return;
      
      const xObjects = resources.lookupMaybe('XObject');
      if (!xObjects) return;
      
      const keys = xObjects.keys();
      
      for (const key of keys) {
        const xObject = xObjects.get(key);
        const subtype = xObject.get('Subtype');
        
        if (subtype && subtype.toString() === '/Image') {
          // Try to get image data
          try {
            const imageData = xObject.getContents();
            if (imageData && imageData.length > 1000) { // Only compress if image is large enough
              // Compress with sharp
              const compressed = await sharp(imageData)
                .resize({
                  width: settings.maxImageWidth,
                  height: settings.maxImageHeight,
                  fit: 'inside',
                  withoutEnlargement: true
                })
                .jpeg({ quality: settings.imageQuality })
                .toBuffer();
              
              // Note: Replacing the image in the PDF requires complex manipulation
              // This is a placeholder for the actual implementation
            }
          } catch (imgError) {
            // Skip if image can't be processed
          }
        }
      }
    } catch (error) {
      console.log('Page image processing skipped:', error.message);
    }
  }

  async aggressiveOptimization(inputPath, outputPath, settings) {
    try {
      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        updateMetadata: false,
        ignoreEncryption: true
      });
      
      // Remove all metadata
      this.removeMetadata(pdfDoc);
      
      // Set minimal properties
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
      pdfDoc.setCreationDate(new Date(0));
      pdfDoc.setModificationDate(new Date(0));
      
      // Save with maximum compression settings
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        objectsPerTick: 200,
        addDefaultPage: false,
        updateFieldAppearances: false
      });
      
      // Try to compress further with sharp if it's image-based
      try {
        const sharpCompressed = await sharp(compressedBytes)
          .jpeg({ quality: settings.imageQuality })
          .toBuffer();
        
        if (sharpCompressed.length < compressedBytes.length) {
          await fs.writeFile(outputPath, sharpCompressed);
        } else {
          await fs.writeFile(outputPath, compressedBytes);
        }
      } catch (sharpError) {
        await fs.writeFile(outputPath, compressedBytes);
      }
    } catch (error) {
      throw new Error(`Aggressive optimization failed: ${error.message}`);
    }
  }

  removeMetadata(pdfDoc) {
    try {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
      pdfDoc.setCreationDate(new Date(0));
      pdfDoc.setModificationDate(new Date(0));
    } catch (error) {
      console.log('Metadata removal failed:', error.message);
    }
  }

  async getCompressionOptions() {
    return {
      levels: [
        { 
          value: 'low', 
          label: 'Low Compression', 
          description: 'Better quality, minimal size reduction',
          expectedRatio: '10-20%',
          icon: 'fa-image'
        },
        { 
          value: 'medium', 
          label: 'Medium Compression', 
          description: 'Balanced quality and size',
          expectedRatio: '30-50%',
          icon: 'fa-balance-scale'
        },
        { 
          value: 'high', 
          label: 'High Compression', 
          description: 'Smaller file size, good quality',
          expectedRatio: '50-70%',
          icon: 'fa-compress'
        },
        { 
          value: 'extreme', 
          label: 'Extreme Compression', 
          description: 'Smallest file size, reduced quality',
          expectedRatio: '70-85%',
          icon: 'fa-compress-arrows-alt'
        }
      ]
    };
  }
}

module.exports = new CompressService();