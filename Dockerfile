FROM node:18-bookworm-slim

# Prevent Debian prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    libreoffice-core \
    tesseract-ocr \
    tesseract-ocr-eng \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    fonts-dejavu \
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    ca-certificates \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Verify LibreOffice installation
RUN which soffice && soffice --version

# ✅ Verify Poppler installation (for PDF to JPG)
RUN which pdftoppm && pdftoppm -v

# Install Python packages with --break-system-packages flag
RUN pip3 install --no-cache-dir --break-system-packages \
    pdf2docx \
    pymupdf \
    pdfplumber \
    python-pptx \
    python-docx \
    openpyxl \
    pytesseract \
    Pillow \
    pdf2image

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install --production

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p uploads/pdf uploads/images uploads/office uploads/processed \
    temp/merge temp/split temp/compress temp/convert \
    logs

EXPOSE 5000

CMD ["npm", "start"]