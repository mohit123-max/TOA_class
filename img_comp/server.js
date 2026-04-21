'use strict';

const express  = require('express');
const multer   = require('multer');
const path     = require('path');

const { compressImage } = require('./svdCompressor');
const { computeMetrics } = require('./metrics');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Multer: accept images up to 30 MB, memory storage ───────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits : { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp|bmp|tiff)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload JPEG, PNG, WebP, BMP, or TIFF.'));
    }
  },
});

// ─── POST /compress ───────────────────────────────────────────────────────────
/**
 * Body (multipart/form-data):
 *   image          — image file
 *   keepRatio      — float 0.01–1.0 (fraction of singular values to keep)
 *
 * Response JSON:
 *   originalImage      — base64 PNG of the (possibly resized) original
 *   reconstructedImage — base64 PNG of the SVD reconstruction
 *   metrics            — { psnr, ssim, mse }
 *   sizes              — { originalFile, originalRaw, svdRepr, reconPng }
 *   info               — { width, height, kActual, maxRank, energyPct, wasResized }
 *   singularValues     — first 80 singular values of the green channel
 */
app.post('/compress', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    const keepRatio = Math.max(0.01, Math.min(1.0,
      parseFloat(req.body.keepRatio) || 0.10
    ));

    console.log(`[compress] ${req.file.originalname} | ${req.file.size} bytes | keepRatio=${keepRatio}`);

    // ── SVD compression ──────────────────────────────────────────────────────
    const result = await compressImage(req.file.buffer, keepRatio);

    // ── Quality metrics ──────────────────────────────────────────────────────
    const metrics = computeMetrics(
      result.originalRawPixels,
      result.reconPixels,
      result.width,
      result.height
    );

    // Log quality metrics
    console.log(`\n📊 QUALITY METRICS:`);
    console.log(`   PSNR: ${metrics.psnr === null ? '∞ (lossless)' : metrics.psnr.toFixed(2)} dB`);
    console.log(`   SSIM: ${metrics.ssim.toFixed(4)} (structural similarity)`);
    console.log(`   MSE:  ${metrics.mse.toFixed(2)} (mean squared error)`);
    console.log(`\n📦 OUTPUT SIZES:`);
    console.log(`   Original file:  ${(result.originalFileBytes / 1024).toFixed(2)} KB`);
    console.log(`   Original PNG:   ${(result.originalPngBytes / 1024).toFixed(2)} KB`);
    console.log(`   Reconstructed:  ${(result.reconPngBytes / 1024).toFixed(2)} KB`);
    console.log(`   Compression used: ${result.wasCompressed ? 'YES ✓' : 'NO (original kept)'}\n`);

    // ── Response ─────────────────────────────────────────────────────────────
    res.json({
      originalImage      : result.originalPng.toString('base64'),
      reconstructedImage : result.reconstructedPng.toString('base64'),
      metrics: {
        psnr : +metrics.psnr.toFixed(2),
        ssim : +metrics.ssim.toFixed(4),
        mse  : +metrics.mse.toFixed(2),
      },
      sizes: {
        originalFile : result.originalFileBytes,
        originalRaw  : result.rawBytes,
        svdRepr      : result.svdBytes,
        reconPng     : result.reconPngBytes,
      },
      info: {
        width      : result.width,
        height     : result.height,
        kActual    : result.kActual,
        maxRank    : result.maxRank,
        energyPct  : +result.energyPct.toFixed(2),
        wasResized : result.wasResized,
        wasCompressed : result.wasCompressed,
        compressionRatio : result.compressionRatio,
        message    : result.wasCompressed 
          ? `✓ SVD compression applied (${(result.compressionRatio * 100).toFixed(1)}% of original)`
          : `ℹ Image too small or compression not beneficial — original kept`,
      },
      singularValues: result.singularValues,
    });

  } catch (err) {
    console.error('[compress] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔬 SVD Image Compressor`);
  console.log(`   http://localhost:${PORT}\n`);
});
