const FILE_TYPES = {
  PDF: 'application/pdf',
  JPEG: 'image/jpeg',
  JPG: 'image/jpg',
  PNG: 'image/png',
  DOC: 'application/msword',
  DOCX: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  HTML: 'text/html'
};

const COMPRESSION_LEVELS = {
  low: {
    imageQuality: 30,
    useObjectStreams: true,
    objectsPerTick: 100
  },
  medium: {
    imageQuality: 50,
    useObjectStreams: true,
    objectsPerTick: 75
  },
  high: {
    imageQuality: 70,
    useObjectStreams: true,
    objectsPerTick: 50
  },
  extreme: {
    imageQuality: 85,
    useObjectStreams: true,
    objectsPerTick: 30
  }
};

const SPLIT_MODES = {
  RANGE: 'range',
  EXTRACT: 'extract',
  REMOVE: 'remove',
  EVERY_N_PAGES: 'every_n_pages'
};

const CONVERSION_TYPES = {
  JPG_TO_PDF: 'jpg_to_pdf',
  WORD_TO_PDF: 'word_to_pdf',
  EXCEL_TO_PDF: 'excel_to_pdf',
  PPT_TO_PDF: 'ppt_to_pdf',
  HTML_TO_PDF: 'html_to_pdf',
  PDF_TO_JPG: 'pdf_to_jpg',
  PDF_TO_WORD: 'pdf_to_word',
  PDF_TO_EXCEL: 'pdf_to_excel',
  PDF_TO_PPT: 'pdf_to_ppt',
  PDF_TO_PDFA: 'pdf_to_pdfa'
};

module.exports = {
  FILE_TYPES,
  COMPRESSION_LEVELS,
  SPLIT_MODES,
  CONVERSION_TYPES
};