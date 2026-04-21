// Audio Compression Client - Browser-based MP3 compression using lamejs
// No FFmpeg needed!

let selectedFile = null;
let compressedAudioBlob = null;

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const audioInput = document.getElementById('audioInput');
const compressBtn = document.getElementById('compressBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resultsSection = document.getElementById('resultsSection');
const statusMessage = document.getElementById('statusMessage');
const spinner = document.getElementById('spinner');
const fileList = document.getElementById('fileList');
const bitrateSelect = document.getElementById('bitrate');

// Event listeners - Drag and Drop
uploadArea.addEventListener('dragover', handleDragOver);
uploadArea.addEventListener('dragleave', handleDragLeave);
uploadArea.addEventListener('drop', handleDrop);

// File input change
audioInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    selectedFile = e.target.files[0];
    updateUploadArea();
  }
});

// Compress button
compressBtn.addEventListener('click', compressAudio);

// Download button
downloadBtn.addEventListener('click', downloadAudio);

// Drag over handler
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.add('drag-over');
}

// Drag leave handler
function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.remove('drag-over');
}

// Drop handler
function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  uploadArea.classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    selectedFile = files[0];
    audioInput.files = files;
    updateUploadArea();
  }
}

// Update upload area display
function updateUploadArea() {
  if (selectedFile) {
    uploadArea.innerHTML = `
      <div class="file-selected">
        <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <p class="file-name">${selectedFile.name}</p>
        <p class="file-size">${formatBytes(selectedFile.size)}</p>
      </div>
    `;
    compressBtn.disabled = false;
  }
}

// Compress audio in browser
async function compressAudio() {
  if (!selectedFile) {
    showStatus('Please select an audio file first', 'error');
    return;
  }

  try {
    showSpinner(true);
    compressBtn.disabled = true;

    // Get bitrate from select
    const bitrateValue = parseInt(bitrateSelect.value);

    // Decode audio file
    showStatus('📊 Decoding audio...', 'info');
    const audioBuffer = await decodeAudioFile(selectedFile);

    // Encode to MP3
    showStatus('🎵 Encoding to MP3...', 'info');
    compressedAudioBlob = await encodeToMP3(audioBuffer, bitrateValue);

    // Calculate stats
    const originalSize = selectedFile.size;
    const compressedSize = compressedAudioBlob.size;
    const stats = calculateCompressionStats(originalSize, compressedSize, bitrateValue);

    // Display results
    displayResults(stats, audioBuffer);

    // Save to server
    showStatus('💾 Saving to server...', 'info');
    await saveCompressedToServer(compressedAudioBlob);

    showStatus('✅ Audio compressed successfully!', 'success');
    
    // Refresh file list
    refreshFileList();
  } catch (error) {
    showStatus(`❌ Error: ${error.message}`, 'error');
    console.error('Compression error:', error);
  } finally {
    showSpinner(false);
    compressBtn.disabled = false;
  }
}

// Decode audio file to AudioBuffer
async function decodeAudioFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(e.target.result);
        resolve(audioBuffer);
      } catch (err) {
        reject(new Error(`Failed to decode audio: ${err.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read audio file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

// Encode AudioBuffer to MP3 using lamejs
async function encodeToMP3(audioBuffer, bitrate) {
  return new Promise((resolve, reject) => {
    try {
      // Check if lamejs is loaded
      if (typeof lamejs === 'undefined') {
        reject(new Error('lamejs library not loaded. Please refresh the page.'));
        return;
      }

      const samples = audioBuffer.getChannelData(0);
      const encoder = new lamejs.Mp3Encoder(
        audioBuffer.numberOfChannels,
        audioBuffer.sampleRate,
        bitrate
      );

      const mp3Data = [];
      const SAMPLES_PER_FRAME = 1152;
      const sampleLength = samples.length;

      for (let i = 0; i < sampleLength; i += SAMPLES_PER_FRAME) {
        const sampleChunk = samples.slice(i, i + SAMPLES_PER_FRAME);
        const pcm = new Float32Array(sampleChunk);
        
        // Convert float samples to int16
        const int16 = floatTo16BitPCM(pcm);
        const mp3buf = encoder.encodeBuffer(int16);
        
        if (mp3buf.length > 0) {
          mp3Data.push(new Uint8Array(mp3buf));
        }
      }

      // Finish encoding
      const finalBuf = encoder.flush();
      if (finalBuf.length > 0) {
        mp3Data.push(new Uint8Array(finalBuf));
      }

      // Combine all chunks
      const totalLength = mp3Data.reduce((acc, arr) => acc + arr.length, 0);
      const mp3Buffer = new Uint8Array(totalLength);
      let offset = 0;

      for (let chunk of mp3Data) {
        mp3Buffer.set(chunk, offset);
        offset += chunk.length;
      }

      const blob = new Blob([mp3Buffer], { type: 'audio/mpeg' });
      resolve(blob);
    } catch (error) {
      reject(new Error(`MP3 encoding failed: ${error.message}`));
    }
  });
}

// Convert float32 to int16 PCM
function floatTo16BitPCM(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    int16[i] = float32Array[i] < 0 ? float32Array[i] * 0x8000 : float32Array[i] * 0x7FFF;
  }
  return int16;
}

// Save compressed audio to server
async function saveCompressedToServer(blob) {
  try {
    const response = await fetch('/api/save-compressed', {
      method: 'POST',
      body: blob,
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save compressed audio');
    }

    const result = await response.json();
    downloadBtn.onclick = () => downloadFile(result.filename);
    return result;
  } catch (error) {
    console.warn('Could not save to server:', error.message);
    // Still allow download even if server save fails
  }
}

// Display compression results
function displayResults(stats, audioBuffer) {
  document.getElementById('originalSize').textContent = formatBytes(stats.originalSize);
  document.getElementById('compressedSize').textContent = formatBytes(stats.compressedSize);
  document.getElementById('compressionRatio').textContent = stats.compressionRatio;
  document.getElementById('spaceSaved').textContent = stats.spaceSavedMB + ' MB';
  document.getElementById('usedBitrate').textContent = stats.bitrate + ' kbps';

  // Display audio info
  const infoDiv = document.getElementById('audioInfo');
  const duration = audioBuffer.duration;
  document.getElementById('duration').textContent = formatDuration(duration);
  document.getElementById('sampleRate').textContent = (audioBuffer.sampleRate / 1000).toFixed(1) + ' kHz';
  document.getElementById('channels').textContent = audioBuffer.numberOfChannels;
  document.getElementById('originalBitrate').textContent = 'N/A (decoded)';
  infoDiv.style.display = 'block';

  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Download audio
function downloadAudio() {
  if (!compressedAudioBlob) {
    showStatus('No compressed audio available', 'error');
    return;
  }

  const link = document.createElement('a');
  link.href = URL.createObjectURL(compressedAudioBlob);
  link.download = `compressed-${Date.now()}.mp3`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  
  showStatus('📥 Download started!', 'success');
}

// Download file from server
function downloadFile(filename) {
  const link = document.createElement('a');
  link.href = `/api/download/${filename}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Refresh file list
async function refreshFileList() {
  try {
    const response = await fetch('/api/files');
    const result = await response.json();

    if (result.success && result.files.length > 0) {
      fileList.innerHTML = result.files
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(file => `
          <div class="file-item">
            <div class="file-details">
              <p class="file-name">${file.filename}</p>
              <p class="file-meta">
                <span>${file.sizeFormatted}</span>
                <span>•</span>
                <span>${new Date(file.createdAt).toLocaleString()}</span>
              </p>
            </div>
            <div class="file-actions">
              <button class="btn-small" onclick="downloadFile('${file.filename}')">
                Download
              </button>
              <button class="btn-small btn-delete" onclick="deleteFile('${file.filename}')">
                Delete
              </button>
            </div>
          </div>
        `)
        .join('');
    } else {
      fileList.innerHTML = '<p class="empty-state">No compressed files yet</p>';
    }
  } catch (error) {
    fileList.innerHTML = `<p class="error">Failed to load files: ${error.message}</p>`;
  }
}

// Delete file
async function deleteFile(filename) {
  if (confirm('Are you sure you want to delete this file?')) {
    try {
      const response = await fetch(`/api/files/${filename}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        showStatus('✅ File deleted', 'success');
        refreshFileList();
      } else {
        showStatus('❌ Failed to delete file', 'error');
      }
    } catch (error) {
      showStatus(`❌ Error: ${error.message}`, 'error');
    }
  }
}

// Show status message
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;
  statusMessage.style.display = 'block';

  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
}

// Show/hide spinner
function showSpinner(show) {
  spinner.style.display = show ? 'flex' : 'none';
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Format duration
function formatDuration(seconds) {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

// Calculate compression stats
function calculateCompressionStats(originalSize, compressedSize, bitrate) {
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);
  const savings = originalSize - compressedSize;
  
  return {
    originalSize,
    compressedSize,
    compressionRatio: `${ratio}%`,
    spaceSaved: savings,
    spaceSavedMB: (savings / (1024 * 1024)).toFixed(2),
    reduction: `${(compressedSize / originalSize * 100).toFixed(2)}%`,
    bitrate
  };
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  refreshFileList();
});
