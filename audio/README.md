# 🎵 Audio Compression Utility

A Node.js application for compressing audio files using MP3 format and decompressing them on the receiving end. Perfect for sending large audio files over the network while minimizing bandwidth and storage usage.

## Features

- **Audio Compression**: Convert any audio format to MP3 with adjustable bitrates
- **File Upload**: Upload audio files via drag-and-drop or file browser
- **Compression Stats**: View detailed compression information and savings
- **Audio Metadata**: Get information about duration, sample rate, channels, etc.
- **Download**: Download compressed files from the server
- **File History**: View and manage previously compressed files
- **Multiple Bitrate Options**: 64 kbps to 320 kbps for quality/size tradeoff

## Prerequisites

1. **Node.js** (v14 or higher) - [Download](https://nodejs.org/)

That's it! FFmpeg is automatically installed via npm (no manual download needed)

## Installation

1. Navigate to the audio folder:
```bash
cd audio
```

2. Install dependencies:
```bash
npm install
```

The FFmpeg binaries will be automatically downloaded and installed.

## Running the Server

Start the development server:
```bash
npm start
```

Or use nodemon for auto-reload during development:
```bash
npm run dev
```

The server will start on `http://localhost:3000`

You should see:
```
🎵 Audio Compression Server running on http://localhost:3000
📁 Upload directory: [path]/uploads
📁 Compressed directory: [path]/compressed
```

## Usage

### Via Web Interface

1. Open `http://localhost:3000` in your browser
2. **Drag and drop** an audio file or click **"Browse Files"**
3. Select compression **bitrate** (128 kbps recommended for balance)
4. Click **"Compress Audio"**
5. View compression statistics
6. Click **"Download Compressed Audio"** to save the MP3 file

### Supported Audio Formats

- MP3, WAV, M4A, FLAC, AAC, OGG

### Bitrate Options & Quality

| Bitrate | Quality | Use Case |
|---------|---------|----------|
| 64 kbps | Low | Voice, bandwidth-critical |
| 96 kbps | Fair | Acceptable for most uses |
| **128 kbps** | **Good** | **Recommended (default)** |
| 192 kbps | High | Music, quality matters |
| 256 kbps | Very High | High-fidelity audio |
| 320 kbps | Best | Maximum quality |

## API Endpoints

### POST `/api/compress`
Compress an audio file to MP3

**Parameters:**
- `audio` (file): Audio file to compress
- `bitrate` (optional, number): Bitrate in kbps (default: 128)

**Response:**
```json
{
  "success": true,
  "stats": {
    "originalSize": 5242880,
    "compressedSize": 524288,
    "compressionRatio": "90.00%",
    "spaceSaved": 4718592,
    "spaceSavedMB": "4.50"
  },
  "originalInfo": {
    "duration": 120,
    "bitrate": 128000,
    "sampleRate": 44100,
    "channels": 2,
    "codec": "aac"
  },
  "downloadUrl": "/api/download/compressed-1700000000000.mp3"
}
```

### GET `/api/download/:filename`
Download a compressed audio file

**Parameters:**
- `filename`: Name of the compressed file

**Returns:** Audio file (MP3)

### GET `/api/files`
List all compressed files

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "filename": "compressed-1700000000000.mp3",
      "size": 524288,
      "sizeFormatted": "512 KB",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "totalFiles": 1
}
```

### POST `/api/info`
Get audio information without compression

**Parameters:**
- `audio` (file): Audio file to analyze

**Response:**
```json
{
  "success": true,
  "fileSize": 5242880,
  "fileSizeFormatted": "5 MB",
  "audioInfo": {
    "duration": 120,
    "bitrate": 128000,
    "sampleRate": 44100,
    "channels": 2,
    "codec": "aac"
  }
}
```

## File Structure

```
audio/
├── server.js           # Express server with API endpoints
├── audioUtils.js       # Audio compression utilities
├── package.json        # Dependencies
├── public/
│   ├── index.html      # Web interface
│   ├── client.js       # Frontend logic
│   └── style.css       # Styling
├── uploads/            # Temporary upload storage
└── compressed/         # Compressed file storage
```

## How It Works

### Compression Flow

1. **Upload**: File is uploaded to the server (`/uploads` directory)
2. **Process**: FFmpeg converts to MP3 at specified bitrate
3. **Store**: Compressed file is saved to `/compressed` directory
4. **Return**: Download link and compression stats are returned to client

### Decompression

The MP3 file can be played directly in any MP3 player - no manual decompression needed. The MP3 format is already decompressed for playback.

### Size Optimization

**Example**: 10 MB WAV file
- Original: 10 MB
- Compressed at 128 kbps: ~1 MB
- **Compression: 90% reduction**

## Configuration

### Adjust Server Settings

Edit `server.js` to modify:

```javascript
// Max upload size (currently 500MB)
limits: {
  fileSize: 500 * 1024 * 1024
}

// Change default port
const PORT = process.env.PORT || 3000;

// Add more accepted formats
const audioFormats = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'];
```

### Environment Variables

Create `.env` file:
```
PORT=3000
MAX_FILE_SIZE=500
```

## Troubleshooting

### Upload Size Limit Exceeded
```
Error: File too large
```
**Solution**: Increase file size limit in `server.js` or compress before uploading

### Port Already in Use
```
Error: EADDRINUSE - Port 3000 is already in use
```
**Solution**: Change PORT in `.env` or close the app using port 3000

### No Audio Device Issues
The compression works server-side and doesn't require audio output devices.

## Performance Tips

1. **Choose Appropriate Bitrate**: 128 kbps is usually sufficient
2. **Batch Processing**: Process multiple files sequentially
3. **Storage**: Periodically clean the `/compressed` folder
4. **Monitor**: Check server logs for large files

## Security Considerations

- File uploads are validated for type
- File size is limited to 500MB
- Directory traversal is prevented
- Temporary files are cleaned up
- Consider adding authentication for production use

## Real-World Use Cases

- **Voice Messages**: Send compressed WAV files as MP3
- **Music Library**: Build compressed audio archives
- **Video Production**: Pre-compress audio before editing
- **Cloud Storage**: Reduce bandwidth for audio uploads
- **Streaming**: Send audio over limited bandwidth connections

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile Browsers: ✅ Full support

## License

MIT

## Support

For issues or questions, check FFmpeg documentation or contact support.

---

**Built with Node.js, Express, and FFmpeg** 🚀
