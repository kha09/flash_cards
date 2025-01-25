# PDF Chat API

This API allows you to upload PDFs and chat with their content using OpenAI's GPT model with LangChain.

## API Endpoints

### 1. Upload PDF
**POST** `/upload`

Upload a PDF file directly.

**Request:**
```bash
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: multipart/form-data" \
  -F "pdf=@path/to/yourfile.pdf"
```

**Response:**
```json
{
  "filename": "yourfile.pdf",
  "size": 123456,
  "message": "PDF processed and ready for chat"
}
```

### 2. Generate Flashcards
**POST** `/flashcards`

Generate Q&A flashcards from the uploaded PDF content.

**Request:**
```bash
curl -X POST http://localhost:3000/flashcards
```

**Response:**
```json
{
  "flashcards": [
    {
      "question": "What is the main topic?",
      "answer": "The main topic is..."
    },
    {
      "question": "What are the key points?",
      "answer": "The key points are..."
    }
  ],
  "count": 5,
  "timestamp": "2025-01-25T19:30:00.000Z"
}
```

### 3. Generate Summary
**POST** `/summarize`

Generate a bullet-point summary of the uploaded PDF content.

**Request:**
```bash
curl -X POST http://localhost:3000/summarize
```

**Response:**
```json
{
  "summary": [
    "Main topic of the document",
    "Key point 1",
    "Key point 2",
    "Important conclusion"
  ],
  "count": 4,
  "timestamp": "2025-01-25T19:30:00.000Z"
}
```

## Example Usage

1. Start the server:
```bash
node index.js
```

2. Upload a PDF:
```bash
curl -X POST http://localhost:3000/upload \
  -H "Content-Type: multipart/form-data" \
  -F "pdf=@myfile.pdf"
```

3. Ask questions:
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the key points in this document?"
  }'
```

## Notes
- Only one PDF can be processed at a time
- The API will only answer questions based on the uploaded PDF content
- If a question cannot be answered from the PDF, the response will indicate this
