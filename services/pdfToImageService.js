const fs = require("fs-extra");
const path = require("path");
const { exec, spawn } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

class PdfToImageService {
  /**
   * Main method: Convert PDF to images
   * Tries multiple methods in order of reliability:
   * 1. pdftoppm (direct system command - most reliable)
   * 2. Python pdf2image (fallback - also uses pdftoppm)
   * 3. pdfjs-dist (last resort - may fail in Docker due to canvas)
   */
  async pdfToJpg(pdfFilePath, outputDir, options = {}) {
    try {
      console.log("\n===== PDF TO IMAGE CONVERSION =====");
      console.log("Input:", pdfFilePath);
      console.log("Output dir:", outputDir);
      console.log("Options:", options);

      // Validate input
      if (!fs.existsSync(pdfFilePath)) {
        throw new Error(`Input PDF not found: ${pdfFilePath}`);
      }

      const inputSize = fs.statSync(pdfFilePath).size;
      console.log("Input size:", (inputSize / 1024).toFixed(2), "KB");

      fs.ensureDirSync(outputDir);

      // Get format from options
      let format = (options.format || "jpeg").toLowerCase();
      if (format === "jpg") format = "jpeg";
      console.log("Target format:", format);

      // ============================================
      // Method 1: Direct pdftoppm command (MOST RELIABLE)
      // ============================================
      try {
        console.log("\n📸 Attempting pdftoppm command...");
        const result = await this.convertWithPoppler(
          pdfFilePath,
          outputDir,
          options,
        );

        if (result && result.length > 0) {
          console.log("✅ pdftoppm succeeded");
          return result;
        }
      } catch (popplerError) {
        console.error("❌ pdftoppm failed:", popplerError.message);
      }

      // ============================================
      // Method 2: Python pdf2image (FALLBACK)
      // ============================================
      try {
        console.log("\n🐍 Attempting Python pdf2image method...");

        // Clean output directory
        const files = fs.readdirSync(outputDir);
        for (const file of files) {
          await fs.remove(path.join(outputDir, file));
        }

        const result = await this.convertWithPython(
          pdfFilePath,
          outputDir,
          options,
        );

        if (result && result.length > 0) {
          console.log("✅ Python pdf2image succeeded");
          return result;
        }
      } catch (pythonError) {
        console.error("❌ Python pdf2image failed:", pythonError.message);
      }

      // ============================================
      // Method 3: pdfjs-dist (LAST RESORT)
      // ============================================
      try {
        console.log("\n📄 Attempting pdfjs-dist method...");

        // Clean output directory
        const files = fs.readdirSync(outputDir);
        for (const file of files) {
          await fs.remove(path.join(outputDir, file));
        }

        const result = await this.convertWithPdfJs(
          pdfFilePath,
          outputDir,
          options,
        );

        if (result && result.length > 0) {
          console.log("✅ pdfjs-dist succeeded");
          return result;
        }
      } catch (pdfjsError) {
        console.error("❌ pdfjs-dist failed:", pdfjsError.message);
      }

      // All methods failed
      throw new Error(
        "All PDF to image conversion methods failed. Please check server logs.",
      );
    } catch (error) {
      console.error("\n💥 PDF to image conversion error:", error);
      throw error;
    }
  }

  /**
   * Method 1: Direct pdftoppm command (Linux + Windows compatible)
   * Uses system pdftoppm tool installed via poppler-utils
   */
  async convertWithPoppler(pdfFilePath, outputDir, options = {}) {
    console.log("Using direct pdftoppm command...");

    // Normalize format
    let format = (options.format || "jpeg").toLowerCase();
    let pdftoppmFormat = "jpeg"; // pdftoppm uses 'jpeg' for JPG

    if (format === "jpg" || format === "jpeg") {
      pdftoppmFormat = "jpeg";
    } else if (format === "png") {
      pdftoppmFormat = "png";
    }

    // Determine DPI from scale
    const scale = options.scale || 2.0;
    const dpi = scale >= 3.0 ? 300 : scale >= 2.0 ? 200 : 150;

    // Output prefix (pdftoppm adds -1, -2, etc. automatically)
    const outputPrefix = path.join(outputDir, "page");

    // Build command
    const command = `pdftoppm -${pdftoppmFormat} -r ${dpi} "${pdfFilePath}" "${outputPrefix}"`;

    console.log("Running command:", command);

    try {
      const { stdout, stderr } = await execPromise(command, {
        timeout: 180000, // 3 minutes
        maxBuffer: 1024 * 1024 * 50,
        windowsHide: true,
      });

      if (stderr && !stderr.toLowerCase().includes("warning")) {
        console.log("pdftoppm stderr:", stderr.substring(0, 300));
      }

      // pdftoppm generates files like: page-01.jpg, page-02.jpg
      const files = fs
        .readdirSync(outputDir)
        .filter((f) => {
          const lower = f.toLowerCase();
          if (pdftoppmFormat === "png") {
            return f.startsWith("page") && lower.endsWith(".png");
          } else {
            return (
              f.startsWith("page") &&
              (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
            );
          }
        })
        .sort((a, b) => {
          const numA = parseInt(a.match(/\d+/)?.[0] || 0);
          const numB = parseInt(b.match(/\d+/)?.[0] || 0);
          return numA - numB;
        });

      if (files.length === 0) {
        throw new Error("pdftoppm did not produce any output files");
      }

      // Rename files to page_001.jpg, page_002.jpg (consistent naming)
      const outputPaths = [];
      for (let i = 0; i < files.length; i++) {
        const oldPath = path.join(outputDir, files[i]);
        const ext = pdftoppmFormat === "png" ? "png" : "jpg";
        const newFileName = `page_${String(i + 1).padStart(3, "0")}.${ext}`;
        const newPath = path.join(outputDir, newFileName);

        if (oldPath !== newPath) {
          await fs.rename(oldPath, newPath);
        }

        // Verify file size
        const stats = fs.statSync(newPath);
        if (stats.size === 0) {
          throw new Error(`Empty output file: ${newPath}`);
        }

        outputPaths.push(newPath);
        console.log(
          `✅ Page ${i + 1}: ${newFileName} (${(stats.size / 1024).toFixed(2)} KB)`,
        );
      }

      console.log(
        `✅ Converted ${outputPaths.length} page(s) to ${pdftoppmFormat.toUpperCase()}`,
      );
      console.log("==================================\n");

      return outputPaths;
    } catch (error) {
      console.error("pdftoppm command failed:", error.message);

      // Check if pdftoppm is installed
      if (
        error.message.includes("not found") ||
        error.message.includes("is not recognized")
      ) {
        throw new Error(
          "pdftoppm not installed. Install poppler-utils: apt-get install poppler-utils",
        );
      }

      throw error;
    }
  }

  /**
   * Method 2: Python pdf2image (fallback)
   * Uses poppler-utils via Python
   */
  async convertWithPython(pdfFilePath, outputDir, options = {}) {
    console.log("Using Python pdf2image for conversion...");

    return new Promise((resolve, reject) => {
      const pythonScript = path.resolve(
        __dirname,
        "..",
        "python",
        "pdf_to_image.py",
      );

      if (!fs.existsSync(pythonScript)) {
        return reject(new Error(`Python script not found: ${pythonScript}`));
      }

      // Normalize format
      let format = (options.format || "jpeg").toLowerCase();
      if (format === "jpeg" || format === "jpg") format = "jpg";

      // Determine DPI
      const scale = options.scale || 2.0;
      const dpi = scale >= 3.0 ? 300 : scale >= 2.0 ? 200 : 150;

      console.log("Python script:", pythonScript);
      console.log("Format:", format, "DPI:", dpi);

      // Try python commands
      const pythonCommands = ["python3", "python", "py"];

      const tryPython = (index) => {
        if (index >= pythonCommands.length) {
          return reject(
            new Error("Python not found. Tried: python3, python, py"),
          );
        }

        const pythonCmd = pythonCommands[index];
        console.log(`Trying: ${pythonCmd}`);

        const child = spawn(
          pythonCmd,
          [pythonScript, pdfFilePath, outputDir, format, dpi.toString()],
          {
            cwd: path.join(__dirname, ".."),
            env: { ...process.env, PYTHONIOENCODING: "utf-8" },
          },
        );

        let stdout = "";
        let stderr = "";
        let spawnFailed = false;

        child.stdout.on("data", (data) => {
          const text = data.toString();
          stdout += text;
          console.log("📤 Python stdout:", text.trim());
        });

        child.stderr.on("data", (data) => {
          const text = data.toString();
          stderr += text;
          console.log("📥 Python stderr:", text.trim());
        });

        child.on("error", (error) => {
          spawnFailed = true;
          if (error.code === "ENOENT") {
            tryPython(index + 1);
          } else {
            reject(new Error(`${pythonCmd} error: ${error.message}`));
          }
        });

        child.on("close", (code) => {
          if (spawnFailed) return;

          console.log(`Python exit code: ${code}`);

          try {
            // Parse JSON from stdout
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]);

              if (!result.success) {
                return reject(
                  new Error(result.error || "Python conversion failed"),
                );
              }

              // Verify output files
              const outputPaths = result.output_paths || [];
              if (outputPaths.length === 0) {
                return reject(new Error("No output files generated"));
              }

              console.log(`✅ Python generated ${outputPaths.length} page(s)`);
              resolve(outputPaths);
            } else {
              if (code === 0) {
                // Fallback: read files from output dir
                const files = fs
                  .readdirSync(outputDir)
                  .filter((f) => f.startsWith("page"))
                  .sort()
                  .map((f) => path.join(outputDir, f));

                if (files.length > 0) {
                  resolve(files);
                } else {
                  reject(new Error("No output files found"));
                }
              } else {
                reject(new Error(stderr || `Python exited with code ${code}`));
              }
            }
          } catch (parseError) {
            reject(new Error(`Parse error: ${parseError.message}`));
          }
        });
      };

      tryPython(0);
    });
  }

  /**
   * Method 3: pdfjs-dist (last resort)
   * WARNING: This method requires 'canvas' package which may not work in all environments
   */
  async convertWithPdfJs(pdfFilePath, outputDir, options = {}) {
    console.log("Using pdfjs-dist for conversion...");

    // Try to load canvas - if it fails, throw error
    let createCanvas;
    try {
      const canvasModule = require("canvas");
      createCanvas = canvasModule.createCanvas;

      if (!createCanvas) {
        throw new Error("createCanvas not available in canvas module");
      }
    } catch (err) {
      throw new Error(`canvas package not available: ${err.message}`);
    }

    let pdfjsLib;
    try {
      pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
    } catch (error) {
      try {
        pdfjsLib = require("pdfjs-dist");
      } catch (err) {
        throw new Error("pdfjs-dist not available: " + error.message);
      }
    }

    const data = new Uint8Array(await fs.readFile(pdfFilePath));

    const loadingTask = pdfjsLib.getDocument({
      data,
      disableFontFace: true,
      useSystemFonts: false,
    });

    const pdf = await loadingTask.promise;

    console.log("PDF loaded. Pages:", pdf.numPages);

    const scale = options.scale || 2.0;

    // Normalize format
    let format = (options.format || "jpeg").toLowerCase();
    if (format === "jpg" || format === "jpeg") {
      format = "jpeg";
    } else if (format === "png") {
      format = "png";
    } else {
      format = "jpeg";
    }

    const quality = options.quality || 90;

    console.log("Format:", format, "Quality:", quality, "Scale:", scale);

    const outputPaths = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing page ${pageNum}/${pdf.numPages}...`);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      // White background
      context.fillStyle = "white";
      context.fillRect(0, 0, viewport.width, viewport.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        background: "white",
      };

      await page.render(renderContext).promise;

      // Save image
      let outputPath;
      let imageBuffer;

      if (format === "png") {
        outputPath = path.join(
          outputDir,
          `page_${String(pageNum).padStart(3, "0")}.png`,
        );
        imageBuffer = canvas.toBuffer("image/png");
      } else {
        outputPath = path.join(
          outputDir,
          `page_${String(pageNum).padStart(3, "0")}.jpg`,
        );
        imageBuffer = canvas.toBuffer("image/jpeg", {
          quality: quality / 100,
          progressive: true,
        });
      }

      await fs.writeFile(outputPath, imageBuffer);
      outputPaths.push(outputPath);

      console.log(
        `✅ Page ${pageNum} saved: ${path.basename(outputPath)} (${(imageBuffer.length / 1024).toFixed(2)} KB)`,
      );
    }

    console.log(
      `\n✅ Converted ${outputPaths.length} page(s) to ${format.toUpperCase()}`,
    );
    console.log("==================================\n");

    return outputPaths;
  }
}

module.exports = new PdfToImageService();