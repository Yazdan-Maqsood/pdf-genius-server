FROM node:18-bookworm-slim

# Prevent Debian prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Skip Puppeteer Chromium download (we install system Chrome instead)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Skip Sharp download (uses prebuilt binaries)
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

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
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# ✅ Install Google Chrome (for HTML to PDF via Puppeteer)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub \
    | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Verify LibreOffice installation
RUN which soffice && soffice --version

# Verify Poppler installation
RUN which pdftoppm && pdftoppm -v

# ✅ Verify Chrome installation
RUN which google-chrome && google-chrome --version

# Install Python packages
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

# Copy package files first (better caching)
COPY package*.json ./

# Optimized npm install
RUN npm install --production --no-audit --no-fund --prefer-offline --loglevel=error

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p uploads/pdf uploads/images uploads/office uploads/processed \
    temp/merge temp/split temp/compress temp/convert \
    logs

EXPOSE 5000

CMD ["npm", "start"]