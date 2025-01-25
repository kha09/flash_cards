const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdf = require('pdf-parse');
const { OpenAI } = require('openai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { MemoryVectorStore } = require('langchain/vectorstores/memory');
const { ChatOpenAI } = require('@langchain/openai');
const { RetrievalQAChain } = require('langchain/chains');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize LangChain components
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY
});

let vectorStore = null;

// Routes
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'File must be a PDF' });
    }

    const data = await pdf(req.file.buffer);
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid PDF data received');
    }
    
    if (!data.text || typeof data.text !== 'string') {
      console.error('PDF parse result:', data);
      throw new Error('Failed to extract text from PDF');
    }

    // Clean and validate text
    let cleanText;
    try {
      cleanText = data.text.replace(/\s+/g, ' ').trim();
      if (!cleanText) {
        throw new Error('PDF contains no readable text');
      }
    } catch (error) {
      console.error('Text cleaning error:', error);
      throw new Error('Failed to process PDF text');
    }
    
    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });
    
    const docs = await textSplitter.createDocuments([cleanText]);
    
    // Create vector store
    vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    
    res.json({ 
      text: data.text,
      filename: req.file.originalname,
      size: req.file.size,
      message: 'PDF processed and ready for chat'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/chat', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!vectorStore) {
      return res.status(400).json({ error: 'No PDF uploaded yet' });
    }

    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7
    });

    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
    
    const response = await chain.call({
      query: question
    });

    res.json({
      response: response.text,
      context: "Based on the uploaded PDF content",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
