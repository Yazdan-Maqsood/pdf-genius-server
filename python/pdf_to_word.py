#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PDF to Word Converter using pdf2docx with OCR support
"""

import sys
import os
import json
import traceback
import platform

# ⬇️ ADD THESE LINES
import pytesseract

# Set Tesseract path for Windows
if platform.system() == 'Windows':
    # Try common installation paths
    possible_paths = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            pytesseract.pytesseract.tesseract_cmd = path
            print(json.dumps({"info": f"Tesseract path set to: {path}"}), file=sys.stderr)
            break


def is_scanned_pdf(pdf_path):
    """Check if PDF is scanned (no extractable text)."""
    try:
        import pymupdf
        doc = pymupdf.open(pdf_path)
        
        for i in range(min(3, len(doc))):
            page = doc[i]
            text = page.get_text().strip()
            if len(text) > 50:
                doc.close()
                return False
        
        doc.close()
        return True
    except Exception:
        return False


def convert_with_ocr(pdf_path, output_path):
    """Convert scanned PDF using OCR."""
    try:
        import pymupdf
        from docx import Document
        from PIL import Image
        import io
        
        doc = pymupdf.open(pdf_path)
        word_doc = Document()
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # Render page to image at high DPI
            pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2))
            img_data = pix.tobytes("png")
            img = Image.open(io.BytesIO(img_data))
            
            # OCR
            text = pytesseract.image_to_string(img)
            
            if text.strip():
                # Split into paragraphs
                paragraphs = text.split('\n\n')
                for para in paragraphs:
                    para = para.strip()
                    if para:
                        word_doc.add_paragraph(para)
            
            # Page break between pages
            if page_num < len(doc) - 1:
                word_doc.add_page_break()
        
        doc.close()
        word_doc.save(output_path)
        
        return {"success": True, "output_path": output_path, "method": "ocr"}
        
    except Exception as e:
        return {
            "success": False,
            "error": f"OCR failed: {str(e)}",
            "traceback": traceback.format_exc()
        }


def convert_pdf_to_word(input_path, output_path):
    """Convert PDF to DOCX."""
    try:
        if not os.path.exists(input_path):
            return {"success": False, "error": f"Input not found: {input_path}"}
        
        # Check if scanned
        scanned = is_scanned_pdf(input_path)
        
        if scanned:
            return convert_with_ocr(input_path, output_path)
        
        # Use pdf2docx for text-based PDFs
        try:
            from pdf2docx import Converter
        except ImportError:
            return {
                "success": False,
                "error": "pdf2docx not installed. Run: pip install pdf2docx pymupdf"
            }
        
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        cv = Converter(input_path)
        cv.convert(output_path)
        cv.close()
        
        if not os.path.exists(output_path):
            return {"success": False, "error": "Output not created"}
        
        size_kb = os.path.getsize(output_path) / 1024
        
        return {
            "success": True,
            "output_path": output_path,
            "size_kb": round(size_kb, 2),
            "method": "pdf2docx"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


def main():
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python pdf_to_word.py <input.pdf> <output.docx>"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    result = convert_pdf_to_word(input_path, output_path)
    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()