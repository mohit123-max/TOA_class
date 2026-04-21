const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');

// Set FFmpeg and FFprobe paths from static packages
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Compress audio file to MP3
 * @param {string} inputPath - Path to input audio file
 * @param {string} outputPath - Path to save compressed MP3
 * @param {number} bitrate - Bitrate in kbps (default: 128)
 * @returns {Promise<object>} - Object with compression stats
 */
async function compressAudio(inputPath, outputPath, bitrate = 128) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate(bitrate)
      .audioChannels(2)
      .audioFrequency(44100)
      .format('mp3')
      .on('error', (err) => {
        reject(new Error(`Compression error: ${err.message}`));
      })
      .on('end', () => {
        try {
          const stats = fs.statSync(outputPath);
          resolve({
            success: true,
            outputPath,
            compressedSize: stats.size,
            bitrate,
            message: `Successfully compressed to ${stats.size} bytes`
          });
        } catch (err) {
          reject(new Error(`Failed to read compressed file: ${err.message}`));
        }
      })
      .save(outputPath);
  });
}

/**
 * Get audio file information
 * @param {string} filePath - Path to audio file
 * @returns {Promise<object>} - Audio metadata
 */
async function getAudioInfo(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to get audio info: ${err.message}`));
      } else {
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        resolve({
          duration: metadata.format.duration,
          bitrate: metadata.format.bit_rate,
          sampleRate: audioStream?.sample_rate,
          channels: audioStream?.channels,
          codec: audioStream?.codec_name
        });
      }
    });
  });
}

/**
 * Calculate compression ratio
 * @param {number} originalSize - Original file size in bytes
 * @param {number} compressedSize - Compressed file size in bytes
 * @returns {object} - Compression stats
 */
function calculateCompressionStats(originalSize, compressedSize) {
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);
  const savings = originalSize - compressedSize;
  
  return {
    originalSize,
    compressedSize,
    compressionRatio: `${ratio}%`,
    spaceSaved: savings,
    spaceSavedMB: (savings / (1024 * 1024)).toFixed(2),
    reduction: `${(compressedSize / originalSize * 100).toFixed(2)}%`
  };
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

module.exports = {
  compressAudio,
  getAudioInfo,
  calculateCompressionStats,
  formatBytes
};
