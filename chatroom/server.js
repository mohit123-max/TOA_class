const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize Gemini API (optional)
const API_KEY = null // process.env.GEMINI_API_KEY || "AIzaSyCD1nbXw4UhZgal_R7J5I6coGOzonqplLU";
let genAI = null;
let aiModel = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  console.log('Gemini AI enabled');
} else {
  console.log('Gemini API key not set. Will use predefined Q&A only.');
}

// Serve static files
app.use(express.static('public'));

// Setup file upload directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Store connected users
const users = {};

// Predefined Q&A database
const predefinedQA = {
  'hello': {
    question: 'How can I help you?',
    answer: 'I\'m an AI assistant here to answer your questions and provide information. You can ask me about almost anything!'
  },
  'time': {
    question: 'What is the current time?',
    answer: `The current time is ${new Date().toLocaleTimeString()}`
  },
  'date': {
    question: 'What is today\'s date?',
    answer: `Today's date is ${new Date().toLocaleDateString()}`
  },
  'help': {
    question: 'What can I do?',
    answer: 'I can help you with questions, provide information, and assist with various topics. Feel free to ask me anything!'
  },
  'hello world': {
    question: 'Hello World!',
    answer: 'Hello! Welcome to the chat. You can chat with other users in real-time or ask me for help using commands like "@bot help"'
  }
};

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    filename: req.file.originalname,
    url: fileUrl,
    size: req.file.size
  });
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // User joins
  socket.on('join', (username) => {
    users[socket.id] = username;
    console.log(`${username} joined the chat`);

    // Notify all users about the new user
    io.emit('userJoined', {
      username: username,
      message: `${username} joined the chat`,
      userCount: Object.keys(users).length,
      users: Object.values(users)
    });
  });

  // Handle incoming messages
  socket.on('sendMessage', (data) => {
    const username = users[socket.id];
    console.log(`${username}: ${data.message}`);

    // Check if message is AI request
    const lowerMessage = data.message.toLowerCase();
    if (lowerMessage.startsWith('@bot ')) {
      handleAIRequest(socket, username, data.message.substring(5));
      return;
    }

    // Broadcast message to all users
    io.emit('receiveMessage', {
      username: username,
      message: data.message,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  // Handle file upload message
  socket.on('sendFile', (data) => {
    const username = users[socket.id];
    console.log(`${username} shared file: ${data.filename}`);

    // Broadcast file to all users
    io.emit('receiveFile', {
      username: username,
      filename: data.filename,
      fileUrl: data.fileUrl,
      fileSize: data.fileSize,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  // Handle AI request
  socket.on('aiRequest', (data) => {
    const username = users[socket.id];
    handleAIRequest(socket, username, data.message);
  });

  // Typing indicator
  socket.on('typing', () => {
    socket.broadcast.emit('userTyping', {
      username: users[socket.id]
    });
  });

  // Stop typing
  socket.on('stopTyping', () => {
    socket.broadcast.emit('userStoppedTyping', {
      username: users[socket.id]
    });
  });

  // User disconnects
  socket.on('disconnect', () => {
    const username = users[socket.id];
    delete users[socket.id];
    console.log(`${username} left the chat`);

    io.emit('userLeft', {
      username: username,
      message: `${username} left the chat`,
      userCount: Object.keys(users).length,
      users: Object.values(users)
    });
  });
});

// Handle AI requests
async function handleAIRequest(socket, username, query) {
  const lowerQuery = query.toLowerCase().trim();
  
  // Check predefined Q&A first
  for (const [key, value] of Object.entries(predefinedQA)) {
    if (lowerQuery.includes(key)) {
      socket.emit('aiResponse', {
        question: value.question,
        answer: value.answer,
        source: 'predefined'
      });
      return;
    }
  }

  // Try Gemini API if available
  if (aiModel) {
    try {
      const result = await aiModel.generateContent(query);
      const response = result.response.text();
      
      socket.emit('aiResponse', {
        question: query,
        answer: response,
        source: 'gemini'
      });
    } catch (error) {
      console.error('Gemini API error:', error);
      socket.emit('aiResponse', {
        question: query,
        answer: 'Sorry, I encountered an error processing your request. Please try again later.',
        source: 'error'
      });
    }
  } else {
    // Default response if no Gemini API
    socket.emit('aiResponse', {
      question: query,
      answer: 'I don\'t have an answer for that. Try asking me something like: hello, time, date, or help. For more advanced questions, please set the GEMINI_API_KEY environment variable.',
      source: 'default'
    });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chat server running on http://localhost:${PORT}`);
});
