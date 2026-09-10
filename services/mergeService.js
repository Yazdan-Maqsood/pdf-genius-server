const PDFHelper = require('../utils/pdfHelper');
const FileHelper = require('../utils/fileHelper');
const path = require('path');
const config = require('../config');

class MergeService {
  async mergePDFs(filePaths, options = {}) {
    const outputDir = options.outputDir || path.join(config.tempDir, 'merge');
    FileHelper.ensureDirectoryExists(outputDir);
    
    const outputPath = path.join(outputDir, `merged_${Date.now()}.pdf`);
    await PDFHelper.mergePDFs(filePaths, outputPath);
    
    return {
      outputPath,
      fileSize: FileHelper.getFileSize(outputPath)
    };
  }

  async mergeWithOptions(filePaths, options) {
    const { pageRanges, sortOrder } = options;
    
    // Validate files
    for (const filePath of filePaths) {
      if (!FileHelper.isValidFileType(filePath, ['pdf'])) {
        throw new Error(`Invalid file type: ${filePath}`);
      }
    }
    
    // Sort files if required
    let filesToMerge = filePaths;
    if (sortOrder === 'name_asc') {
      filesToMerge = filePaths.sort((a, b) => 
        path.basename(a).localeCompare(path.basename(b))
      );
    } else if (sortOrder === 'name_desc') {
      filesToMerge = filePaths.sort((a, b) => 
        path.basename(b).localeCompare(path.basename(a))
      );
    } else if (sortOrder === 'size_asc') {
      filesToMerge = filePaths.sort((a, b) => 
        FileHelper.getFileSize(a) - FileHelper.getFileSize(b)
      );
    } else if (sortOrder === 'size_desc') {
      filesToMerge = filePaths.sort((a, b) => 
        FileHelper.getFileSize(b) - FileHelper.getFileSize(a)
      );
    }
    
    return await this.mergePDFs(filesToMerge);
  }
}

module.exports = new MergeService();