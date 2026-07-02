import io
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extraherar text från PDF-filer med pdfplumber."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages_text = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages_text.append(text)
            result = "\n".join(pages_text)
            logger.info(f"PDF-parsning klar: {len(result)} tecken extraherade")
            return result
    except ImportError:
        logger.error("pdfplumber är inte installerat. Kör: pip install pdfplumber")
        raise
    except Exception as e:
        logger.error(f"Fel vid PDF-parsning: {e}")
        raise ValueError(f"Kunde inte läsa PDF: {e}")


def extract_text_from_image(file_bytes: bytes) -> str:
    """Extraherar text från bilder via OCR (pytesseract)."""
    try:
        import pytesseract
        from PIL import Image

        image = Image.open(io.BytesIO(file_bytes))
        # Försök med svenska + engelska
        text = pytesseract.image_to_string(image, lang="swe+eng")
        logger.info(f"OCR klar: {len(text)} tecken extraherade")
        return text
    except ImportError:
        logger.error("pytesseract/Pillow är inte installerat.")
        raise
    except Exception as e:
        logger.error(f"Fel vid OCR: {e}")
        raise ValueError(f"Kunde inte läsa bild: {e}")


def extract_text(file_bytes: bytes, filename: str) -> str:
    """Väljer rätt extraktionsmetod baserat på filtyp."""
    suffix = Path(filename).suffix.lower()

    if suffix == ".pdf":
        return extract_text_from_pdf(file_bytes)
    elif suffix in {".png", ".jpg", ".jpeg", ".webp", ".tiff", ".bmp"}:
        return extract_text_from_image(file_bytes)
    else:
        raise ValueError(f"Filtypen '{suffix}' stöds inte. Använd PDF eller bild (PNG/JPG).")
