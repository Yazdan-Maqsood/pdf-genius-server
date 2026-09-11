FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    tesseract-ocr \
    tesseract-ocr-eng \
    python3 \
    python3-pip \
    python3-venv \
    fonts-dejavu \
    fonts-liberation \
    fonts-noto \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip3 install --no-cache-dir \
    pdf2docx \
    pymupdf \
    pdfplumber \
    python-pptx \
    openpyxl \
    pytesseract \
    Pillow

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p uploads/pdf uploads/images uploads/office uploads/processed \
    temp/merge temp/split temp/compress temp/convert \
    logs

EXPOSE 5000

CMD ["npm", "start"]