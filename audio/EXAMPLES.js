// Example: Using the Audio Compression API

// ============================================
// Example 1: Compress Audio from Frontend (JavaScript)
// ============================================

async function compressAudioFile(audioFile, bitrate = 128) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('bitrate', bitrate);

  try {
    const response = await fetch('http://localhost:3000/api/compress', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Compression failed');
    }

    const result = await response.json();
    console.log('Compression successful:', result);
    
    return {
      downloadUrl: result.downloadUrl,
      stats: result.stats,
      originalInfo: result.originalInfo
    };
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage:
// const file = document.getElementById('fileInput').files[0];
// const result = await compressAudioFile(file, 192);


// ============================================
// Example 2: Download Compressed Audio
// ============================================

function downloadCompressedAudio(filename) {
  const link = document.createElement('a');
  link.href = `http://localhost:3000/api/download/${filename}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Usage:
// downloadCompressedAudio('compressed-1700000000000.mp3');


// ============================================
// Example 3: Get Audio Information
// ============================================

async function getAudioInfo(audioFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);

  try {
    const response = await fetch('http://localhost:3000/api/info', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    console.log('Audio Info:', result.audioInfo);
    return result.audioInfo;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage:
// const file = document.getElementById('fileInput').files[0];
// const info = await getAudioInfo(file);
// console.log(`Duration: ${info.duration}s, Sample Rate: ${info.sampleRate}Hz`);


// ============================================
// Example 4: List All Compressed Files
// ============================================

async function getCompressedFiles() {
  try {
    const response = await fetch('http://localhost:3000/api/files');
    const result = await response.json();
    
    console.log(`Found ${result.totalFiles} compressed files:`);
    result.files.forEach(file => {
      console.log(`- ${file.filename} (${file.sizeFormatted})`);
    });
    
    return result.files;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage:
// const files = await getCompressedFiles();


// ============================================
// Example 5: Processing Multiple Files
// ============================================

async function compressMultipleFiles(audioFiles, bitrate = 128) {
  const results = [];

  for (const file of audioFiles) {
    try {
      console.log(`Compressing ${file.name}...`);
      const result = await compressAudioFile(file, bitrate);
      results.push({
        filename: file.name,
        ...result
      });
    } catch (error) {
      console.error(`Failed to compress ${file.name}:`, error);
    }
  }

  return results;
}

// Usage:
// const files = document.getElementById('multipleFiles').files;
// const results = await compressMultipleFiles(files, 192);


// ============================================
// Example 6: Using with HTML Form
// ============================================

/*
HTML:
<form id="audioForm">
  <input type="file" id="audioInput" accept="audio/*" required>
  <select id="bitrate">
    <option value="128">128 kbps</option>
    <option value="192">192 kbps</option>
    <option value="256">256 kbps</option>
  </select>
  <button type="submit">Compress</button>
</form>

JavaScript:
*/

document.getElementById('audioForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const audioFile = document.getElementById('audioInput').files[0];
  const bitrate = parseInt(document.getElementById('bitrate').value);

  const result = await compressAudioFile(audioFile, bitrate);
  
  if (result) {
    alert(`Compressed! Original: ${result.stats.originalSize} bytes, Compressed: ${result.stats.compressedSize} bytes`);
    downloadCompressedAudio(result.downloadUrl.split('/').pop());
  }
});


// ============================================
// Example 7: Node.js Backend Integration
// ============================================

/*
Using a Node.js backend to compress and send to client:
*/

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function compressAudioFromNodejs(inputFilePath, bitrate = 128) {
  const form = new FormData();
  form.append('audio', fs.createReadStream(inputFilePath));
  form.append('bitrate', bitrate);

  try {
    const response = await fetch('http://localhost:3000/api/compress', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const result = await response.json();
    console.log('Compression successful:', result);
    return result;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage:
// const result = await compressAudioFromNodejs('./my-audio.wav', 192);


// ============================================
// Example 8: Calculate Compression Metrics
// ============================================

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function calculateMetrics(originalSize, compressedSize) {
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);
  const savings = originalSize - compressedSize;

  return {
    originalSize: formatBytes(originalSize),
    compressedSize: formatBytes(compressedSize),
    compressionRatio: `${ratio}%`,
    spaceSaved: formatBytes(savings),
    reductionFactor: (originalSize / compressedSize).toFixed(2) + 'x'
  };
}

// Usage:
// const metrics = calculateMetrics(5242880, 524288);
// console.log(`Compression: ${metrics.compressionRatio}`);
// console.log(`File reduced from ${metrics.originalSize} to ${metrics.compressedSize}`);


// ============================================
// Example 9: Real-time Compression Progress
// ============================================

async function compressWithProgress(audioFile, bitrate = 128, onProgress) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('bitrate', bitrate);

  try {
    onProgress?.(0, 'Starting compression...');

    const response = await fetch('http://localhost:3000/api/compress', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Compression failed');
    }

    onProgress?.(50, 'Processing audio...');

    const result = await response.json();

    onProgress?.(100, 'Compression complete!');

    return result;
  } catch (error) {
    onProgress?.(0, `Error: ${error.message}`);
    console.error('Error:', error);
  }
}

// Usage:
// const file = document.getElementById('fileInput').files[0];
// await compressWithProgress(file, 128, (progress, message) => {
//   console.log(`${progress}% - ${message}`);
//   document.getElementById('progressBar').style.width = progress + '%';
// });


// ============================================
// Example 10: Integration with Chat Application
// ============================================

/*
Sending compressed audio through a chat application:

1. User records audio message
2. Compress using this utility
3. Send compressed MP3 (much smaller)
4. Recipient downloads and plays MP3
5. Browser/player automatically decompresses for playback

Example for your chatroom:
*/

async function sendCompressedAudioMessage(audioFile, chatSocket, recipientId) {
  try {
    console.log('Compressing audio before sending...');
    
    const result = await compressAudioFile(audioFile, 128);
    const compressedFilename = result.downloadUrl.split('/').pop();
    
    // Download the compressed file
    const blob = await fetch(result.downloadUrl).then(r => r.blob());
    
    // Send through chat socket
    chatSocket.emit('message', {
      type: 'audio',
      recipientId,
      audioUrl: result.downloadUrl,
      originalSize: result.stats.originalSize,
      compressedSize: result.stats.compressedSize,
      compressionRatio: result.stats.compressionRatio
    });
    
    console.log(`Audio sent! Reduced from ${formatBytes(result.stats.originalSize)} to ${formatBytes(result.stats.compressedSize)}`);
  } catch (error) {
    console.error('Failed to send audio:', error);
  }
}


// ============================================
// Export for use in other modules
// ============================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    compressAudioFile,
    downloadCompressedAudio,
    getAudioInfo,
    getCompressedFiles,
    compressMultipleFiles,
    calculateMetrics,
    formatBytes,
    compressWithProgress,
    sendCompressedAudioMessage
  };
}
