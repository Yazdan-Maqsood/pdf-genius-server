#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PDF to Image Converter using pdf2image (poppler-utils)

Usage: python pdf_to_image.py <input.pdf> <output_dir> [format] [dpi]
Format: jpg | jpeg | png (default: jpg)
DPI: 150 | 200 | 300 | 600 (default: 200)

Requirements:
    pip install pdf2image Pillow
    apt-get install poppler-utils  # Linux
"""

import sys
import os
import json
import traceback


def convert_pdf_to_images(pdf_path, output_dir, format='jpg', dpi=200):
    """
    Convert PDF pages to images using pdf2image.
    
    Args:
        pdf_path: Path to input PDF
        output_dir: Directory to save output images
        format: Output image format (jpg, jpeg, png)
        dpi: Resolution (dots per inch)
    
    Returns:
        dict with success status and output paths
    """
    try:
        # Validate input
        if not os.path.exists(pdf_path):
            return {
                "success": False,
                "error": f"Input PDF not found: {pdf_path}"
            }
        
        file_size = os.path.getsize(pdf_path)
        print(json.dumps({"info": f"Input size: {file_size / 1024:.2f} KB"}), file=sys.stderr)
        
        # Import pdf2image
        try:
            from pdf2image import convert_from_path
        except ImportError:
            return {
                "success": False,
                "error": "pdf2image not installed. Run: pip install pdf2image"
            }
        
        # Validate format
        format_lower = format.lower()
        if format_lower in ['jpg', 'jpeg']:
            output_format = 'jpeg'
            file_ext = 'jpg'
        elif format_lower == 'png':
            output_format = 'png'
            file_ext = 'png'
        else:
            output_format = 'jpeg'
            file_ext = 'jpg'
        
        # Validate DPI
        try:
            dpi = int(dpi)
            if dpi < 72:
                dpi = 72
            elif dpi > 600:
                dpi = 600
        except (ValueError, TypeError):
            dpi = 200
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Convert PDF to images
        print(json.dumps({
            "info": f"Converting with format={output_format}, dpi={dpi}"
        }), file=sys.stderr)
        
        try:
            images = convert_from_path(
                pdf_path,
                dpi=dpi,
                fmt=output_format,
                thread_count=1,      # Lower memory usage
                first_page=None,
                last_page=None,
                poppler_path=None     # Use system default
            )
        except Exception as convert_error:
            # Check if poppler is missing
            error_msg = str(convert_error)
            if 'poppler' in error_msg.lower() or 'pdftoppm' in error_msg.lower():
                return {
                    "success": False,
                    "error": "Poppler not found. Install poppler-utils: apt-get install poppler-utils"
                }
            raise convert_error
        
        print(json.dumps({
            "info": f"Converted {len(images)} page(s)"
        }), file=sys.stderr)
        
        # Save images
        output_paths = []
        
        for i, image in enumerate(images, 1):
            # Pad page number for proper sorting: page_001.jpg, page_002.jpg
            page_num = str(i).zfill(3)
            output_path = os.path.join(output_dir, f'page_{page_num}.{file_ext}')
            
            # Save with optimization
            if output_format == 'jpeg':
                # Convert to RGB if needed (JPEG doesn't support transparency)
                if image.mode in ('RGBA', 'LA', 'P'):
                    rgb_image = image.convert('RGB')
                    rgb_image.save(
                        output_path,
                        'JPEG',
                        quality=85,
                        optimize=True,
                        progressive=True
                    )
                else:
                    image.save(
                        output_path,
                        'JPEG',
                        quality=85,
                        optimize=True,
                        progressive=True
                    )
            else:  # PNG
                image.save(
                    output_path,
                    'PNG',
                    optimize=True,
                    compress_level=6
                )
            
            # Verify file was created
            if not os.path.exists(output_path):
                print(json.dumps({
                    "warning": f"Failed to save page {i}"
                }), file=sys.stderr)
                continue
            
            file_size = os.path.getsize(output_path)
            output_paths.append(output_path)
            
            print(json.dumps({
                "info": f"Page {i}: {os.path.basename(output_path)} ({file_size / 1024:.2f} KB)"
            }), file=sys.stderr)
        
        # Free memory
        del images
        
        if len(output_paths) == 0:
            return {
                "success": False,
                "error": "No images were generated"
            }
        
        return {
            "success": True,
            "output_dir": output_dir,
            "output_paths": output_paths,
            "page_count": len(output_paths),
            "format": output_format,
            "dpi": dpi
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


def main():
    """Main entry point."""
    if len(sys.argv) < 3:
        print(json.dumps({
            "success": False,
            "error": "Usage: python pdf_to_image.py <input.pdf> <output_dir> [format] [dpi]"
        }))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    format = sys.argv[3] if len(sys.argv) > 3 else 'jpg'
    dpi = sys.argv[4] if len(sys.argv) > 4 else '200'
    
    print(json.dumps({
        "info": "Starting PDF to image conversion",
        "pdf": pdf_path,
        "output_dir": output_dir,
        "format": format,
        "dpi": dpi
    }), file=sys.stderr)
    
    result = convert_pdf_to_images(pdf_path, output_dir, format, dpi)
    
    # Print JSON result to stdout (main output)
    print(json.dumps(result))
    
    # Exit with appropriate code
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()