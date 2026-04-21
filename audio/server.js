const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create directories if they don't exist
const uploadDir = path.join(__dirname, 'uploads');
const compressedDir = path.join(__dirname, 'compressed');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(compressedDir)) {
  fs.mkdirSync(compressedDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'audio-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const audioFormats = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (audioFormats.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file format. Accepted formats: ${audioFormats.join(', ')}`));
    }
  }
});

/**
 * Route: Upload audio file
 * POST /api/upload
 */
app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const originalSize = req.file.size;
    const filename = req.file.filename;
    const filepath = req.file.path;

    res.json({
      success: true,
      message: 'File uploaded successfully',
      filename,
      originalSize,
      formattedSize: formatBytes(originalSize),
      readUrl: `/api/read/${filename}`
    });
  } catch (error) {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      error: error.message || 'Upload failed'
    });
  }
});

/**
 * Route: Read audio file as blob
 * GET /api/read/:filename
 */
app.get('/api/read/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(uploadDir, filename);

    // Security check: prevent directory traversal
    if (!filepath.startsWith(uploadDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Send file
    res.sendFile(filepath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Route: Save compressed audio
 * POST /api/save-compressed
 */
app.post('/api/save-compressed', express.raw({ type: 'audio/mpeg', limit: '500mb' }), async (req, res) => {
  try {
    const compressedFilename = 'compressed-' + Date.now() + '.mp3';
    const compressedPath = path.join(compressedDir, compressedFilename);

    // Write the compressed audio buffer to file
    fs.writeFileSync(compressedPath, req.body);

    res.json({
      success: true,
      message: 'Compressed audio saved',
      filename: compressedFilename,
      downloadUrl: `/api/download/${compressedFilename}`
    });
  } catch (error) {
    res.status(500).json({
      error: error.message || 'Failed to save compressed audio'
    });
  }
});

/**
 * Route: Download compressed audio
 * GET /api/download/:filename
 */
app.get('/api/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(compressedDir, filename);

    // Security check: prevent directory traversal
    if (!filepath.startsWith(compressedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Send file
    res.download(filepath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Route: Get compression history
 * GET /api/files
 */
app.get('/api/files', (req, res) => {
  try {
    const files = fs.readdirSync(compressedDir);
    const fileStats = files.map(file => {
      const filepath = path.join(compressedDir, file);
      const stats = fs.statSync(filepath);
      return {
        filename: file,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        createdAt: stats.birthtime
      };
    });

    res.json({
      success: true,
      files: fileStats,
      totalFiles: files.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Route: Delete compressed file
 * DELETE /api/files/:filename
 */
app.delete('/api/files/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filepath = path.join(compressedDir, filename);

    // Security check: prevent directory traversal
    if (!filepath.startsWith(compressedDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete file
    fs.unlinkSync(filepath);

    res.json({
      success: true,
      message: 'File deleted'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check route
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Audio Compression Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
  console.log(`📁 Compressed directory: ${compressedDir}`);
});
