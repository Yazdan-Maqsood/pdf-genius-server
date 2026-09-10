const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');
const FileHelper = require('./fileHelper');

class ImageHelper {
  static async imageToPdf(imagePaths, outputPath) {
    try {
      const { PDFDocument } = require('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      
      for (const imagePath of imagePaths) {
        console.log(`Processing image: ${imagePath}`);
        
        if (!fs.existsSync(imagePath)) {
          console.error(`Image not found: ${imagePath}`);
          continue;
        }
        
        // Read image buffer
        const imageBuffer = await fs.readFile(imagePath);
        
        // Convert to JPEG if needed
        const jpegBuffer = await sharp(imageBuffer)
          .jpeg({ quality: 90 })
          .toBuffer();
        
        // Embed image in PDF
        const image = await pdfDoc.embedJpg(jpegBuffer);
        
        // Add page with image dimensions
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height
        });
      }
      
      // Save PDF
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);
      
      return outputPath;
    } catch (error) {
      console.error('Error in imageToPdf:', error);
      throw error;
    }
  }

  static async pdfToImages(pdfPath, outputDir, format = 'jpg', dpi = 300) {
    // Placeholder - will be implemented properly
    throw new Error('PDF to image conversion not yet implemented');
  }

  static async getImageInfo(imagePath) {
    try {
      const metadata = await sharp(imagePath).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size
      };
    } catch (error) {
      console.error('Error getting image info:', error);
      throw error;
    }
  }
}

module.exports = ImageHelper;