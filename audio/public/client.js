// Global variables
let selectedFile = null;
let compressedFilename = null;

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

// Compress audio
async function compressAudio() {
  if (!selectedFile) {
    showStatus('Please select an audio file first', 'error');
    return;
  }

  try {
    showSpinner(true);
    compressBtn.disabled = true;

    const formData = new FormData();
    formData.append('audio', selectedFile);
    formData.append('bitrate', bitrateSelect.value);

    const response = await fetch('/api/compress', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Compression failed');
    }

    const result = await response.json();
    compressedFilename = result.compressedFile;

    // Display results
    displayResults(result);
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

// Display compression results
function displayResults(result) {
  const { stats, originalInfo } = result;
  
  document.getElementById('originalSize').textContent = formatBytes(stats.originalSize);
  document.getElementById('compressedSize').textContent = formatBytes(stats.compressedSize);
  document.getElementById('compressionRatio').textContent = stats.compressionRatio;
  document.getElementById('spaceSaved').textContent = stats.spaceSavedMB + ' MB';
  document.getElementById('usedBitrate').textContent = bitrateSelect.value + ' kbps';

  // Display audio info
  if (originalInfo) {
    const infoDiv = document.getElementById('audioInfo');
    document.getElementById('duration').textContent = 
      originalInfo.duration ? formatDuration(originalInfo.duration) : '-';
    document.getElementById('sampleRate').textContent = 
      originalInfo.sampleRate ? (originalInfo.sampleRate / 1000) + ' kHz' : '-';
    document.getElementById('channels').textContent = 
      originalInfo.channels || '-';
    document.getElementById('originalBitrate').textContent = 
      originalInfo.bitrate ? formatBytes(originalInfo.bitrate / 8) + '/s' : '-';
    infoDiv.style.display = 'block';
  }

  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Download audio
function downloadAudio() {
  if (!compressedFilename) {
    showStatus('No compressed file available', 'error');
    return;
  }

  const downloadUrl = `/api/download/${compressedFilename}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `compressed-${Date.now()}.mp3`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showStatus('📥 Download started!', 'success');
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
              <button class="btn-small" onclick="downloadFileByName('${file.filename}')">
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

// Download file by name
function downloadFileByName(filename) {
  const link = document.createElement('a');
  link.href = `/api/download/${filename}`;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Delete file (placeholder - implement on backend if needed)
function deleteFile(filename) {
  if (confirm('Are you sure you want to delete this file?')) {
    showStatus('Delete functionality not yet implemented', 'info');
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  refreshFileList();
});
