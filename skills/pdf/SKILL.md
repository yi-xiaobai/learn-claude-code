---
name: pdf
description: Process and extract content from PDF files
tags: document, extraction
---

# PDF Processing Skill

When working with PDF files, follow these steps:

## Step 1: Check Dependencies
```bash
# Ensure pdftotext is installed (poppler-utils)
which pdftotext || brew install poppler
```

## Step 2: Extract Text
```bash
# Extract text from PDF
pdftotext input.pdf output.txt

# Extract with layout preservation
pdftotext -layout input.pdf output.txt
```

## Step 3: Extract Images
```bash
# Extract images from PDF
pdfimages -all input.pdf images/
```

## Step 4: Get PDF Info
```bash
# Get PDF metadata
pdfinfo input.pdf
```

## Common Issues
- Scanned PDFs need OCR (use tesseract)
- Password-protected PDFs need decryption first
- Large PDFs should be processed page by page
