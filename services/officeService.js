const fs = require("fs-extra");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const mammoth = require("mammoth");
const FileHelper = require("../utils/fileHelper");

class OfficeService {
  // ============================================
  // GENERIC LIBREOFFICE CONVERTER (CORE)
  // ============================================
  async convertWithLibreOffice(inputPath, outputPath, targetFormat = "pdf") {
    try {
      console.log(`\n===== LIBREOFFICE CONVERSION (${targetFormat}) =====`);
      console.log("Input:", inputPath);
      console.log("Output:", outputPath);

      const { exec } = require("child_process");
      const util = require("util");
      const execPromise = util.promisify(exec);
      const config = require("../config");

      // Verify input
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      // Create ISOLATED temp directory (prevents concurrent request conflicts)
      const tempDir = path.join(
        path.dirname(outputPath),
        `lo_temp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      );
      fs.ensureDirSync(tempDir);

      // Unique user profile per conversion (prevents LibreOffice locking)
      const userProfileDir = path.join(tempDir, `lo_profile_${Date.now()}`);
      fs.ensureDirSync(userProfileDir);

      // Get LibreOffice path
      const libreOfficePath = config.libreOfficePath || "soffice";
      console.log("LibreOffice path:", libreOfficePath);

      // Build command with unique user profile
      const command = [
        `"${libreOfficePath}"`,
        "--headless",
        "--norestore",
        "--nolockcheck",
        `-env:UserInstallation=file:///${userProfileDir.replace(/\\/g, "/")}`,
        `--convert-to ${targetFormat}`,
        `--outdir "${tempDir}"`,
        `"${inputPath}"`,
      ].join(" ");

      console.log("Running:", command.substring(0, 250) + "...");

      try {
        const { stdout, stderr } = await execPromise(command, {
          timeout: 180000,
          maxBuffer: 1024 * 1024 * 50,
          windowsHide: true,
        });

        if (stdout) {
          console.log("LibreOffice stdout:", stdout.substring(0, 300));
        }
        if (
          stderr &&
          !stderr.toLowerCase().includes("warning") &&
          !stderr.toLowerCase().includes("javaldx")
        ) {
          console.log("LibreOffice stderr:", stderr.substring(0, 300));
        }

        // Find the converted file
        const files = fs.readdirSync(tempDir);
        console.log("Files in temp:", files.join(", "));

        const inputBaseName = path.basename(inputPath, path.extname(inputPath));
        const expectedFile = `${inputBaseName}.${targetFormat}`;

        let convertedPath = null;

        if (files.includes(expectedFile)) {
          convertedPath = path.join(tempDir, expectedFile);
        } else {
          const matchingFile = files.find(
            (f) =>
              f.endsWith(`.${targetFormat}`) && !f.startsWith("lo_profile"),
          );
          if (matchingFile) {
            convertedPath = path.join(tempDir, matchingFile);
          }
        }

        if (!convertedPath || !fs.existsSync(convertedPath)) {
          throw new Error(
            `Converted file not found. Expected: ${expectedFile}. Found: ${files.join(", ")}`,
          );
        }

        // Copy to output
        await fs.copy(convertedPath, outputPath);

        // Cleanup
        await fs.remove(tempDir).catch(() => {});

        if (!fs.existsSync(outputPath)) {
          throw new Error("Output file was not created");
        }

        const outputSize = fs.statSync(outputPath).size;
        console.log(`✅ LibreOffice conversion successful: ${(outputSize / 1024).toFixed(2)} KB`);
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

  // ============================================
  // WORD TO PDF (LibreOffice - Perfect Formatting)
  // ============================================
  async wordToPdf(filePath, outputPath) {
    try {
      console.log("\n===== WORD TO PDF (LibreOffice) =====");
      console.log("Input:", filePath);
      console.log("Output:", outputPath);

      await this.convertWithLibreOffice(filePath, outputPath, "pdf");

      const outputSize = fs.statSync(outputPath).size;
      console.log(`✅ Word to PDF complete: ${(outputSize / 1024).toFixed(2)} KB`);
      console.log("====================================\n");

      return outputPath;
    } catch (error) {
      console.error("❌ Word to PDF failed:", error.message);
      throw new Error(`Word conversion failed: ${error.message}`);
    }
  }

  // ============================================
  // EXCEL TO PDF (LibreOffice - Perfect Tables)
  // ============================================
  async excelToPdf(filePath, outputPath) {
    try {
      console.log("\n===== EXCEL TO PDF (LibreOffice) =====");
      console.log("Input:", filePath);
      console.log("Output:", outputPath);

      await this.convertWithLibreOffice(filePath, outputPath, "pdf");

      const outputSize = fs.statSync(outputPath).size;
      console.log(`✅ Excel to PDF complete: ${(outputSize / 1024).toFixed(2)} KB`);
      console.log("====================================\n");

      return outputPath;
    } catch (error) {
      console.error("❌ Excel to PDF failed:", error.message);
      throw new Error(`Excel conversion failed: ${error.message}`);
    }
  }

  // ============================================
  // PPT TO PDF (LibreOffice - Perfect Visuals)
  // ============================================
  async pptToPdf(filePath, outputPath) {
    try {
      console.log("\n===== PPT TO PDF (LibreOffice) =====");
      console.log("Input:", filePath);
      console.log("Output:", outputPath);

      await this.convertWithLibreOffice(filePath, outputPath, "pdf");

      const outputSize = fs.statSync(outputPath).size;
      console.log(`✅ PPT to PDF complete: ${(outputSize / 1024).toFixed(2)} KB`);
      console.log("====================================\n");

      return outputPath;
    } catch (error) {
      console.error("❌ PPT to PDF failed:", error.message);
      throw new Error(`PowerPoint conversion failed: ${error.message}`);
    }
  }

  // ============================================
  // PDF TO WORD (pdf2docx via Python)
  // ============================================
  async pdfToWord(pdfPath, outputPath) {
    try {
      console.log("\n===== PDF TO WORD (pdf2docx) =====");
      console.log("Input:", pdfPath);
      console.log("Output:", outputPath);

      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Input PDF not found: ${pdfPath}`);
      }

      const inputSize = fs.statSync(pdfPath).size;
      console.log("Input size:", (inputSize / 1024).toFixed(2), "KB");

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

      const outputDir = path.dirname(outputPath);
      fs.ensureDirSync(outputDir);

      const result = await this.runPythonScript(pythonScript, [
        pdfPath,
        outputPath,
      ]);

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

  // ============================================
  // PDF TO EXCEL (pdfplumber via Python)
  // ============================================
  async pdfToExcel(pdfPath, outputPath) {
    try {
      console.log("\n===== PDF TO EXCEL (pdfplumber) =====");
      console.log("Input:", pdfPath);
      console.log("Output:", outputPath);

      if (!fs.existsSync(pdfPath)) {
        throw new Error(`Input PDF not found: ${pdfPath}`);
      }

      const inputSize = fs.statSync(pdfPath).size;
      console.log("Input size:", (inputSize / 1024).toFixed(2), "KB");

      const pythonScript = path.resolve(
        __dirname,
        "..",
        "python",
        "pdf_to_excel.py",
      );

      if (!fs.existsSync(pythonScript)) {
        throw new Error(`Python script not found: ${pythonScript}`);
      }

      const outputDir = path.dirname(outputPath);
      fs.ensureDirSync(outputDir);

      const result = await this.runPythonScript(pythonScript, [
        pdfPath,
        outputPath,
      ]);

      if (!result.success) {
        throw new Error(result.error || "Python conversion failed");
      }

      if (!fs.existsSync(outputPath)) {
        throw new Error("Output Excel file not created");
      }

      const outputSize = fs.statSync(outputPath).size;
      console.log(`✅ Excel file created: ${(outputSize / 1024).toFixed(2)} KB`);
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

  // ============================================
  // PDF TO PPT (Hybrid: text or image mode)
  // ============================================
  async pdfToPpt(pdfPath, outputPath, mode = "text") {
    try {
      console.log("\n===== PDF TO PPT =====");
      console.log("Input:", pdfPath);
      console.log("Mode:", mode);

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

  // ============================================
  // HTML TO PDF (Puppeteer)
  // ============================================
  async htmlToPdfWithPuppeteer(htmlContent, outputPath) {
    try {
      console.log("Converting HTML to PDF using Puppeteer...");

      const puppeteer = require("puppeteer");

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      const fullHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 2cm; line-height: 1.5; }
            h1 { font-size: 24pt; margin-bottom: 20px; }
            h2 { font-size: 18pt; margin-bottom: 15px; }
            h3 { font-size: 14pt; margin-bottom: 10px; }
            p { margin-bottom: 10px; text-align: justify; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
            table, th, td { border: 1px solid #ddd; }
            th, td { padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            img { max-width: 100%; height: auto; }
            ul, ol { margin-bottom: 10px; padding-left: 30px; }
          </style>
        </head>
        <body>${htmlContent}</body>
        </html>
      `;

      await page.setContent(fullHtml, { waitUntil: "networkidle0" });

      await page.pdf({
        path: outputPath,
        format: "A4",
        printBackground: true,
        margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" },
      });

      await browser.close();
      console.log("PDF created successfully with Puppeteer");
    } catch (error) {
      console.error("Puppeteer conversion failed:", error);
      throw error;
    }
  }

  // ============================================
  // PYTHON SCRIPT RUNNER (used by pdf2docx, pdfplumber, etc.)
  // ============================================
  runPythonScript(scriptPath, args) {
    return new Promise((resolve, reject) => {
      const { spawn } = require("child_process");

      if (!fs.existsSync(scriptPath)) {
        return reject(new Error(`Python script not found at: ${scriptPath}`));
      }

      console.log("🐍 Python script:", scriptPath);
      console.log("🐍 Args:", args);

      if (args[0] && !fs.existsSync(args[0])) {
        return reject(new Error(`Input file not found: ${args[0]}`));
      }

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
          cwd: path.join(__dirname, ".."),
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

          if (error.code === "ENOENT") {
            tryPython(index + 1);
          } else {
            reject(new Error(`${pythonCmd} error: ${error.message}`));
          }
        });

        child.on("close", (code) => {
          if (spawnFailed) return;

          console.log(`🔚 Exit code: ${code}`);

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
              if (code === 0) {
                resolve({ success: true, output: stdout });
              } else {
                reject(new Error(stderr || `Python exited with code ${code}`));
              }
            }
          } catch (parseError) {
            console.error("❌ JSON parse failed:", parseError.message);
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

  // ============================================
  // FALLBACK: Word to PDF (if LibreOffice fails)
  // ============================================
  async wordToPdfFallback(filePath, outputPath) {
    try {
      console.log("Using fallback method for Word to PDF...");

      const docxBuffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: docxBuffer });
      const text = result.value;

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

      const paragraphs = text.split("\n").filter((p) => p.trim().length > 0);

      for (const paragraph of paragraphs) {
        const isHeading =
          paragraph.length < 100 && paragraph === paragraph.toUpperCase();
        const currentFont = isHeading ? boldFont : font;
        const currentSize = isHeading ? 16 : fontSize;

        const words = paragraph.split(" ");
        let line = "";

        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          const textWidth = currentFont.widthOfTextAtSize(testLine, currentSize);

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

  // ============================================
  // UTILITY: Create simple error PDF
  // ============================================
  async createErrorPdf(outputPath, message) {
    try {
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
}

module.exports = new OfficeService();