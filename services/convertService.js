const FileHelper = require("../utils/fileHelper");
const ImageHelper = require("../utils/imageHelper");
const path = require("path");
const config = require("../config");
const { CONVERSION_TYPES } = require("../config/constants");
const fs = require("fs-extra");

class ConvertService {
  async convert(files, conversionType, options = {}) {
    const outputDir = path.join(config.tempDir, "convert", `${Date.now()}`);
    FileHelper.ensureDirectoryExists(outputDir);

    console.log(
      `Converting ${files.length} file(s) with type: ${conversionType}`,
    );
    console.log("Files:", files);
    console.log("Options:", options);

    switch (conversionType) {
      case CONVERSION_TYPES.JPG_TO_PDF:
      case "jpg_to_pdf":
        return await this.jpgToPdf(files, outputDir, options);

      case CONVERSION_TYPES.WORD_TO_PDF:
      case "word_to_pdf":
        return await this.officeToPdf(files, outputDir, "word");

      case CONVERSION_TYPES.EXCEL_TO_PDF:
      case "excel_to_pdf":
        return await this.officeToPdf(files, outputDir, "excel");

      case CONVERSION_TYPES.PPT_TO_PDF:
      case "ppt_to_pdf":
        return await this.officeToPdf(files, outputDir, "powerpoint");

      case CONVERSION_TYPES.HTML_TO_PDF:
      case "html_to_pdf":
        return await this.htmlToPdf(files, outputDir, options);

      case CONVERSION_TYPES.PDF_TO_JPG:
      case "pdf_to_jpg":
        return await this.pdfToJpg(files, outputDir, options);

      case CONVERSION_TYPES.PDF_TO_WORD:
      case "pdf_to_word":
        return await this.pdfToWord(files, outputDir);

      case CONVERSION_TYPES.PDF_TO_PDFA:
      case "pdf_to_pdfa":
        return await this.pdfToPdfa(files, outputDir);

      case CONVERSION_TYPES.PDF_TO_WORD:
      case "pdf_to_word":
        return await this.pdfToWord(files, outputDir, options);

      case CONVERSION_TYPES.PDF_TO_EXCEL:
      case "pdf_to_excel":
        return await this.pdfToExcel(files, outputDir);

      case CONVERSION_TYPES.PDF_TO_PPT:
      case "pdf_to_ppt":
        return await this.pdfToPpt(files, outputDir, options);

      default:
        throw new Error(`Invalid conversion type: ${conversionType}`);
    }
  }

  async jpgToPdf(imagePaths, outputDir, options = {}) {
    try {
      const { PDFDocument } = require("pdf-lib");
      const sharp = require("sharp");
      const fs = require("fs-extra");

      console.log(`Converting ${imagePaths.length} images to PDF...`);

      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        console.log(`Processing image ${i + 1}: ${imagePath}`);

        // Check if file exists
        if (!fs.existsSync(imagePath)) {
          console.error(`Image file not found: ${imagePath}`);
          continue;
        }

        // Read and process image with sharp
        const imageBuffer = await fs.readFile(imagePath);

        // Get image info
        const imageInfo = await sharp(imageBuffer).metadata();
        console.log(`Image ${i + 1} info:`, imageInfo);

        // Convert to JPEG format
        const jpegBuffer = await sharp(imageBuffer)
          .jpeg({ quality: 90 })
          .toBuffer();

        // Embed JPEG in PDF
        const image = await pdfDoc.embedJpg(jpegBuffer);

        // Calculate page dimensions based on options
        let pageWidth, pageHeight;

        if (options.pageSize === "a4") {
          pageWidth = 595.28; // A4 width in points
          pageHeight = 841.89; // A4 height in points
        } else if (options.pageSize === "letter") {
          pageWidth = 612; // Letter width in points
          pageHeight = 792; // Letter height in points
        } else if (options.pageSize === "legal") {
          pageWidth = 612; // Legal width in points
          pageHeight = 1008; // Legal height in points
        } else {
          // Fit to image
          pageWidth = image.width;
          pageHeight = image.height;
        }

        // Handle orientation
        if (options.orientation === "landscape") {
          [pageWidth, pageHeight] = [pageHeight, pageWidth];
        }

        // Add page
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Calculate image position and size with margins
        const margin = (options.margin || 0) * 2.83465; // Convert mm to points

        const availableWidth = pageWidth - margin * 2;
        const availableHeight = pageHeight - margin * 2;

        // Scale image to fit page while maintaining aspect ratio
        const imageRatio = image.width / image.height;
        const pageRatio = availableWidth / availableHeight;

        let drawWidth, drawHeight;

        if (imageRatio > pageRatio) {
          drawWidth = availableWidth;
          drawHeight = availableWidth / imageRatio;
        } else {
          drawHeight = availableHeight;
          drawWidth = availableHeight * imageRatio;
        }

        // Center image on page
        const x = (pageWidth - drawWidth) / 2;
        const y = (pageHeight - drawHeight) / 2;

        // Draw image
        page.drawImage(image, {
          x: x,
          y: y,
          width: drawWidth,
          height: drawHeight,
        });
      }

      // Save PDF
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const outputPath = path.join(outputDir, `converted_${Date.now()}.pdf`);
      await fs.writeFile(outputPath, pdfBytes);

      console.log(`PDF created successfully: ${outputPath}`);
      console.log(`PDF size: ${(pdfBytes.length / 1024).toFixed(2)} KB`);

      return {
        outputPath,
        outputDir,
        fileCount: 1,
      };
    } catch (error) {
      console.error("Error in jpgToPdf:", error);
      throw new Error(`Failed to convert images to PDF: ${error.message}`);
    }
  }

  async officeToPdf(filePaths, outputDir, type) {
    try {
      console.log("\n===== OFFICE TO PDF CONVERSION =====");
      console.log("Type:", type);
      console.log("Number of files:", filePaths.length);

      const OfficeService = require("./officeService");
      const outputPaths = [];

      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);

        console.log(`\nFile ${i + 1}/${filePaths.length}: ${fileName}`);
        console.log("Extension:", ext);

        const outputPath = path.join(
          outputDir,
          `converted_${Date.now()}_${i + 1}.pdf`,
        );

        try {
          if (type === "excel" || [".xls", ".xlsx"].includes(ext)) {
            console.log("Converting Excel to PDF...");
            await OfficeService.excelToPdf(filePath, outputPath);
          } else if (type === "word" || [".doc", ".docx"].includes(ext)) {
            console.log("Converting Word to PDF...");
            await OfficeService.wordToPdf(filePath, outputPath);
          } else if (
            type === "powerpoint" ||
            type === "ppt" ||
            [".ppt", ".pptx"].includes(ext)
          ) {
            console.log("Converting PowerPoint to PDF...");
            await OfficeService.pptToPdf(filePath, outputPath);
          } else {
            console.error("Unsupported file type:", ext);
            throw new Error(`Unsupported file type: ${ext}`);
          }

          // Verify output
          if (fs.existsSync(outputPath)) {
            const outputSize = fs.statSync(outputPath).size;
            console.log(
              `✅ Output created: ${outputPath} (${outputSize} bytes)`,
            );

            if (outputSize > 0) {
              outputPaths.push(outputPath);
            }
          }
        } catch (error) {
          console.error(`Failed to convert ${fileName}:`, error);
          throw error;
        }
      }

      return {
        outputPaths,
        outputDir,
        fileCount: outputPaths.length,
      };
    } catch (error) {
      console.error("Error in officeToPdf:", error);
      throw error;
    }
  }

  async htmlToPdf(htmlFiles, outputDir, options = {}) {
    try {
      console.log("\n===== HTML TO PDF CONVERSION =====");
      console.log("Files:", htmlFiles.length);

      const HtmlService = require("./htmlService");
      const outputPaths = [];

      for (let i = 0; i < htmlFiles.length; i++) {
        const htmlFile = htmlFiles[i];
        const fileName = path.basename(htmlFile);

        console.log(`\nProcessing HTML file ${i + 1}: ${fileName}`);

        if (!fs.existsSync(htmlFile)) {
          console.error("❌ File not found");
          continue;
        }

        const outputPath = path.join(
          outputDir,
          `converted_${Date.now()}_${i + 1}.pdf`,
        );

        try {
          await HtmlService.htmlToPdf(htmlFile, outputPath, options);

          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            outputPaths.push(outputPath);
            console.log(`✅ Converted: ${path.basename(outputPath)}`);
          }
        } catch (error) {
          console.error(`❌ Failed: ${error.message}`);
          throw error;
        }
      }

      console.log(
        `\n✅ HTML conversion complete: ${outputPaths.length} file(s)`,
      );
      console.log("====================================\n");

      return {
        outputPaths,
        outputDir,
        fileCount: outputPaths.length,
      };
    } catch (error) {
      console.error("HTML to PDF conversion error:", error);
      throw error;
    }
  }

  async pdfToJpg(pdfPaths, outputDir, options = {}) {
    try {
      console.log("\n===== PDF TO JPG CONVERSION =====");
      console.log("Files:", pdfPaths.length);

      const PdfToImageService = require("./pdfToImageService");
      const outputPaths = [];

      for (let i = 0; i < pdfPaths.length; i++) {
        const pdfPath = pdfPaths[i];
        const fileName = path.basename(pdfPath);

        console.log(`\nProcessing PDF ${i + 1}: ${fileName}`);

        if (!fs.existsSync(pdfPath)) {
          console.error("❌ File not found");
          continue;
        }

        // Create subdirectory for each PDF's images
        const pdfOutputDir =
          pdfPaths.length === 1
            ? outputDir
            : path.join(outputDir, `pdf_${i + 1}`);

        fs.ensureDirSync(pdfOutputDir);

        try {
          const images = await PdfToImageService.pdfToJpg(
            pdfPath,
            pdfOutputDir,
            options,
          );
          outputPaths.push(...images);
          console.log(`✅ Converted ${images.length} page(s) from ${fileName}`);
        } catch (error) {
          console.error(`❌ Failed: ${error.message}`);
          throw error;
        }
      }

      console.log(`\n✅ Total images created: ${outputPaths.length}`);
      console.log("==================================\n");

      return {
        outputPaths,
        outputDir,
        fileCount: outputPaths.length,
      };
    } catch (error) {
      console.error("PDF to JPG conversion error:", error);
      throw error;
    }
  }

  async pdfToWord(pdfPaths, outputDir, options = {}) {
    try {
      console.log("\n===== PDF TO WORD =====");

      const OfficeService = require("./officeService");
      const outputPaths = [];

      for (let i = 0; i < pdfPaths.length; i++) {
        const pdfPath = pdfPaths[i];
        console.log(`Processing: ${path.basename(pdfPath)}`);

        if (!fs.existsSync(pdfPath)) continue;

        const outputPath = path.join(
          outputDir,
          `converted_${Date.now()}_${i + 1}.docx`,
        );

        try {
          await OfficeService.pdfToWord(pdfPath, outputPath);

          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            outputPaths.push(outputPath);
            console.log(`✅ Converted: ${path.basename(outputPath)}`);
          }
        } catch (error) {
          console.error(`❌ Failed: ${error.message}`);
          throw error;
        }
      }

      return {
        outputPaths,
        outputDir,
        fileCount: outputPaths.length,
      };
    } catch (error) {
      console.error("PDF to Word error:", error);
      throw error;
    }
  }

  async pdfToExcel(pdfPaths, outputDir) {
    try {
      console.log("\n===== PDF TO EXCEL CONVERSION =====");
      console.log("Files:", pdfPaths.length);

      const OfficeService = require("./officeService");
      const outputPaths = [];

      for (let i = 0; i < pdfPaths.length; i++) {
        const pdfPath = pdfPaths[i];
        const fileName = path.basename(pdfPath);

        console.log(`\nProcessing PDF ${i + 1}: ${fileName}`);

        if (!fs.existsSync(pdfPath)) {
          console.error("❌ File not found");
          continue;
        }

        const outputPath = path.join(
          outputDir,
          `converted_${Date.now()}_${i + 1}.xlsx`,
        );

        try {
          await OfficeService.pdfToExcel(pdfPath, outputPath);

          if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
            outputPaths.push(outputPath);
            console.log(`✅ Converted: ${path.basename(outputPath)}`);
          } else {
            throw new Error("Output file is empty");
          }
        } catch (error) {
          console.error(`❌ Failed: ${error.message}`);
          throw error;
        }
      }

      console.log(`\n✅ PDF to Excel complete: ${outputPaths.length} file(s)`);
      console.log("====================================\n");

      return {
        outputPaths,
        outputDir,
        fileCount: outputPaths.length,
      };
    } catch (error) {
      console.error("PDF to Excel error:", error);
      throw error;
    }
  }

  async pdfToPpt(pdfPaths, outputDir, options = {}) {
    try {
      console.log("\n===== PDF TO PPT CONVERSION =====");

      const OfficeService = require("./officeService");
      const outputPaths = [];

      // ✅ Ye line hona chahiye
      const mode = options.mode || "text";
      console.log("🔧 Selected mode:", mode); // ⬅️ Check karo ye print kya dikhata hai

      for (let i = 0; i < pdfPaths.length; i++) {
        const pdfPath = pdfPaths[i];

        if (!fs.existsSync(pdfPath)) continue;

        const outputPath = path.join(
          outputDir,
          `converted_${Date.now()}_${i + 1}.pptx`,
        );

        // ✅ Ye line check karo - 'mode' pass ho raha hai?
        await OfficeService.pdfToPpt(pdfPath, outputPath, mode);
        //                                                 ^^^^ Ye zaroori hai

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          outputPaths.push(outputPath);
        }
      }

      return {
        outputPaths,
        outputDir,
        fileCount: outputPaths.length,
      };
    } catch (error) {
      console.error("PDF to PPT error:", error);
      throw error;
    }
  }

  async pdfToPdfa(pdfPaths, outputDir) {
    try {
      console.log(`Converting PDF to PDF/A...`);

      const { PDFDocument } = require("pdf-lib");
      const fs = require("fs-extra");

      const outputPaths = [];

      for (let i = 0; i < pdfPaths.length; i++) {
        const pdfPath = pdfPaths[i];
        console.log(`Processing PDF ${i + 1}: ${pdfPath}`);

        const pdfBuffer = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBuffer);

        // Set PDF/A metadata
        pdfDoc.setTitle("PDF/A Document");
        pdfDoc.setProducer("PDFGenius PDF/A Converter");
        pdfDoc.setCreator("PDFGenius");
        pdfDoc.setSubject("Converted to PDF/A");

        const pdfBytes = await pdfDoc.save({
          useObjectStreams: false,
          addDefaultPage: false,
        });

        const outputPath = path.join(outputDir, `pdfa_${i + 1}.pdf`);
        await fs.writeFile(outputPath, pdfBytes);
        outputPaths.push(outputPath);
      }

      return {
        outputPaths,
        fileCount: outputPaths.length,
      };
    } catch (error) {
      console.error("Error in pdfToPdfa:", error);
      throw new Error(`Failed to convert PDF to PDF/A: ${error.message}`);
    }
  }
}

module.exports = new ConvertService();
