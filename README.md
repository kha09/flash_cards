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

### 2. Chat with PDF
**POST** `/chat`

Ask questions about the uploaded PDF content.

**Request:**
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the main topic of this document?"
  }'
```

**Response:**
```json
{
  "response": "The main topic is...",
  "context": "Based on the uploaded PDF content",
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
