/**
 * Image Quality Metrics
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ PSNR (Peak Signal-to-Noise Ratio)                                    │
 * │   MSE  = (1/N) Σ (xᵢ − x̂ᵢ)²                                        │
 * │   PSNR = 10 · log₁₀(MAX² / MSE)   where MAX = 255                   │
 * │                                                                      │
 * │   Interpretation (higher = better):                                  │
 * │   > 40 dB  — Visually lossless                                       │
 * │   30–40 dB — Good quality, minor artefacts                           │
 * │   20–30 dB — Visible degradation                                     │
 * │   < 20 dB  — Severe degradation                                      │
 * ├──────────────────────────────────────────────────────────────────────┤
 * │ SSIM (Structural Similarity Index)  [Wang et al. 2004]               │
 * │                                                                      │
 * │   SSIM(x, y) = [l(x,y)]·[c(x,y)]·[s(x,y)]                         │
 * │                                                                      │
 * │   l(x,y) = (2μₓμᵧ + C₁) / (μₓ² + μᵧ² + C₁)      luminance         │
 * │   c(x,y) = (2σₓσᵧ + C₂) / (σₓ² + σᵧ² + C₂)      contrast          │
 * │   s(x,y) = (σₓᵧ + C₃) / (σₓσᵧ + C₃)             structure         │
 * │                                                                      │
 * │   Combined (C₃ = C₂/2):                                             │
 * │   SSIM = (2μₓμᵧ + C₁)(2σₓᵧ + C₂)                                  │
 * │          ─────────────────────────────                              │
 * │          (μₓ²+μᵧ²+C₁)(σₓ²+σᵧ²+C₂)                                │
 * │                                                                      │
 * │   C₁ = (k₁·L)²,  C₂ = (k₂·L)²,  L=255, k₁=0.01, k₂=0.03         │
 * │   Computed on 8×8 local windows, then averaged.                     │
 * │                                                                      │
 * │   Range: [−1, 1]  — 1 = perfect match                               │
 * └──────────────────────────────────────────────────────────────────────┘
 */

'use strict';

const C1 = (0.01 * 255) ** 2;   // ≈ 6.5025
const C2 = (0.03 * 255) ** 2;   // ≈ 58.5225

/**
 * Convert RGB triplet to luminance (ITU-R BT.601).
 *   Y = 0.299·R + 0.587·G + 0.114·B
 */
function toLuminance(buf, idx) {
  return 0.299 * buf[idx] + 0.587 * buf[idx + 1] + 0.114 * buf[idx + 2];
}

/**
 * PSNR computed over all three channels.
 *
 * @param {Buffer} original      - Original uint8 RGB pixels (interleaved)
 * @param {Buffer} reconstructed - Reconstructed uint8 RGB pixels
 * @param {number} pixelCount    - width × height
 * @returns {{ psnr: number, mse: number }}
 */
function computePSNR(original, reconstructed, pixelCount) {
  let mse = 0;
  const N = pixelCount * 3;
  for (let i = 0; i < N; i++) {
    const diff = original[i] - reconstructed[i];
    mse += diff * diff;
  }
  mse /= N;

  const psnr = mse === 0 ? Infinity : 10 * Math.log10(255 * 255 / mse);
  return { psnr, mse };
}

/**
 * SSIM computed on luminance channel using non-overlapping 8×8 blocks.
 * Local statistics per block → per-block SSIM → mean over all blocks.
 *
 * @param {Buffer} original      - Original uint8 RGB pixels
 * @param {Buffer} reconstructed - Reconstructed uint8 RGB pixels
 * @param {number} width
 * @param {number} height
 * @returns {number} Mean SSIM ∈ [−1, 1]
 */
function computeSSIM(original, reconstructed, width, height) {
  const BLOCK = 8;
  let ssimSum   = 0;
  let blockCount = 0;

  for (let by = 0; by + BLOCK <= height; by += BLOCK) {
    for (let bx = 0; bx + BLOCK <= width; bx += BLOCK) {
      let sumX  = 0, sumY  = 0;
      let sumX2 = 0, sumY2 = 0;
      let sumXY = 0;
      const n = BLOCK * BLOCK;

      for (let dy = 0; dy < BLOCK; dy++) {
        for (let dx = 0; dx < BLOCK; dx++) {
          const idx = ((by + dy) * width + (bx + dx)) * 3;
          const x   = toLuminance(original,       idx);
          const y   = toLuminance(reconstructed,  idx);
          sumX  += x;
          sumY  += y;
          sumX2 += x * x;
          sumY2 += y * y;
          sumXY += x * y;
        }
      }

      const μx   = sumX  / n;
      const μy   = sumY  / n;
      const σx2  = sumX2 / n - μx * μx;   // biased variance (standard for SSIM)
      const σy2  = sumY2 / n - μy * μy;
      const σxy  = sumXY / n - μx * μy;

      const ssim = ((2 * μx * μy + C1) * (2 * σxy + C2)) /
                   ((μx * μx + μy * μy + C1) * (σx2 + σy2 + C2));

      ssimSum += ssim;
      blockCount++;
    }
  }

  return blockCount > 0 ? ssimSum / blockCount : 1.0;
}

/**
 * Compute all quality metrics.
 *
 * @param {Buffer} original       - Original uint8 RGB pixels
 * @param {Buffer} reconstructed  - Reconstructed uint8 RGB pixels
 * @param {number} width
 * @param {number} height
 * @returns {{ psnr: number, ssim: number, mse: number }}
 */
function computeMetrics(original, reconstructed, width, height) {
  const pixelCount = width * height;
  const { psnr, mse } = computePSNR(original, reconstructed, pixelCount);
  const ssim          = computeSSIM(original, reconstructed, width, height);
  return { psnr, ssim, mse };
}

module.exports = { computeMetrics };
