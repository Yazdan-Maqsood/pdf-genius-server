const fs = require('fs-extra');
const path = require('path');
const { createCanvas } = require('canvas');

class PdfToImageService {
  async pdfToJpg(pdfFilePath, outputDir, options = {}) {
    try {
      console.log('\n===== PDF TO IMAGE CONVERSION =====');
      console.log('Input:', pdfFilePath);
      console.log('Output dir:', outputDir);
      console.log('Options:', options);
      
      fs.ensureDirSync(outputDir);
      
      // Get format from options
      const format = (options.format || 'jpeg').toLowerCase();
      console.log('Target format:', format);
      
      // Try pdfjs-dist first (better format control)
      try {
        return await this.convertWithPdfJs(pdfFilePath, outputDir, options);
      } catch (pdfjsError) {
        console.error('pdfjs-dist failed:', pdfjsError.message);
        
        try {
          return await this.convertWithPoppler(pdfFilePath, outputDir, options);
        } catch (popplerError) {
          console.error('pdf-poppler failed:', popplerError.message);
          throw new Error(`PDF to image conversion failed: ${pdfjsError.message}`);
        }
      }
    } catch (error) {
      console.error('PDF to image conversion error:', error);
      throw error;
    }
  }

  async convertWithPdfJs(pdfFilePath, outputDir, options = {}) {
    console.log('Using pdfjs-dist for conversion...');
    
    let pdfjsLib;
    try {
      pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
    } catch (error) {
      try {
        pdfjsLib = require('pdfjs-dist');
      } catch (err) {
        throw new Error('pdfjs-dist not available: ' + error.message);
      }
    }
    
    const data = new Uint8Array(await fs.readFile(pdfFilePath));
    
    const loadingTask = pdfjsLib.getDocument({ 
      data,
      disableFontFace: true,
      useSystemFonts: false
    });
    
    const pdf = await loadingTask.promise;
    
    console.log('PDF loaded. Pages:', pdf.numPages);
    
    const scale = options.scale || 2.0;
    // ✅ FIX: Get format properly
    let format = (options.format || 'jpeg').toLowerCase();
    
    // Normalize format
    if (format === 'jpg' || format === 'jpeg') {
      format = 'jpeg';
    } else if (format === 'png') {
      format = 'png';
    } else {
      format = 'jpeg';
    }
    
    const quality = options.quality || 90;
    
    console.log('Using format:', format, 'quality:', quality, 'scale:', scale);
    
    const outputPaths = [];
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing page ${pageNum}/${pdf.numPages}...`);
      
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // White background (important for PNG transparency)
      context.fillStyle = 'white';
      context.fillRect(0, 0, viewport.width, viewport.height);
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        background: 'white'
      };
      
      await page.render(renderContext).promise;
      
      // ✅ FIX: Use correct extension and buffer format
      let outputPath;
      let imageBuffer;
      
      if (format === 'png') {
        outputPath = path.join(outputDir, `page_${pageNum}.png`);
        imageBuffer = canvas.toBuffer('image/png', {
          compressionLevel: 6,
          filters: 0x04 | 0x08 // PNG filters for better compression
        });
      } else {
        outputPath = path.join(outputDir, `page_${pageNum}.jpg`);
        imageBuffer = canvas.toBuffer('image/jpeg', { 
          quality: quality / 100,
          progressive: true
        });
      }
      
      await fs.writeFile(outputPath, imageBuffer);
      outputPaths.push(outputPath);
      
      console.log(`✅ Page ${pageNum} saved as ${format.toUpperCase()}: ${path.basename(outputPath)} (${(imageBuffer.length / 1024).toFixed(2)} KB)`);
    }
    
    console.log(`\n✅ Converted ${outputPaths.length} page(s) to ${format.toUpperCase()}`);
    console.log('==================================\n');
    
    return outputPaths;
  }

  async convertWithPoppler(pdfFilePath, outputDir, options = {}) {
    console.log('Using pdf-poppler for conversion...');
    
    const pdfPoppler = require('pdf-poppler');
    
    const pdfInfo = await pdfPoppler.info(pdfFilePath);
    console.log('PDF pages:', pdfInfo.pages);
    
    // ✅ FIX: Properly handle format
    let format = (options.format || 'jpeg').toLowerCase();
    
    // Normalize format for pdf-poppler
    // pdf-poppler supports: jpeg, png, tiff, etc.
    if (format === 'jpg') {
      format = 'jpeg';
    }
    
    const scale = options.scale || 2.0;
    
    const opts = {
      format: format, // ✅ Pass correct format
      out_dir: outputDir,
      out_prefix: 'page',
      page: null,
      scale: Math.round(1024 * scale)
    };
    
    console.log('Poppler options:', opts);
    
    await pdfPoppler.convert(pdfFilePath, opts);
    
    // Get generated files - check both .jpg and .png
    const files = fs.readdirSync(outputDir).filter(f => {
      const lower = f.toLowerCase();
      if (format === 'png') {
        return f.startsWith('page') && lower.endsWith('.png');
      } else {
        return f.startsWith('page') && (lower.endsWith('.jpg') || lower.endsWith('.jpeg'));
      }
    });
    
    const outputPaths = files.map(f => path.join(outputDir, f));
    
    console.log(`✅ Converted ${outputPaths.length} page(s) to ${format}`);
    
    return outputPaths;
  }
}

module.exports = new PdfToImageService();