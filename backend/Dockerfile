FROM python:3.12-slim

WORKDIR /app

# Systempaket för PDF och OCR
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    tesseract-ocr-swe \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Skapa __init__.py om det saknas
RUN touch backend/__init__.py 2>/dev/null || true

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
