const { PDFDocument } = require("pdf-lib");
const fs = require("fs-extra");
const path = require("path");
const FileHelper = require("./fileHelper");

class PDFHelper {
  static async loadPDF(filePath) {
    const buffer = await FileHelper.readBuffer(filePath);
    return await PDFDocument.load(buffer, {
      updateMetadata: false,
    });
  }

  static async savePDF(pdfDoc, filePath) {
    const bytes = await pdfDoc.save();
    await fs.writeFile(filePath, bytes);
    return filePath;
  }

  static async getPageCount(filePath) {
    const pdfDoc = await this.loadPDF(filePath);
    return pdfDoc.getPageCount();
  }

  static async getPDFInfo(filePath) {
    const pdfDoc = await this.loadPDF(filePath);
    return {
      pageCount: pdfDoc.getPageCount(),
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      keywords: pdfDoc.getKeywords(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate(),
    };
  }

  static async mergePDFs(filePaths, outputPath) {
    const mergedPdf = await PDFDocument.create();

    for (const filePath of filePaths) {
      const pdfDoc = await this.loadPDF(filePath);
      const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    }

    await this.savePDF(mergedPdf, outputPath);
    return outputPath;
  }

  static async splitPDFByRanges(filePath, ranges, outputDir) {
    try {
      const pdfDoc = await this.loadPDF(filePath);
      const outputPaths = [];

      for (let i = 0; i < ranges.length; i++) {
        const range = ranges[i];

        // Validate range
        if (!Array.isArray(range) || range.length === 0) {
          throw new Error(
            `Invalid range at index ${i}: Range must be a non-empty array`,
          );
        }

        // Check if all page numbers are valid
        for (const pageNum of range) {
          if (pageNum < 0 || pageNum >= pdfDoc.getPageCount()) {
            throw new Error(
              `Page number ${pageNum + 1} is out of range (PDF has ${pdfDoc.getPageCount()} pages)`,
            );
          }
        }

        const newPdf = await PDFDocument.create();
        const pages = await newPdf.copyPages(pdfDoc, range);
        pages.forEach((page) => newPdf.addPage(page));

        const outputPath = path.join(outputDir, `split_${i + 1}.pdf`);
        await this.savePDF(newPdf, outputPath);
        outputPaths.push(outputPath);
      }

      return outputPaths;
    } catch (error) {
      console.error("Error in splitPDFByRanges:", error);
      throw new Error(`Failed to split PDF: ${error.message}`);
    }
  }

  static async extractPages(filePath, pageNumbers, outputDir) {
    try {
      const pdfDoc = await this.loadPDF(filePath);
      const outputPaths = [];

      for (let i = 0; i < pageNumbers.length; i++) {
        const pageNum = pageNumbers[i];

        // Validate page number
        if (pageNum < 0 || pageNum >= pdfDoc.getPageCount()) {
          throw new Error(
            `Page number ${pageNum + 1} is out of range (PDF has ${pdfDoc.getPageCount()} pages)`,
          );
        }

        const newPdf = await PDFDocument.create();
        const [page] = await newPdf.copyPages(pdfDoc, [pageNum]);
        newPdf.addPage(page);

        const outputPath = path.join(outputDir, `page_${pageNum + 1}.pdf`);
        await this.savePDF(newPdf, outputPath);
        outputPaths.push(outputPath);
      }

      return outputPaths;
    } catch (error) {
      console.error("Error in extractPages:", error);
      throw new Error(`Failed to extract pages: ${error.message}`);
    }
  }

  // Add this method to PDFHelper class
  static async splitEveryNPages(filePath, n, outputDir) {
    try {
      const pdfDoc = await this.loadPDF(filePath);
      const totalPages = pdfDoc.getPageCount();
      const outputPaths = [];

      if (n < 1) {
        throw new Error("Pages per split must be at least 1");
      }

      let fileIndex = 1;
      let currentRange = [];

      for (let i = 0; i < totalPages; i++) {
        currentRange.push(i);

        if (currentRange.length === n || i === totalPages - 1) {
          const newPdf = await PDFDocument.create();
          const pages = await newPdf.copyPages(pdfDoc, currentRange);
          pages.forEach((page) => newPdf.addPage(page));

          const outputPath = path.join(outputDir, `split_${fileIndex}.pdf`);
          await this.savePDF(newPdf, outputPath);
          outputPaths.push(outputPath);

          console.log(
            `Created split_${fileIndex}.pdf with pages: ${currentRange.map((p) => p + 1).join(", ")}`,
          );

          fileIndex++;
          currentRange = [];
        }
      }

      return outputPaths;
    } catch (error) {
      console.error("Error in splitEveryNPages:", error);
      throw new Error(`Failed to split PDF every ${n} pages: ${error.message}`);
    }
  }

  static async removePages(filePath, pageNumbers, outputPath) {
    const pdfDoc = await this.loadPDF(filePath);
    const pagesToKeep = [];

    for (let i = 0; i < pdfDoc.getPageCount(); i++) {
      if (!pageNumbers.includes(i)) {
        pagesToKeep.push(i);
      }
    }

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(pdfDoc, pagesToKeep);
    pages.forEach((page) => newPdf.addPage(page));

    await this.savePDF(newPdf, outputPath);
    return outputPath;
  }

  static async compressPDF(filePath, outputPath, quality = "medium") {
    const pdfDoc = await this.loadPDF(filePath);

    // Remove metadata
    pdfDoc.setTitle("");
    pdfDoc.setAuthor("");
    pdfDoc.setSubject("");
    pdfDoc.setKeywords([]);
    pdfDoc.setProducer("");
    pdfDoc.setCreator("");

    const compressionSettings = {
      low: { useObjectStreams: true, objectsPerTick: 100 },
      medium: { useObjectStreams: true, objectsPerTick: 75 },
      high: { useObjectStreams: true, objectsPerTick: 50 },
      extreme: { useObjectStreams: true, objectsPerTick: 25 },
    };

    const settings = compressionSettings[quality] || compressionSettings.medium;

    const bytes = await pdfDoc.save({
      useObjectStreams: settings.useObjectStreams,
      objectsPerTick: settings.objectsPerTick,
      addDefaultPage: false,
    });

    await fs.writeFile(outputPath, bytes);
    return outputPath;
  }

  static async convertToPDFA(filePath, outputPath) {
    const pdfDoc = await this.loadPDF(filePath);

    // Set PDF/A metadata
    pdfDoc.setTitle("PDF/A Document");
    pdfDoc.setProducer("PDFGenius PDF/A Converter");
    pdfDoc.setCreator("PDFGenius");
    pdfDoc.setSubject("Converted to PDF/A");

    const bytes = await pdfDoc.save({
      useObjectStreams: false,
      addDefaultPage: false,
    });

    await fs.writeFile(outputPath, bytes);
    return outputPath;
  }
}

module.exports = PDFHelper;
