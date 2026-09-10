#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
PDF to Excel Converter using pdfplumber
Extracts tables from PDF and creates Excel file

Usage: python pdf_to_excel.py <input.pdf> <output.xlsx>
"""

import sys
import os
import json
import traceback


def convert_pdf_to_excel(input_path, output_path):
    """Convert PDF to Excel using pdfplumber."""
    try:
        # Validate input
        if not os.path.exists(input_path):
            return {"success": False, "error": f"Input not found: {input_path}"}
        
        # Import libraries
        try:
            import pdfplumber
            from openpyxl import Workbook
            from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        except ImportError as e:
            return {
                "success": False,
                "error": f"Missing library: {e}. Run: pip install pdfplumber openpyxl"
            }
        
        # Create output directory if needed
        output_dir = os.path.dirname(output_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        # Create Excel workbook
        wb = Workbook()
        # Remove default sheet
        wb.remove(wb.active)
        
        total_tables = 0
        total_pages = 0
        
        # Open PDF
        with pdfplumber.open(input_path) as pdf:
            total_pages = len(pdf.pages)
            print(json.dumps({"info": f"PDF has {total_pages} pages"}), file=sys.stderr)
            
            # Process each page
            for page_num, page in enumerate(pdf.pages, 1):
                print(json.dumps({"info": f"Processing page {page_num}/{total_pages}"}), file=sys.stderr)
                
                # Try to extract tables
                tables = page.extract_tables()
                
                if not tables:
                    # If no tables found, try extracting text as a single column
                    text = page.extract_text()
                    if text and text.strip():
                        ws = wb.create_sheet(title=f"Page_{page_num}_Text")
                        lines = text.split('\n')
                        for row_idx, line in enumerate(lines, 1):
                            ws.cell(row=row_idx, column=1, value=line)
                        
                        # Auto-adjust column width
                        ws.column_dimensions['A'].width = 100
                        
                        total_tables += 1
                    continue
                
                # Process each table on the page
                for table_idx, table in enumerate(tables):
                    # Skip empty tables
                    if not table or all(not any(cell for cell in row if cell) for row in table):
                        continue
                    
                    # Create worksheet for this table
                    if len(tables) > 1:
                        sheet_title = f"Page{page_num}_Table{table_idx + 1}"[:31]
                    elif total_pages > 1:
                        sheet_title = f"Page_{page_num}"[:31]
                    else:
                        sheet_title = f"Table_{table_idx + 1}"[:31]
                    
                    ws = wb.create_sheet(title=sheet_title)
                    
                    # Style for header
                    header_font = Font(bold=True, color="FFFFFF", size=11)
                    header_fill = PatternFill(start_color="667eea", end_color="667eea", fill_type="solid")
                    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                    cell_alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
                    thin_border = Border(
                        left=Side(style='thin'),
                        right=Side(style='thin'),
                        top=Side(style='thin'),
                        bottom=Side(style='thin')
                    )
                    
                    # Write table data
                    for row_idx, row in enumerate(table, 1):
                        for col_idx, cell in enumerate(row, 1):
                            # Clean cell value
                            value = ''
                            if cell is not None:
                                value = str(cell).strip()
                                # Remove multiple spaces/newlines
                                value = ' '.join(value.split())
                            
                            excel_cell = ws.cell(row=row_idx, column=col_idx, value=value)
                            excel_cell.border = thin_border
                            
                            if row_idx == 1:
                                # Header row styling
                                excel_cell.font = header_font
                                excel_cell.fill = header_fill
                                excel_cell.alignment = header_alignment
                            else:
                                excel_cell.alignment = cell_alignment
                    
                    # Auto-adjust column widths
                    if table:
                        num_cols = max(len(row) for row in table)
                        for col_idx in range(1, num_cols + 1):
                            max_width = 10
                            for row in table:
                                if col_idx <= len(row):
                                    cell_value = row[col_idx - 1]
                                    if cell_value:
                                        cell_len = len(str(cell_value))
                                        max_width = max(max_width, min(cell_len + 2, 50))
                            ws.column_dimensions[chr(64 + col_idx)].width = max_width
                    
                    total_tables += 1
        
        # If no tables extracted, create a fallback sheet with all text
        if total_tables == 0:
            ws = wb.create_sheet(title="No_Tables_Found")
            ws.cell(row=1, column=1, value="No structured tables were found in this PDF.")
            ws.cell(row=2, column=1, value="The content might be text-only or formatted differently.")
            ws.cell(row=3, column=1, value="Text extraction:")
            
            with pdfplumber.open(input_path) as pdf:
                row_idx = 5
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        for line in text.split('\n'):
                            ws.cell(row=row_idx, column=1, value=line)
                            row_idx += 1
            
            ws.column_dimensions['A'].width = 100
        
        # Ensure at least one sheet exists
        if len(wb.sheetnames) == 0:
            wb.create_sheet(title="Empty")
        
        # Save workbook
        wb.save(output_path)
        
        if not os.path.exists(output_path):
            return {"success": False, "error": "Output file was not created"}
        
        size_kb = os.path.getsize(output_path) / 1024
        
        return {
            "success": True,
            "output_path": output_path,
            "size_kb": round(size_kb, 2),
            "pages": total_pages,
            "tables": total_tables,
            "method": "pdfplumber"
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
            "error": "Usage: python pdf_to_excel.py <input.pdf> <output.xlsx>"
        }))
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    result = convert_pdf_to_excel(input_path, output_path)
    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()