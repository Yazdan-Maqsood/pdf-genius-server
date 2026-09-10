const fs = require("fs-extra");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const mammoth = require("mammoth");
const FileHelper = require("../utils/fileHelper");

class OfficeService {
  async wordToPdf(filePath, outputPath) {
    try {
      console.log(`Converting Word document: ${filePath}`);

      // Read the docx file
      const docxBuffer = await fs.readFile(filePath);

      // Extract HTML with styles from docx using mammoth
      const result = await mammoth.convertToHtml(
        { buffer: docxBuffer },
        {
          // Preserve formatting options
          convertImage: mammoth.images.imgElement(async (image) => {
            const imageBuffer = await image.read();
            const base64 = imageBuffer.toString("base64");
            const contentType = image.contentType || "image/png";
            return {
              src: `data:${contentType};base64,${base64}`,
            };
          }),
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Title'] => h1.title:fresh",
            "p[style-name='Subtitle'] => h2.subtitle:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
            "table => table",
          ],
        },
      );

      const htmlContent = result.value;
      console.log("Word content extracted with formatting");
      console.log("HTML length:", htmlContent.length);

      // Create PDF from HTML using puppeteer
      await this.htmlToPdfWithPuppeteer(htmlContent, outputPath);

      console.log(`Word to PDF conversion complete: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error("Error in wordToPdf:", error);
      // Fallback to simple text extraction
      await this.wordToPdfFallback(filePath, outputPath);
      return outputPath;
    }
  }

  async htmlToPdfWithPuppeteer(htmlContent, outputPath) {
    try {
      console.log("Converting HTML to PDF using Puppeteer...");

      const puppeteer = require("puppeteer");

      // Launch browser
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // Create full HTML with styling
      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 2cm;
              line-height: 1.5;
            }
            h1 { font-size: 24pt; margin-bottom: 20px; }
            h2 { font-size: 18pt; margin-bottom: 15px; }
            h3 { font-size: 14pt; margin-bottom: 10px; }
            p { margin-bottom: 10px; text-align: justify; }
            table { 
              border-collapse: collapse; 
              width: 100%;
              margin-bottom: 15px;
            }
            table, th, td {
              border: 1px solid #ddd;
            }
            th, td {
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            img {
              max-width: 100%;
              height: auto;
            }
            ul, ol {
              margin-bottom: 10px;
              padding-left: 30px;
            }
            strong { font-weight: bold; }
            em { font-style: italic; }
            .title { font-size: 28pt; font-weight: bold; text-align: center; margin-bottom: 20px; }
            .subtitle { font-size: 18pt; text-align: center; color: #666; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
        </html>
      `;

      await page.setContent(fullHtml, { waitUntil: "networkidle0" });

      // Generate PDF
      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: {
          top: "1cm",
          right: "1cm",
          bottom: "1cm",
          left: "1cm",
        },
      });

      await browser.close();
      console.log("PDF created successfully with Puppeteer");
    } catch (error) {
      console.error("Puppeteer conversion failed:", error);
      throw error;
    }
  }

  async wordToPdfFallback(filePath, outputPath) {
    try {
      console.log("Using fallback method for Word to PDF...");

      const docxBuffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      const text = result.value;

      // Create PDF with text
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont("Helvetica");
      const boldFont = await pdfDoc.embedFont("Helvetica-Bold");

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 50;
      const lineHeight = 14;
      const fontSize = 11;

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let yPosition = pageHeight - margin;

      // Split text into paragraphs
      const paragraphs = text.split("\n").filter((p) => p.trim().length > 0);

      for (const paragraph of paragraphs) {
        // Check if paragraph is a heading
        const isHeading =
          paragraph.length < 100 && paragraph === paragraph.toUpperCase();
        const currentFont = isHeading ? boldFont : font;
        const currentSize = isHeading ? 16 : fontSize;

        // Wrap text
        const words = paragraph.split(" ");
        let line = "";

        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          const textWidth = currentFont.widthOfTextAtSize(
            testLine,
            currentSize,
          );

          if (textWidth > pageWidth - margin * 2) {
            if (yPosition < margin + lineHeight) {
              currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
              yPosition = pageHeight - margin;
            }

            currentPage.drawText(line, {
              x: margin,
              y: yPosition,
              size: currentSize,
              font: currentFont,
            });

            yPosition -= lineHeight;
            line = word;
          } else {
            line = testLine;
          }
        }

        // Draw last line
        if (line) {
          if (yPosition < margin + lineHeight) {
            currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
            yPosition = pageHeight - margin;
          }

          currentPage.drawText(line, {
            x: margin,
            y: yPosition,
            size: currentSize,
            font: currentFont,
          });
          yPosition -= lineHeight;
        }

        // Extra space between paragraphs
        yPosition -= 5;
      }

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);
      console.log("Fallback conversion complete");
    } catch (error) {
      console.error("Fallback conversion failed:", error);
      throw error;
    }
  }

  async excelToPdf(filePath, outputPath) {
    try {
      console.log("Excel conversion started for:", filePath);

      const XLSX = require("xlsx");

      // Read the Excel file
      const workbook = XLSX.readFile(filePath);

      // Get first sheet
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to CSV-like array
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      // Create PDF
      const { PDFDocument, rgb } = require("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont("Helvetica");
      const boldFont = await pdfDoc.embedFont("Helvetica-Bold");

      // Landscape A4
      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const margin = 40;
      const rowHeight = 20;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      // Calculate columns
      const numCols = Math.max(...data.map((row) => row.length));
      const colWidth = (pageWidth - 2 * margin) / numCols;

      // Draw each row
      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];

        // New page if needed
        if (y < margin + rowHeight) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }

        // Header background for first row
        if (rowIndex === 0) {
          page.drawRectangle({
            x: margin,
            y: y - rowHeight,
            width: pageWidth - 2 * margin,
            height: rowHeight,
            color: rgb(0.85, 0.85, 0.85),
          });
        }

        // Draw cells
        for (let colIndex = 0; colIndex < numCols; colIndex++) {
          const text = row[colIndex] ? String(row[colIndex]) : "";
          page.drawText(text.substring(0, 40), {
            x: margin + colIndex * colWidth + 2,
            y: y - rowHeight + 5,
            size: rowIndex === 0 ? 10 : 8,
            font: rowIndex === 0 ? boldFont : font,
          });
        }

        y -= rowHeight;
      }

      // Save
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);

      console.log("Excel conversion completed successfully");
      return outputPath;
    } catch (error) {
      console.error("Excel conversion failed:", error.message);
      throw new Error(`Excel conversion failed: ${error.message}`);
    }
  }

  async createSimplePdf(outputPath, title, message) {
    try {
      const { PDFDocument } = require("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont("Helvetica");

      const page = pdfDoc.addPage([595.28, 841.89]);
      page.drawText(title, {
        x: 50,
        y: 800,
        size: 20,
        font: font,
      });

      page.drawText(message || "Conversion failed", {
        x: 50,
        y: 770,
        size: 12,
        font: font,
        maxWidth: 500,
      });

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);
    } catch (error) {
      console.error("Error creating simple PDF:", error);
    }
  }

  async createPdfFromTable(data, outputPath) {
    try {
      console.log("Creating PDF from Excel table data...");

      const { PDFDocument, rgb } = require("pdf-lib");
      const pdfDoc = await PDFDocument.create();

      // Embed fonts
      const font = await pdfDoc.embedFont("Helvetica");
      const boldFont = await pdfDoc.embedFont("Helvetica-Bold");

      // Page setup - Landscape for tables
      const pageWidth = 841.89; // A4 landscape
      const pageHeight = 595.28;
      const margin = 40;
      const headerHeight = 30;
      const cellHeight = 22;
      const fontSize = 8;
      const headerFontSize = 10;

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let yPosition = pageHeight - margin;

      // Calculate number of columns
      const numColumns = Math.max(...data.map((row) => row.length));
      console.log(`Number of columns: ${numColumns}`);

      // Calculate column widths
      const tableWidth = pageWidth - margin * 2;
      const columnWidth = tableWidth / numColumns;

      // Draw header row
      if (data.length > 0 && data[0]) {
        // Header background
        currentPage.drawRectangle({
          x: margin,
          y: yPosition - headerHeight,
          width: tableWidth,
          height: headerHeight,
          color: rgb(0.85, 0.85, 0.85),
        });

        // Header text
        for (let colIndex = 0; colIndex < numColumns; colIndex++) {
          const cellText = data[0][colIndex] ? String(data[0][colIndex]) : "";
          const xPosition = margin + colIndex * columnWidth;

          currentPage.drawText(cellText.substring(0, 50), {
            x: xPosition + 5,
            y: yPosition - headerHeight + 5,
            size: headerFontSize,
            font: boldFont,
          });
        }

        yPosition -= headerHeight;
      }

      // Draw data rows
      for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];

        // Check if we need a new page
        if (yPosition < margin + cellHeight) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = pageHeight - margin;

          // Redraw header on new page
          if (data[0]) {
            currentPage.drawRectangle({
              x: margin,
              y: yPosition - headerHeight,
              width: tableWidth,
              height: headerHeight,
              color: rgb(0.85, 0.85, 0.85),
            });

            for (let colIndex = 0; colIndex < numColumns; colIndex++) {
              const cellText = data[0][colIndex]
                ? String(data[0][colIndex])
                : "";
              const xPosition = margin + colIndex * columnWidth;

              currentPage.drawText(cellText.substring(0, 50), {
                x: xPosition + 5,
                y: yPosition - headerHeight + 5,
                size: headerFontSize,
                font: boldFont,
              });
            }

            yPosition -= headerHeight;
          }
        }

        // Alternate row background
        if (rowIndex % 2 === 0) {
          currentPage.drawRectangle({
            x: margin,
            y: yPosition - cellHeight,
            width: tableWidth,
            height: cellHeight,
            color: rgb(0.95, 0.95, 0.95),
          });
        }

        // Draw cell data
        for (let colIndex = 0; colIndex < numColumns; colIndex++) {
          const cellText =
            row[colIndex] !== undefined ? String(row[colIndex]) : "";
          const xPosition = margin + colIndex * columnWidth;

          currentPage.drawText(cellText.substring(0, 50), {
            x: xPosition + 5,
            y: yPosition - cellHeight + 5,
            size: fontSize,
            font: font,
          });
        }

        yPosition -= cellHeight;
      }

      // Save PDF
      const pdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      await fs.writeFile(outputPath, pdfBytes);
      console.log(`PDF created: ${(pdfBytes.length / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error("Error creating PDF from table:", error);
      throw error;
    }
  }

  async createErrorPdf(outputPath, message) {
    try {
      const { PDFDocument } = require("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont("Helvetica");

      const page = pdfDoc.addPage([595.28, 841.89]);
      page.drawText("Conversion Error", {
        x: 50,
        y: 800,
        size: 20,
        font: font,
      });

      page.drawText(message, {
        x: 50,
        y: 770,
        size: 12,
        font: font,
        maxWidth: 500,
      });

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);
    } catch (error) {
      console.error("Error creating error PDF:", error);
    }
  }

  async createPdfFromTable(data, outputPath) {
    try {
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont("Helvetica");
      const boldFont = await pdfDoc.embedFont("Helvetica-Bold");

      const pageWidth = 841.89; // Landscape
      const pageHeight = 595.28;
      const margin = 40;
      const cellHeight = 25;
      const fontSize = 9;

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let yPosition = pageHeight - margin;

      const numColumns = data[0] ? data[0].length : 1;
      const tableWidth = pageWidth - margin * 2;
      const columnWidth = tableWidth / numColumns;

      for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];

        if (yPosition < margin + cellHeight) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = pageHeight - margin;
        }

        // Header row background
        if (rowIndex === 0) {
          currentPage.drawRectangle({
            x: margin,
            y: yPosition - cellHeight,
            width: tableWidth,
            height: cellHeight,
            color: { r: 0.85, g: 0.85, b: 0.85 },
          });
        }

        for (let colIndex = 0; colIndex < numColumns; colIndex++) {
          const cellText = row[colIndex] ? String(row[colIndex]) : "";
          const xPosition = margin + colIndex * columnWidth;

          currentPage.drawText(cellText.substring(0, 40), {
            x: xPosition + 5,
            y: yPosition - 5,
            size: rowIndex === 0 ? 10 : fontSize,
            font: rowIndex === 0 ? boldFont : font,
          });
        }

        yPosition -= cellHeight;
      }

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);
    } catch (error) {
      console.error("Error creating PDF from table:", error);
      throw error;
    }
  }

  async pptToPdf(filePath, outputPath) {
    try {
      console.log("PowerPoint conversion started for:", filePath);
      console.log("Using LibreOffice for conversion...");

      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      const path = require("path");
      const fs = require("fs-extra");
      const config = require("../config");

      // Create temp directory for LibreOffice output
      const tempDir = path.join(path.dirname(outputPath), "libreoffice_temp");
      fs.ensureDirSync(tempDir);

      // Get LibreOffice path
      const libreOfficePath = config.libreOfficePath || "soffice";

      // Build conversion command
      const command = `"${libreOfficePath}" --headless --convert-to pdf --outdir "${tempDir}" "${filePath}"`;

      console.log("Running command:", command);

      try {
        // Execute LibreOffice conversion
        const { stdout, stderr } = await execPromise(command, {
          timeout: 60000,
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        if (stderr) {
          console.log("LibreOffice stderr:", stderr);
        }

        console.log("LibreOffice conversion completed");

        // Find the converted PDF
        const inputBaseName = path.basename(filePath, path.extname(filePath));
        const convertedPdfPath = path.join(tempDir, `${inputBaseName}.pdf`);

        if (fs.existsSync(convertedPdfPath)) {
          // Copy to output path
          await fs.copy(convertedPdfPath, outputPath);
          console.log("PDF copied to output path");

          // Clean up temp directory
          await fs.remove(tempDir);

          return outputPath;
        } else {
          throw new Error(
            "Converted PDF not found after LibreOffice conversion",
          );
        }
      } catch (libreOfficeError) {
        console.error(
          "LibreOffice conversion failed:",
          libreOfficeError.message,
        );

        // Clean up temp directory
        await fs.remove(tempDir).catch(() => {});

        // Fallback to text extraction
        console.log("Falling back to text extraction...");
        return await this.extractPptTextToPdf(filePath, outputPath);
      }
    } catch (error) {
      console.error("PowerPoint conversion failed:", error);
      throw new Error(`PowerPoint conversion failed: ${error.message}`);
    }
  }

  async renderPptAsImages(filePath, outputPath) {
    const { exec } = require("child_process");
    const util = require("util");
    const execPromise = util.promisify(exec);
    const path = require("path");
    const fs = require("fs-extra");
    const sharp = require("sharp");

    try {
      console.log("Rendering PPT slides as images...");

      // Create temp directory for images
      const tempDir = path.join(path.dirname(outputPath), "temp_images");
      fs.ensureDirSync(tempDir);

      // Convert PPT to PDF first using LibreOffice
      const pdfTempPath = path.join(tempDir, "temp.pdf");

      // Try LibreOffice command
      const libreofficeCommand = `soffice --headless --convert-to pdf --outdir "${tempDir}" "${filePath}"`;

      try {
        await execPromise(libreofficeCommand, { timeout: 60000 });
        console.log("Converted PPT to PDF using LibreOffice");

        // If successful, copy the PDF
        const convertedPdfPath = path.join(
          tempDir,
          path.basename(filePath, path.extname(filePath)) + ".pdf",
        );
        if (fs.existsSync(convertedPdfPath)) {
          await fs.copy(convertedPdfPath, outputPath);
          await fs.remove(tempDir);
          return outputPath;
        }
      } catch (libreOfficeError) {
        console.error("LibreOffice failed:", libreOfficeError.message);
      }

      // If LibreOffice not available, try alternative methods
      console.log("LibreOffice not available, trying alternative methods...");

      // Method: Extract images from PPTX
      const JSZip = require("jszip");
      const zip = new JSZip();
      const fileBuffer = fs.readFileSync(filePath);
      const zipContent = await zip.loadAsync(fileBuffer);

      // Find all slide images
      const imageFiles = Object.keys(zipContent.files).filter((name) =>
        name.match(/^ppt\/slides\/slide\d+\.xml$/),
      );

      // Render each slide as image (simplified)
      const { PDFDocument, rgb } = require("pdf-lib");
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < imageFiles.length; i++) {
        const slideFile = imageFiles[i];
        const slideXml = await zipContent.files[slideFile].async("string");

        // Extract slide dimensions
        const slideMatch = slideXml.match(/<p:sldSz cx="(\d+)" cy="(\d+)"/);
        let slideWidth = 12192000; // Default PPTX width in EMU
        let slideHeight = 6858000; // Default PPTX height in EMU

        if (slideMatch) {
          slideWidth = parseInt(slideMatch[1]);
          slideHeight = parseInt(slideMatch[2]);
        }

        // Convert EMU to points (914400 EMU = 1 inch = 72 points)
        const pageWidth = (slideWidth / 914400) * 72;
        const pageHeight = (slideHeight / 914400) * 72;

        // Create page for this slide
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Try to render slide background
        const bgMatch = slideXml.match(
          /<p:bg>[\s\S]*?<a:solidFill>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]{6})"/,
        );
        if (bgMatch) {
          const bgColor = bgMatch[1];
          const r = parseInt(bgColor.substring(0, 2), 16) / 255;
          const g = parseInt(bgColor.substring(2, 4), 16) / 255;
          const b = parseInt(bgColor.substring(4, 6), 16) / 255;

          page.drawRectangle({
            x: 0,
            y: 0,
            width: pageWidth,
            height: pageHeight,
            color: rgb(r, g, b),
          });
        }

        // Extract and draw images from the slide
        const imageRegex = /<a:blip r:embed="([^"]+)"/g;
        let imageMatch;

        while ((imageMatch = imageRegex.exec(slideXml)) !== null) {
          const imageId = imageMatch[1];
          const imagePath = `ppt/media/${imageId}`;

          if (zipContent.files[imagePath]) {
            try {
              const imageBuffer =
                await zipContent.files[imagePath].async("nodebuffer");

              // Process image with sharp
              const processedImage = await sharp(imageBuffer)
                .jpeg({ quality: 90 })
                .toBuffer();

              // Embed image in PDF
              const embeddedImage = await pdfDoc.embedJpg(processedImage);
              page.drawImage(embeddedImage, {
                x: 50,
                y: 50,
                width: pageWidth - 100,
                height: pageHeight - 100,
              });
            } catch (imageError) {
              console.error(
                `Failed to process image ${imagePath}:`,
                imageError.message,
              );
            }
          }
        }
      }

      await fs.remove(tempDir);
      return outputPath;
    } catch (error) {
      console.error("Image rendering failed:", error);
      throw error;
    }
  }

  async extractPptTextToPdf(filePath, outputPath) {
    // This is the existing text extraction method
    // (Keep the code from previous implementation)
    try {
      console.log("Extracting text from PowerPoint...");

      const JSZip = require("jszip");
      const zip = new JSZip();
      const fileBuffer = fs.readFileSync(filePath);
      const zipContent = await zip.loadAsync(fileBuffer);

      const slideFiles = Object.keys(zipContent.files)
        .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
        .sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
          const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
          return numA - numB;
        });

      const slidesContent = [];

      for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const slideXml = await zipContent.files[slideFile].async("string");

        const allTexts = [];
        const textRegex = /<a:t>([^<]*)<\/a:t>/g;
        let match;

        while ((match = textRegex.exec(slideXml)) !== null) {
          let text = match[1]
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

          if (text.length > 0) {
            allTexts.push(text);
          }
        }

        const title = allTexts[0] || `Slide ${i + 1}`;
        const content = allTexts.slice(1).join("\n");

        slidesContent.push({ title, content });
      }

      // Create PDF from extracted text
      const { PDFDocument, rgb } = require("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont("Helvetica");
      const boldFont = await pdfDoc.embedFont("Helvetica-Bold");

      const pageWidth = 841.89;
      const pageHeight = 595.28;
      const margin = 50;

      for (let i = 0; i < slidesContent.length; i++) {
        const slide = slidesContent[i];
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Draw title
        page.drawText(slide.title.substring(0, 80), {
          x: margin,
          y: pageHeight - margin,
          size: 20,
          font: boldFont,
        });

        // Draw content
        if (slide.content) {
          page.drawText(slide.content.substring(0, 2000), {
            x: margin,
            y: pageHeight - margin - 40,
            size: 11,
            font: font,
            maxWidth: pageWidth - margin * 2,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(outputPath, pdfBytes);

      return outputPath;
    } catch (error) {
      console.error("Text extraction failed:", error);
      throw error;
    }
  }

  async convertWithLibreOffice(inputPath, outputPath, targetFormat = "docx") {
    try {
      console.log(`\n===== LIBREOFFICE CONVERSION (${targetFormat}) =====`);
      console.log("Input:", inputPath);
      console.log("Output:", outputPath);

      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      const path = require("path");
      const fs = require("fs-extra");
      const config = require("../config");

      // Create temp directory
      const tempDir = path.join(
        path.dirname(outputPath),
        `lo_temp_${Date.now()}`,
      );
      fs.ensureDirSync(tempDir);

      // Get LibreOffice path
      const libreOfficePath = config.libreOfficePath || "soffice";

      // Build command
      const command = `"${libreOfficePath}" --headless --convert-to ${targetFormat} --outdir "${tempDir}" "${inputPath}"`;

      console.log("Running command:", command);

      try {
        const { stdout, stderr } = await execPromise(command, {
          timeout: 120000,
          maxBuffer: 1024 * 1024 * 10,
        });

        if (stderr && !stderr.includes("Warning")) {
          console.log("LibreOffice stderr:", stderr);
        }

        // Find the converted file
        const inputBaseName = path.basename(inputPath, path.extname(inputPath));
        const possibleFiles = fs.readdirSync(tempDir);
        console.log("Files in temp dir:", possibleFiles);

        const convertedFile = possibleFiles.find(
          (f) => f.startsWith(inputBaseName) && f.endsWith(`.${targetFormat}`),
        );

        if (!convertedFile) {
          throw new Error(
            `Converted file not found. Expected: ${inputBaseName}.${targetFormat}`,
          );
        }

        const convertedPath = path.join(tempDir, convertedFile);
        await fs.copy(convertedPath, outputPath);

        // Cleanup
        await fs.remove(tempDir);

        console.log("✅ LibreOffice conversion successful");
        console.log("Output:", outputPath);
        console.log("=====================================\n");

        return outputPath;
      } catch (error) {
        await fs.remove(tempDir).catch(() => {});
        throw new Error(`LibreOffice conversion failed: ${error.message}`);
      }
    } catch (error) {
      console.error("LibreOffice conversion error:", error);
      throw error;
    }
  }

  async pdfToWord(pdfPath, outputPath) {
    try {
      console.log("\n===== PDF TO WORD (pdf2docx) =====");

      const { spawn } = require("child_process");
      const path = require("path");
      const fs = require("fs-extra");

      // Verify input
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Input PDF not found: ${pdfPath}`);
      }

      const inputSize = fs.statSync(pdfPath).size;
      console.log("Input size:", (inputSize / 1024).toFixed(2), "KB");

      // Verify script
      const pythonScript = path.resolve(
        __dirname,
        "..",
        "python",
        "pdf_to_word.py",
      );
      console.log("Python script:", pythonScript);

      if (!fs.existsSync(pythonScript)) {
        throw new Error(`Python script not found: ${pythonScript}`);
      }

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      fs.ensureDirSync(outputDir);

      // Run Python
      const result = await this.runPythonScript(pythonScript, [
        pdfPath,
        outputPath,
      ]);

      // Verify output
      if (!fs.existsSync(outputPath)) {
        throw new Error("Output file was not created by Python script");
      }

      const outputSize = fs.statSync(outputPath).size;
      console.log(`✅ Word file created: ${(outputSize / 1024).toFixed(2)} KB`);
      console.log("===================================\n");

      return outputPath;
    } catch (error) {
      console.error("❌ PDF to Word failed:", error.message);
      throw error;
    }
  }

  // Helper method to run Python script
  runPythonScript(scriptPath, args) {
    return new Promise((resolve, reject) => {
      const { spawn } = require("child_process");
      const path = require("path");
      const fs = require("fs-extra");

      // Verify script exists
      if (!fs.existsSync(scriptPath)) {
        return reject(new Error(`Python script not found at: ${scriptPath}`));
      }

      console.log("🐍 Python script:", scriptPath);
      console.log("🐍 Args:", args);

      // Verify input file exists (args[0] is input PDF)
      if (args[0] && !fs.existsSync(args[0])) {
        return reject(new Error(`Input PDF not found: ${args[0]}`));
      }

      // Try multiple python commands
      const pythonCommands = ["python", "py", "python3"];

      const tryPython = (index) => {
        if (index >= pythonCommands.length) {
          return reject(
            new Error("Python not found. Tried: python, py, python3"),
          );
        }

        const pythonCmd = pythonCommands[index];
        console.log(`\n🐍 Attempt ${index + 1}: ${pythonCmd}`);

        const child = spawn(pythonCmd, [scriptPath, ...args], {
          stdio: ["pipe", "pipe", "pipe"],
          cwd: path.join(__dirname, ".."), // Server root
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        });

        let stdout = "";
        let stderr = "";
        let spawnFailed = false;

        child.stdout.on("data", (data) => {
          const text = data.toString();
          stdout += text;
          console.log("📤 stdout:", text.trim());
        });

        child.stderr.on("data", (data) => {
          const text = data.toString();
          stderr += text;
          console.log("📥 stderr:", text.trim());
        });

        child.on("error", (error) => {
          spawnFailed = true;
          console.error(`❌ ${pythonCmd} spawn failed:`, error.message);

          // If command not found, try next
          if (error.code === "ENOENT") {
            tryPython(index + 1);
          } else {
            reject(new Error(`${pythonCmd} error: ${error.message}`));
          }
        });

        child.on("close", (code) => {
          if (spawnFailed) return;

          console.log(`🔚 Exit code: ${code}`);

          // Try to parse JSON from stdout
          try {
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);

              if (!result.success) {
                const errorMsg = result.error || "Unknown Python error";
                const traceback = result.traceback || "";
                console.error("❌ Python error:", errorMsg);
                if (traceback) console.error("❌ Traceback:", traceback);

                return reject(new Error(errorMsg));
              }

              console.log("✅ Python conversion successful");
              resolve(result);
            } else {
              // No JSON - use exit code
              if (code === 0) {
                resolve({ success: true, output: stdout });
              } else {
                reject(new Error(stderr || `Python exited with code ${code}`));
              }
            }
          } catch (parseError) {
            console.error("❌ JSON parse failed:", parseError.message);
            console.error("❌ Raw stdout:", stdout);

            if (code === 0) {
              resolve({ success: true, output: stdout });
            } else {
              reject(
                new Error(
                  stderr || stdout || `Parse failed: ${parseError.message}`,
                ),
              );
            }
          }
        });
      };

      tryPython(0);
    });
  }

  // ✅ Smart text parsing and formatting
  parseAndFormatText(text) {
    console.log("Parsing and formatting text...");

    // Clean up text
    let cleaned = text
      .replace(/Scanned with CamScanner/gi, "")
      .replace(/Scanned by CamScanner/gi, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    // Split into lines
    const lines = cleaned.split("\n");

    const elements = [];
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line - flush paragraph and add spacing
      if (trimmed.length === 0) {
        if (currentParagraph.length > 0) {
          const paraText = currentParagraph.join(" ").trim();
          if (paraText.length > 0) {
            elements.push({
              type: "paragraph",
              text: this.smartParagraph(paraText),
            });
          }
          currentParagraph = [];
        }
        elements.push({ type: "empty" });
        continue;
      }

      // ✅ Detect headings
      const headingInfo = this.detectHeading(trimmed, i, lines);

      if (headingInfo.isHeading) {
        // Flush current paragraph
        if (currentParagraph.length > 0) {
          const paraText = currentParagraph.join(" ").trim();
          if (paraText.length > 0) {
            elements.push({
              type: "paragraph",
              text: this.smartParagraph(paraText),
            });
          }
          currentParagraph = [];
        }

        elements.push({
          type: headingInfo.level === 1 ? "heading1" : "heading2",
          text: trimmed,
        });
        continue;
      }

      // ✅ Detect bullet points
      if (/^[\u2022\u2023\u25E6\u2043\u2219•▪▫◦‣⁃\-*+]\s+/.test(trimmed)) {
        if (currentParagraph.length > 0) {
          const paraText = currentParagraph.join(" ").trim();
          if (paraText.length > 0) {
            elements.push({
              type: "paragraph",
              text: this.smartParagraph(paraText),
            });
          }
          currentParagraph = [];
        }

        elements.push({
          type: "listItem",
          text: trimmed.replace(
            /^[\u2022\u2023\u25E6\u2043\u2219•▪▫◦‣⁃\-*+]\s+/,
            "",
          ),
        });
        continue;
      }

      // ✅ Detect numbered lists
      if (/^\d+[\.\)]\s+/.test(trimmed)) {
        if (currentParagraph.length > 0) {
          const paraText = currentParagraph.join(" ").trim();
          if (paraText.length > 0) {
            elements.push({
              type: "paragraph",
              text: this.smartParagraph(paraText),
            });
          }
          currentParagraph = [];
        }

        elements.push({
          type: "numberedItem",
          text: trimmed.replace(/^\d+[\.\)]\s+/, ""),
        });
        continue;
      }

      // ✅ Regular text - accumulate into paragraph
      currentParagraph.push(trimmed);

      // If line ends with period and is long enough, treat as paragraph end
      if (trimmed.endsWith(".") && trimmed.length > 100) {
        const paraText = currentParagraph.join(" ").trim();
        elements.push({
          type: "paragraph",
          text: this.smartParagraph(paraText),
        });
        currentParagraph = [];
      }
    }

    // Flush remaining paragraph
    if (currentParagraph.length > 0) {
      const paraText = currentParagraph.join(" ").trim();
      if (paraText.length > 0) {
        elements.push({
          type: "paragraph",
          text: this.smartParagraph(paraText),
        });
      }
    }

    console.log(`Parsed ${elements.length} elements`);
    return elements;
  }

  // ✅ Smart paragraph formatting
  smartParagraph(text) {
    // Fix common issues
    let result = text
      // Join hyphenated line breaks
      .replace(/(\w+)-\s+(\w+)/g, "$1$2")
      // Fix spacing after punctuation
      .replace(/([.!?,;:])([A-Z])/g, "$1 $2")
      // Fix multiple spaces
      .replace(/\s+/g, " ")
      // Capitalize first letter of sentences
      .replace(/(^\w|\.\s+\w)/g, (m) => m.toUpperCase())
      .trim();

    return result;
  }

  // ✅ Detect if a line is a heading
  detectHeading(line, index, allLines) {
    // Too long to be heading
    if (line.length > 100) {
      return { isHeading: false };
    }

    // Too short
    if (line.length < 3) {
      return { isHeading: false };
    }

    // Ends with period - probably not heading
    if (line.endsWith(".")) {
      return { isHeading: false };
    }

    // Check patterns

    // Pattern 1: All uppercase and short
    const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);
    if (isAllCaps && line.length < 80) {
      return { isHeading: true, level: 1 };
    }

    // Pattern 2: Starts with number and period (like "1. Introduction")
    if (/^\d+\.\s+[A-Z]/.test(line) && line.length < 80) {
      return { isHeading: true, level: 2 };
    }

    // Pattern 3: Short line that stands alone with capital letters
    if (line.length < 60 && /^[A-Z]/.test(line) && !line.endsWith(",")) {
      // Check if previous line is empty (heading indicator)
      const prevLine = index > 0 ? allLines[index - 1] : "";
      const nextLine = index < allLines.length - 1 ? allLines[index + 1] : "";

      if (prevLine.trim() === "" && nextLine.trim() !== "") {
        // Check word count
        const wordCount = line.split(/\s+/).length;
        if (wordCount <= 8) {
          return { isHeading: true, level: 2 };
        }
      }
    }

    // Pattern 4: Chapter/Section indicators
    if (/^(chapter|section|part|appendix)\s+\d+/i.test(line)) {
      return { isHeading: true, level: 1 };
    }

    return { isHeading: false };
  }

  async extractTextWithOCR(pdfPath) {
    try {
      console.log("Starting OCR process...");

      const Tesseract = require("tesseract.js");
      const { createCanvas } = require("canvas");
      const fs = require("fs-extra");
      const path = require("path");
      const os = require("os");

      // Load pdfjs
      let pdfjsLib;
      try {
        pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
      } catch (err) {
        pdfjsLib = require("pdfjs-dist");
      }

      // Read PDF
      const data = new Uint8Array(await fs.readFile(pdfPath));
      const loadingTask = pdfjsLib.getDocument({
        data,
        disableFontFace: true,
      });

      const pdf = await loadingTask.promise;
      console.log("PDF loaded for OCR. Pages:", pdf.numPages);

      // Create temp directory for images
      const tempDir = path.join(os.tmpdir(), `ocr_${Date.now()}`);
      fs.ensureDirSync(tempDir);

      let allText = "";

      // Process each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`OCR on page ${pageNum}/${pdf.numPages}...`);

        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext("2d");

        context.fillStyle = "white";
        context.fillRect(0, 0, viewport.width, viewport.height);

        await page.render({
          canvasContext: context,
          viewport: viewport,
          background: "white",
        }).promise;

        // Save page as image
        const imagePath = path.join(tempDir, `page_${pageNum}.png`);
        const imageBuffer = canvas.toBuffer("image/png");
        await fs.writeFile(imagePath, imageBuffer);

        // Run OCR on the image
        console.log(`Recognizing text on page ${pageNum}...`);
        const { data: ocrResult } = await Tesseract.recognize(
          imagePath,
          "eng",
          {
            logger: (info) => {
              if (info.status === "recognizing text") {
                const percent = Math.round(info.progress * 100);
                console.log(`OCR progress (page ${pageNum}): ${percent}%`);
              }
            },
          },
        );

        const pageText = ocrResult.text || "";
        console.log(`Page ${pageNum} text length: ${pageText.length}`);

        allText += pageText + "\n\n";
      }

      // Cleanup
      await fs.remove(tempDir);

      console.log("OCR complete. Total text length:", allText.length);

      return allText;
    } catch (error) {
      console.error("OCR failed:", error);
      throw new Error(`OCR failed: ${error.message}`);
    }
  }

  async pdfToExcel(pdfPath, outputPath) {
    try {
      console.log("\n===== PDF TO EXCEL (pdfplumber) =====");
      console.log("Input:", pdfPath);
      console.log("Output:", outputPath);

      const path = require("path");
      const fs = require("fs-extra");

      // Verify input
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Input PDF not found: ${pdfPath}`);
      }

      const inputSize = fs.statSync(pdfPath).size;
      console.log("Input size:", (inputSize / 1024).toFixed(2), "KB");

      // Verify script
      const pythonScript = path.resolve(
        __dirname,
        "..",
        "python",
        "pdf_to_excel.py",
      );
      console.log("Python script:", pythonScript);

      if (!fs.existsSync(pythonScript)) {
        throw new Error(`Python script not found: ${pythonScript}`);
      }

      // Ensure output directory
      const outputDir = path.dirname(outputPath);
      fs.ensureDirSync(outputDir);

      // Run Python script
      const result = await this.runPythonScript(pythonScript, [
        pdfPath,
        outputPath,
      ]);

      console.log("Python result:", result);

      if (!result.success) {
        throw new Error(result.error || "Python conversion failed");
      }

      // Verify output
      if (!fs.existsSync(outputPath)) {
        throw new Error("Output Excel file not created");
      }

      const outputSize = fs.statSync(outputPath).size;
      console.log(
        `✅ Excel file created: ${(outputSize / 1024).toFixed(2)} KB`,
      );
      console.log(
        `   Pages: ${result.pages || "N/A"}, Tables: ${result.tables || "N/A"}`,
      );
      console.log("=====================================\n");

      return outputPath;
    } catch (error) {
      console.error("❌ PDF to Excel failed:", error.message);
      throw error;
    }
  }

  async pdfToPpt(pdfPath, outputPath, mode = "text") {
    try {
      console.log("\n===== PDF TO PPT =====");
      console.log("Input:", pdfPath);
      console.log("Mode:", mode);

      const path = require("path");
      const fs = require("fs-extra");

      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Input PDF not found: ${pdfPath}`);
      }

      const pythonScript = path.resolve(
        __dirname,
        "..",
        "python",
        "pdf_to_ppt.py",
      );

      if (!fs.existsSync(pythonScript)) {
        throw new Error(`Python script not found: ${pythonScript}`);
      }

      const outputDir = path.dirname(outputPath);
      fs.ensureDirSync(outputDir);

      // Pass mode as 3rd argument
      const result = await this.runPythonScript(pythonScript, [
        pdfPath,
        outputPath,
        mode,
      ]);

      if (!result.success) {
        throw new Error(result.error || "PowerPoint conversion failed");
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error("Output PPT file not created");
      }

      const outputSize = fs.statSync(outputPath).size;
      console.log(`✅ PPT created: ${(outputSize / 1024).toFixed(2)} KB`);
      console.log(`   Mode: ${result.mode}, Slides: ${result.slides}`);
      console.log("=====================================\n");

      return outputPath;
    } catch (error) {
      console.error("❌ PDF to PPT failed:", error.message);
      throw error;
    }
  }
}

module.exports = new OfficeService();
