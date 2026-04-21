/**
 * SVD Image Compressor
 *
 * Mathematical basis: Singular Value Decomposition
 *   A = U · Σ · Vᵀ
 *
 * For an m×n image channel matrix A:
 *   - U  is m×m  (left singular vectors = row features)
 *   - Σ  is m×n  (diagonal matrix of singular values — sorted descending)
 *   - Vᵀ is n×n  (right singular vectors = column features)
 *
 * Compressed representation (rank-k approximation):
 *   Aₖ = Uₖ · Σₖ · Vₖᵀ
 *   where Uₖ is m×k, Σₖ is k×k, Vₖᵀ is k×n
 *
 * Storage cost:  k·(m + 1 + n) float32 values  (vs m·n uint8 original)
 * Break-even:    k < m·n / (4·(m+n+1))    [factor of 4 for float32 vs uint8]
 *
 * Energy captured by rank-k:
 *   E(k) = Σᵢ₌₁ᵏ σᵢ² / Σᵢ σᵢ²
 */

'use strict';

const sharp = require('sharp');
const { Matrix, SVD } = require('ml-matrix');

// Cap image size to keep SVD fast (SVD is O(min(m,n)³))
const MAX_DIM = 320;

// Minimum image size for SVD to be beneficial
const MIN_DIM = 100;

/**
 * Compress an image buffer using rank-k SVD per RGB channel.
 *
 * @param {Buffer} inputBuffer   - Raw image file bytes
 * @param {number} keepRatio     - Fraction of singular values to keep (0.01 – 1.0)
 * @returns {Promise<Object>}    - Compression results and image buffers
 */
async function compressImage(inputBuffer, keepRatio) {
  console.log('\n' + '='.repeat(70));
  console.log('🔬 SVD IMAGE COMPRESSION PROCESS');
  console.log('='.repeat(70));

  // ─── 1. Load & normalise image ────────────────────────────────────────────
  let pipeline = sharp(inputBuffer);
  const meta = await pipeline.metadata();

  let { width, height } = meta;
  let wasResized = false;

  console.log(`\n📥 INPUT IMAGE:`);
  console.log(`   Format: ${meta.format} | Original: ${meta.width}×${meta.height}`);
  console.log(`   File size: ${(inputBuffer.length / 1024).toFixed(2)} KB`);

  if (width > MAX_DIM || height > MAX_DIM) {
    const scale = MAX_DIM / Math.max(width, height);
    width  = Math.round(width  * scale);
    height = Math.round(height * scale);
    pipeline = pipeline.resize(width, height, { fit: 'inside' });
    wasResized = true;
    console.log(`⚠️  RESIZED: ${meta.width}×${meta.height} → ${width}×${height} (max ${MAX_DIM}px)`);
  }

  // Flatten alpha → white, ensure 3-channel sRGB
  const { data: rawPixels } = await pipeline
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = width * height;
  const rawBytes = width * height * 3;

  console.log(`✓ Working dimensions: ${width}×${height}`);
  console.log(`  Raw pixel data: ${(rawBytes / 1024).toFixed(2)} KB (${pixelCount} pixels × 3 channels)`);

  // ─── Check 1: Minimum image size ─────────────────────────────────────────
  // SVD is only beneficial for images larger than MIN_DIM
  const isTooSmall = width < MIN_DIM || height < MIN_DIM;

  console.log(`\n🔍 CHECK 1: MINIMUM SIZE REQUIREMENT`);
  console.log(`   Threshold: ≥ ${MIN_DIM}×${MIN_DIM} pixels`);
  console.log(`   Status: ${isTooSmall ? '❌ TOO SMALL - will skip compression' : '✓ OK'}`);

  // ─── 2. Split into per-channel matrices ──────────────────────────────────
  // Each channel is a Float64 height×width matrix
  const channelArrays = [[], [], []];
  for (let r = 0; r < height; r++) {
    channelArrays[0].push([]);
    channelArrays[1].push([]);
    channelArrays[2].push([]);
    for (let c = 0; c < width; c++) {
      const idx = (r * width + c) * 3;
      channelArrays[0][r].push(rawPixels[idx    ]);  // R
      channelArrays[1][r].push(rawPixels[idx + 1]);  // G
      channelArrays[2][r].push(rawPixels[idx + 2]);  // B
    }
  }

  console.log(`\n📊 CHANNEL MATRICES CREATED: 3 matrices of ${width}×${height}`);

  // ─── 3. Check 2: Rank threshold (will SVD be beneficial?) ──────────────────
  const maxRank   = Math.min(height, width);
  const k         = Math.max(1, Math.round(maxRank * keepRatio));
  const kActual   = Math.min(k, maxRank);

  // Predicted SVD size = 3 channels × [height×k + k + width×k] × 4 bytes (float32)
  const predictedSvdBytes = 3 * (height * kActual + kActual + width * kActual) * 4;

  // Check if SVD would actually save space (threshold: only compress if SVD is 70% of original or less)
  const compressionRatio = predictedSvdBytes / rawBytes;
  const isCompressionWorthwhile = compressionRatio < 0.7 && !isTooSmall;

  console.log(`\n🔍 CHECK 2: COMPRESSION WORTHWHILENESS`);
  console.log(`   Max rank: min(${height}, ${width}) = ${maxRank}`);
  console.log(`   Keep ratio: ${(keepRatio * 100).toFixed(1)}%`);
  console.log(`   Rank k: ${kActual} (out of ${maxRank})`);
  console.log(`   \n   Predicted SVD size:`);
  console.log(`     Formula: 3 × (${height}×${kActual} + ${kActual} + ${width}×${kActual}) × 4 bytes`);
  console.log(`     = 3 × ${(height + width + 1) * kActual} × 4 = ${(predictedSvdBytes / 1024).toFixed(2)} KB`);
  console.log(`   \n   Raw size: ${(rawBytes / 1024).toFixed(2)} KB`);
  console.log(`   Compression ratio: ${(compressionRatio * 100).toFixed(1)}% (threshold: 70%)`);
  console.log(`   Status: ${isCompressionWorthwhile ? '✓ WORTHWHILE - will apply SVD' : '❌ NOT WORTHWHILE - will keep original'}`);

  // ─── 4. Conditional compression or fallback ──────────────────────────────
  let reconstructedChannels = [];
  let allSingularValues = [[], [], []];
  let wasCompressed = false;

  if (isCompressionWorthwhile) {
    console.log(`\n⚙️  APPLYING SVD COMPRESSION...`);
    // Perform SVD compression
    for (let ch = 0; ch < 3; ch++) {
      const channelName = ['Red', 'Green', 'Blue'][ch];
      const M   = new Matrix(channelArrays[ch]);

      // Full SVD:  M = U · diag(s) · Vᵀ
      const svd = new SVD(M, { autoTranspose: true });

      const U = svd.leftSingularVectors;   // height × rank
      const s = svd.diagonal;              // Array of singular values (descending)
      const V = svd.rightSingularVectors;  // width  × rank

      allSingularValues[ch] = [...s];

      // Energy calculation
      const totalE = s.reduce((acc, v) => acc + v * v, 0);
      const kE = s.slice(0, kActual).reduce((acc, v) => acc + v * v, 0);
      const energyPct = totalE > 0 ? (kE / totalE) * 100 : 100;

      console.log(`   ${channelName} channel: σ top values = [${s.slice(0, 5).map(x => x.toFixed(2)).join(', ')}...] | Energy: ${energyPct.toFixed(2)}%`);

      // Rank-k approximation: Mₖ = Uₖ · diag(sₖ) · Vₖᵀ
      const Uk   = U.subMatrix(0, height - 1, 0, kActual - 1);
      const Sk   = Matrix.diag(s.slice(0, kActual));
      const Vk   = V.subMatrix(0, width  - 1, 0, kActual - 1);

      const Mk   = Uk.mmul(Sk).mmul(Vk.transpose());
      reconstructedChannels.push(Mk);
    }
    console.log(`✓ SVD decomposition complete`);
    wasCompressed = true;
  } else {
    console.log(`\n⏭️  SKIPPING COMPRESSION - using original pixels`);
    // Fallback: use original pixels (no compression)
    for (let ch = 0; ch < 3; ch++) {
      const M = new Matrix(channelArrays[ch]);
      reconstructedChannels.push(M);
      // For display purposes, keep a dummy singular values array
      allSingularValues[ch] = new Array(Math.min(height, width)).fill(0);
    }
  }

  // ─── 4. Build reconstructed pixel buffer ─────────────────────────────────
  const reconPixels = Buffer.alloc(pixelCount * 3);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const outIdx = (r * width + c) * 3;
      for (let ch = 0; ch < 3; ch++) {
        reconPixels[outIdx + ch] = Math.round(
          Math.max(0, Math.min(255, reconstructedChannels[ch].get(r, c)))
        );
      }
    }
  }

  // ─── 5. Encode both images as PNG for the browser ─────────────────────────
  const [originalPng, reconstructedPng] = await Promise.all([
    pipeline.clone().png().toBuffer(),
    sharp(reconPixels, { raw: { width, height, channels: 3 } }).png().toBuffer()
  ]);

  // ─── 6. Size accounting ───────────────────────────────────────────────────
  // (rawBytes already calculated above for compression check)

  // Actual sizes based on whether compression was used
  let actualSvdBytes = wasCompressed 
    ? 3 * (height * kActual + kActual + width * kActual) * 4
    : rawBytes;

  // Spectral energy captured by rank-k (using green channel as representative)
  const s       = allSingularValues[1];
  const totalE  = s.reduce((acc, v) => acc + v * v, 0);
  const kE      = wasCompressed ? s.slice(0, kActual).reduce((acc, v) => acc + v * v, 0) : totalE;
  const energyPct = totalE > 0 ? (kE / totalE) * 100 : 100;

  console.log(`\n📈 FINAL RESULTS:`);
  console.log(`   Raw pixel data: ${(rawBytes / 1024).toFixed(2)} KB`);
  console.log(`   SVD representation: ${(actualSvdBytes / 1024).toFixed(2)} KB`);
  console.log(`   Ratio: ${(actualSvdBytes / rawBytes * 100).toFixed(1)}%`);
  if (wasCompressed) {
    console.log(`   💾 Savings: ${((1 - actualSvdBytes / rawBytes) * 100).toFixed(1)}%`);
    console.log(`   Energy captured: ${energyPct.toFixed(2)}%`);
  } else {
    console.log(`   (original preserved)`);
  }

  console.log(`\n✅ COMPRESSION COMPLETE`);
  console.log('='.repeat(70) + '\n');

  return {
    originalPng,
    reconstructedPng,
    originalRawPixels : rawPixels,
    reconPixels,
    originalFileBytes : inputBuffer.length,
    originalPngBytes  : originalPng.length,
    rawBytes,
    svdBytes          : actualSvdBytes,
    reconPngBytes     : reconstructedPng.length,
    width,
    height,
    kActual           : wasCompressed ? kActual : maxRank,
    maxRank,
    wasResized,
    wasCompressed,
    compressionRatio  : (actualSvdBytes / rawBytes).toFixed(3),
    energyPct,
    singularValues    : allSingularValues[1].slice(0, 80), // green channel, first 80
    allSingularValues,
  };
}

module.exports = { compressImage };
