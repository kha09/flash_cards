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

app.post('/flashcards', async (req, res) => {
  try {
    if (!vectorStore) {
      return res.status(400).json({ error: 'No PDF uploaded yet' });
    }

    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7
    });

    // Generate flashcards from the PDF content
    const prompt = `Generate 5-10 high-quality flashcards from the document content. 
    Each flashcard must have:
    1. A clear question that tests understanding of a key concept
    2. A concise answer that directly addresses the question
    3. The question and answer must be based strictly on the document content
    
    Return ONLY a valid JSON array where each element is an object with exactly:
    {
      "question": "the question text",
      "answer": "the answer text"
    }
    
    Do not include any additional text or explanations.`;

    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
    
    const response = await chain.call({
      query: prompt
    });

    console.log('Raw response:', response.text);

    // Parse and validate the response
    let flashcards;
    try {
      // Clean response text by removing any non-JSON content
      const jsonStart = response.text.indexOf('[');
      const jsonEnd = response.text.lastIndexOf(']') + 1;
      const jsonString = response.text.slice(jsonStart, jsonEnd);
      
      flashcards = JSON.parse(jsonString);
      
      if (!Array.isArray(flashcards)) {
        throw new Error('Invalid flashcard format');
      }
      
      // Validate each flashcard
      flashcards.forEach((card, index) => {
        if (!card.question || !card.answer) {
          throw new Error(`Flashcard ${index} missing question or answer`);
        }
      });
    } catch (error) {
      console.error('Flashcard parsing error:', error);
      throw new Error('Failed to generate valid flashcards: ' + error.message);
    }

    res.json({
      flashcards: flashcards,
      count: flashcards.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/summarize', async (req, res) => {
  try {
    if (!vectorStore) {
      return res.status(400).json({ error: 'No PDF uploaded yet' });
    }

    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7
    });

    // Generate summary from the PDF content
    const prompt = `Generate a concise bullet-point summary of the document content. 
    Each point should:
    1. Capture a key idea or fact from the document
    2. Be brief and to the point
    3. Be based strictly on the document content
    
    Return ONLY a valid JSON array of strings, where each string is a summary point.
    Do not include any additional text or explanations.`;

    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
    
    const response = await chain.call({
      query: prompt
    });

    console.log('Raw summary response:', response.text);

    // Parse and validate the response
    let summaryPoints;
    try {
      // Clean response text by removing any non-JSON content
      const jsonStart = response.text.indexOf('[');
      const jsonEnd = response.text.lastIndexOf(']') + 1;
      const jsonString = response.text.slice(jsonStart, jsonEnd);
      
      summaryPoints = JSON.parse(jsonString);
      
      if (!Array.isArray(summaryPoints)) {
        throw new Error('Invalid summary format');
      }
      
      // Validate each point
      summaryPoints.forEach((point, index) => {
        if (typeof point !== 'string') {
          throw new Error(`Summary point ${index} is not a string`);
        }
      });
    } catch (error) {
      console.error('Summary parsing error:', error);
      throw new Error('Failed to generate valid summary: ' + error.message);
    }

    res.json({
      summary: summaryPoints,
      count: summaryPoints.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mcq', async (req, res) => {
  try {
    if (!vectorStore) {
      return res.status(400).json({ error: 'No PDF uploaded yet' });
    }

    const model = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-3.5-turbo',
      temperature: 0.7
    });

    // Generate MCQs from the PDF content
    const prompt = `Generate 5 multiple choice questions from the document content.
    Each MCQ should:
    1. Have a clear question testing understanding of a key concept
    2. Have exactly 4 options (A, B, C, D)
    3. Have only one correct answer
    4. Be based strictly on the document content
    
    Return ONLY a valid JSON array where each element is an object with exactly:
    {
      "question": "the question text",
      "options": {
        "A": "first option",
        "B": "second option",
        "C": "third option",
        "D": "fourth option"
      },
      "correct_answer": "A/B/C/D"
    }
    
    Do not include any additional text or explanations.`;

    const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
    
    const response = await chain.call({
      query: prompt
    });

    console.log('Raw MCQ response:', response.text);

    // Parse and validate the response
    let mcqs;
    try {
      // Clean response text by removing any non-JSON content
      const jsonStart = response.text.indexOf('[');
      const jsonEnd = response.text.lastIndexOf(']') + 1;
      const jsonString = response.text.slice(jsonStart, jsonEnd);
      
      mcqs = JSON.parse(jsonString);
      
      if (!Array.isArray(mcqs)) {
        throw new Error('Invalid MCQ format');
      }
      
      // Validate each MCQ
      mcqs.forEach((mcq, index) => {
        if (!mcq.question || !mcq.options || !mcq.correct_answer) {
          throw new Error(`MCQ ${index} missing required fields`);
        }
        if (!['A', 'B', 'C', 'D'].includes(mcq.correct_answer)) {
          throw new Error(`MCQ ${index} has invalid correct answer`);
        }
        const optionKeys = Object.keys(mcq.options);
        if (optionKeys.length !== 4 || !optionKeys.every(key => ['A', 'B', 'C', 'D'].includes(key))) {
          throw new Error(`MCQ ${index} has invalid options`);
        }
      });
    } catch (error) {
      console.error('MCQ parsing error:', error);
      throw new Error('Failed to generate valid MCQs: ' + error.message);
    }

    res.json({
      mcqs: mcqs,
      count: mcqs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
