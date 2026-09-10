const ConvertService = require("../services/convertService");
const FileHelper = require("../utils/fileHelper");
const ResponseHelper = require("../utils/responseHelper");
const { logger } = require("../utils/logger");
const path = require("path");
const archiver = require("archiver");
const fs = require("fs-extra");

class ConvertController {
  async convert(req, res, next) {
    try {
      console.log("\n========== CONVERSION STARTED ==========");

      const files = req.files.map((file) => file.path);
      const { conversionType } = req.body;
      let options = {};

      if (req.body.options) {
        try {
          options = JSON.parse(req.body.options);
        } catch (error) {
          options = req.body;
        }
      }

      console.log("Files:", files.length);
      console.log("Type:", conversionType);
      console.log("Options:", options);

      if (!conversionType) {
        return ResponseHelper.badRequest(res, "Conversion type is required");
      }

      const result = await ConvertService.convert(
        files,
        conversionType,
        options,
      );

      // Clean up uploaded files
      for (const file of files) {
        await FileHelper.deleteFile(file);
      }

      if (result.fileCount === 1) {
        // Single file - send directly
        const outputPath = result.outputPath || result.outputPaths[0];

        if (!fs.existsSync(outputPath)) {
          return ResponseHelper.error(res, "Output file not found", 500);
        }

        const buffer = await FileHelper.readBuffer(outputPath);
        const filename = path.basename(outputPath);

        // ✅ Determine content type based on extension
        const ext = path.extname(filename).toLowerCase();
        const contentTypes = {
          ".pdf": "application/pdf",
          ".docx":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          ".doc": "application/msword",
          ".xlsx":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ".xls": "application/vnd.ms-excel",
          ".pptx":
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          ".ppt": "application/vnd.ms-powerpoint",
          ".zip": "application/zip",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".html": "text/html",
        };

        const contentType =
          contentTypes[ext] || "application/octet-stream";

        console.log(
          "Sending file:",
          filename,
          "with content type:",
          contentType,
        );

        res.on("finish", async () => {
          if (result.outputDir) {
            await FileHelper.deleteDirectory(result.outputDir);
          }
        });

        // Set headers
        res.setHeader("Content-Type", contentType);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${filename}"`,
        );
        res.setHeader("Content-Length", buffer.length);

        return res.send(buffer);
      } else if (result.fileCount > 1) {
        // Multiple files - create zip
        const zipPath = path.join(result.outputDir, "converted_files.zip");

        await new Promise((resolve, reject) => {
          const output = fs.createWriteStream(zipPath);
          const archive = archiver("zip", { zlib: { level: 9 } });

          output.on("close", resolve);
          archive.on("error", reject);

          archive.pipe(output);

          result.outputPaths.forEach((filePath, index) => {
            if (fs.existsSync(filePath)) {
              // Preserve subdirectory structure if exists
              const relativePath = path.relative(result.outputDir, filePath);
              archive.file(filePath, { name: relativePath });
            }
          });

          archive.finalize();
        });

        const buffer = await FileHelper.readBuffer(zipPath);

        res.on("finish", async () => {
          await FileHelper.deleteDirectory(result.outputDir);
        });

        // ✅ Dynamic ZIP filename based on conversion type and format
        let zipFilename = "converted_files.zip";

        if (conversionType === "pdf_to_jpg") {
          if (options && options.format === "png") {
            zipFilename = "pdf_images_png.zip";
          } else {
            zipFilename = "pdf_images_jpg.zip";
          }
        } else if (conversionType === "pdf_to_word") {
          zipFilename = "pdf_to_word.zip";
        } else if (conversionType === "pdf_to_excel") {
          zipFilename = "pdf_to_excel.zip";
        } else if (conversionType === "pdf_to_ppt") {
          zipFilename = "pdf_to_ppt.zip";
        } else if (conversionType === "pdf_to_pdfa") {
          zipFilename = "pdf_to_pdfa.zip";
        }

        console.log("Sending ZIP:", zipFilename);

        // Set content type to zip
        res.setHeader("Content-Type", "application/zip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${zipFilename}"`,
        );

        return res.send(buffer);
      }
    } catch (error) {
      console.error("\n========== CONVERSION ERROR ==========");
      console.error("Error:", error.message);
      console.error("Stack:", error.stack);
      console.error("=======================================\n");

      if (req.files) {
        for (const file of req.files) {
          await FileHelper.deleteFile(file.path).catch(() => {});
        }
      }

      return res.status(500).json({
        error: error.message || "Failed to convert files",
        success: false,
      });
    }
  }

  async getSupportedConversions(req, res, next) {
    try {
      const conversions = [
        { type: "jpg_to_pdf", from: ["jpg", "jpeg", "png"], to: "pdf" },
        { type: "word_to_pdf", from: ["doc", "docx"], to: "pdf" },
        { type: "excel_to_pdf", from: ["xls", "xlsx"], to: "pdf" },
        { type: "ppt_to_pdf", from: ["ppt", "pptx"], to: "pdf" },
        { type: "html_to_pdf", from: ["html"], to: "pdf" },
        { type: "pdf_to_jpg", from: ["pdf"], to: "jpg" },
        { type: "pdf_to_word", from: ["pdf"], to: "doc" },
        { type: "pdf_to_pdfa", from: ["pdf"], to: "pdfa" },
      ];

      return ResponseHelper.success(
        res,
        conversions,
        "Supported conversions retrieved",
      );
    } catch (error) {
      logger.error("Error getting supported conversions:", error);
      next(error);
    }
  }
}

module.exports = new ConvertController();