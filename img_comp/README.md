# SVD Image Compressor

Smart image compression using **Singular Value Decomposition (SVD)** — the
mathematically optimal low-rank matrix approximation (Eckart–Young theorem).

## Quick start

```bash
npm install
npm start
# open http://localhost:3000
```

---

## Mathematics

### SVD Factorisation

For an image channel represented as an **m × n** matrix **A** (pixels, 0–255):

```
A  =  U · Σ · Vᵀ
```

| Factor | Shape   | Meaning                              |
|--------|---------|--------------------------------------|
| **U**  | m × m   | Left singular vectors (row features) |
| **Σ**  | m × n   | Diagonal — singular values σ₁ ≥ σ₂ ≥ … ≥ 0 |
| **Vᵀ** | n × n   | Right singular vectors (column features) |

### Rank-k Approximation

Keep only the **k largest** singular values:

```
Aₖ  =  Uₖ · Σₖ · Vₖᵀ
```

By the **Eckart–Young theorem**, this is the best rank-k approximation of A
under both the Frobenius norm and the spectral norm:

```
Aₖ = argmin   ‖A − B‖F       subject to  rank(B) ≤ k
       B
```

### Storage Comparison

| Format          | Bytes                          |
|-----------------|--------------------------------|
| Raw pixels (uint8)  | m · n · 3                  |
| SVD representation (float32) | k · (m + 1 + n) · 3 · 4 |

Break-even point: `k < m·n / (4·(m+n+1))`  
For a 300 × 300 image: break-even at **k ≈ 18** (6% of max rank 300).

### Energy Retention

Fraction of signal "energy" captured by rank-k:

```
E(k) = Σᵢ₌₁ᵏ σᵢ² / Σᵢ σᵢ²
```

Natural images have rapidly decaying singular values, so even 10% of the
rank captures >99% of the energy.

---

## Quality Metrics

### PSNR (Peak Signal-to-Noise Ratio)

```
MSE  = (1/N) Σ (xᵢ − x̂ᵢ)²
PSNR = 10 · log₁₀(255² / MSE)   [dB]
```

| PSNR       | Quality             |
|------------|---------------------|
| > 40 dB    | Visually lossless   |
| 35–40 dB   | Very good           |
| 30–35 dB   | Good                |
| 25–30 dB   | Moderate            |
| < 25 dB    | Significant loss    |

### SSIM (Structural Similarity Index — Wang et al. 2004)

Computed on 8×8 luminance windows:

```
SSIM(x,y) = (2μₓμᵧ + C₁)(2σₓᵧ + C₂)
            ─────────────────────────────
            (μₓ²+μᵧ²+C₁)(σₓ²+σᵧ²+C₂)

C₁ = (0.01·255)² ≈ 6.50
C₂ = (0.03·255)² ≈ 58.52
```

Range: **[−1, 1]** — value of 1 means structurally identical.

---

## Project structure

```
image-compressor/
├── server.js              Express server + /compress endpoint
├── src/
│   ├── svdCompressor.js   SVD logic (uses ml-matrix)
│   └── metrics.js         PSNR + SSIM implementations
└── public/
    └── index.html         Single-page frontend
```

## Dependencies

| Package     | Role                            |
|-------------|---------------------------------|
| express     | HTTP server                     |
| multer      | Multipart file upload           |
| sharp       | Fast image I/O (libjpeg/libvips) |
| ml-matrix   | SVD and matrix algebra          |
