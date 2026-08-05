import fitz

def extract_text_from_pdf(file_bytes: bytes, max_chars: int = 8000) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    chunks, total = [], 0
    for page in doc:
        text = page.get_text()
        chunks.append(text)
        total += len(text)
        if total >= max_chars:
            break
    doc.close()
    return " ".join(chunks)[:max_chars]
