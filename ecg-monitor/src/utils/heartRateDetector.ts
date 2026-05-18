/**
 * Pan-Tompkins QRS Detection Algorithm
 *
 * Implements the classic Pan & Tompkins (1985) algorithm for ECG R-peak detection
 * and heart rate calculation. All signal processing stages are implemented from
 * scratch without external filter libraries.
 *
 * Pipeline:
 *   Raw ECG → Bandpass (5-15 Hz) → Derivative → Squaring → Integration → Detection
 *
 * Reference:
 *   J. Pan and W. J. Tompkins, "A Real-Time QRS Detection Algorithm,"
 *   IEEE Trans. Biomed. Eng., vol. BME-32, no. 3, pp. 230-236, March 1985.
 */

// ─── Constants ──────────────────────────────────────────────────

/** Minimum valid heart rate (BPM) */
const HR_MIN = 30;

/** Maximum valid heart rate (BPM) */
const HR_MAX = 220;

/** Refractory period after QRS detection (ms) — no new QRS within this window */
const REFRACTORY_PERIOD_MS = 200;

/** Minimum RR interval for T-wave identification threshold (ms) */
const T_WAVE_RR_THRESHOLD_MS = 360;

/** Searchback trigger: if no QRS in this fraction of average RR, search back */
const SEARCHBACK_RR_FRACTION = 1.66;

/**
 * Minimum number of samples required for a meaningful detection.
 * We need at least 2 seconds of data to reliably find 2+ QRS complexes.
 */
const MIN_SAMPLES_SECONDS = 2;

// ─── Internal Types ─────────────────────────────────────────────

/** Adaptive threshold state maintained across detection windows */
interface ThresholdState {
  /** Signal peak estimate (SPKI) */
  spki: number;
  /** Noise peak estimate (NPKI) */
  npki: number;
  /** Threshold I (for signal-level peaks) */
  thresholdI: number;
  /** Threshold II (for noise-level peaks) */
  thresholdII: number;
}

/** A detected QRS complex */
interface QRSDetection {
  /** Sample index in the integrated signal */
  index: number;
  /** Peak value in the integrated signal */
  value: number;
  /** Slope (max derivative value near this peak) */
  slope: number;
}

// ─── Signal Processing Stages ───────────────────────────────────

/**
 * Stage 1: Bandpass Filter (5-15 Hz)
 *
 * Cascaded second-order low-pass and high-pass IIR filters.
 * The combined passband is approximately 5-15 Hz.
 *
 * Low-pass:  H(z) = (1 - z^-6)^2 / (1 - z^-1)^2
 *            y[n] = 2y[n-1] - y[n-2] + x[n] - 2x[n-6] + x[n-12]
 *
 * High-pass: H(z) = (-1/32 + z^-16 + z^-17 - (1/32)z^-32) / (1 - z^-1) -- wait, let me reconsider
 * Actually from the paper: high-pass implemented via low-pass subtraction
 *            y[n] = x[n - 16] - (1/32) * [y_lp[n]]
 *   where y_lp[n] = y_lp[n-1] + x[n] - x[n-32]
 *
 * @param data Raw ECG samples
 * @returns Bandpassed signal
 */
function bandpassFilter(data: number[]): number[] {
  const n = data.length;
  if (n === 0) return [];

  // --- Low-pass filter ---
  // Transfer function: H(z) = (1 - z^-6)^2 / (1 - z^-1)^2
  // Difference equation: y[n] = 2y[n-1] - y[n-2] + x[n] - 2x[n-6] + x[n-12]
  const lp = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x_n = data[i];
    const x_n6 = i >= 6 ? data[i - 6] : 0;
    const x_n12 = i >= 12 ? data[i - 12] : 0;
    const y_n1 = i >= 1 ? lp[i - 1] : 0;
    const y_n2 = i >= 2 ? lp[i - 2] : 0;
    lp[i] = 2 * y_n1 - y_n2 + x_n - 2 * x_n6 + x_n12;
  }

  // Normalize low-pass output (gain compensation)
  // The low-pass filter has a DC gain of 36, divide to normalize
  for (let i = 0; i < n; i++) {
    lp[i] /= 36;
  }

  // --- High-pass filter ---
  // Implemented as: y[n] = x[n - 16] - (1/32) * sum(x[n-32..n-1])
  // This is the standard high-pass via moving-average subtraction
  const hp = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const delayed = i >= 16 ? lp[i - 16] : 0;
    let sum = 0;
    const start = Math.max(0, i - 32);
    for (let j = start; j < i; j++) {
      sum += lp[j];
    }
    // Only compute when we have enough history
    if (i >= 32) {
      hp[i] = delayed - sum / 32;
    } else {
      hp[i] = delayed; // ramp-up: no filtering yet
    }
  }

  return Array.from(hp);
}

/**
 * Stage 2: Five-point Derivative
 *
 * Approximates the first derivative of the signal:
 *   y[n] = (1/8) * (-x[n-2] - 2*x[n-1] + 2*x[n+1] + x[n+2])
 *
 * This emphasizes the steep slopes of the QRS complex.
 *
 * @param data Bandpassed signal
 * @returns Derivative signal
 */
function derivative(data: number[]): number[] {
  const n = data.length;
  if (n < 5) return new Array(n).fill(0);

  const result = new Array<number>(n).fill(0);
  for (let i = 2; i < n - 2; i++) {
    result[i] = (-data[i - 2] - 2 * data[i - 1] + 2 * data[i + 1] + data[i + 2]) / 8;
  }
  return result;
}

/**
 * Stage 3: Squaring
 *
 * y[n] = x[n]^2
 *
 * Makes all values positive and amplifies the QRS contribution
 * relative to T-waves and noise (non-linear amplification).
 *
 * @param data Derivative signal
 * @returns Squared signal
 */
function squaring(data: number[]): number[] {
  const n = data.length;
  const result = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    result[i] = data[i] * data[i];
  }
  return result;
}

/**
 * Stage 4: Moving Window Integration
 *
 * y[n] = (1/N) * sum(x[n-k] for k=0..N-1)
 *
 * Window size N = 150ms * sampleRate (rounded to nearest integer).
 * Provides information about both the slope and width of the QRS complex.
 *
 * @param data Squared signal
 * @param windowSize Integration window size in samples
 * @returns Integrated signal
 */
function movingWindowIntegrator(data: number[], windowSize: number): number[] {
  const n = data.length;
  if (n === 0) return [];

  const result = new Array<number>(n).fill(0);
  let windowSum = 0;

  for (let i = 0; i < n; i++) {
    windowSum += data[i];
    // Remove element that fell out of the window
    if (i >= windowSize) {
      windowSum -= data[i - windowSize];
    }
    // Window size grows until it reaches the target
    const currentWindowSize = Math.min(i + 1, windowSize);
    result[i] = windowSum / currentWindowSize;
  }

  return result;
}

// ─── QRS Detection Engine ───────────────────────────────────────

/**
 * Initialize adaptive threshold state from initial signal statistics.
 */
function initializeThresholds(integrated: number[], sampleRate: number): ThresholdState {
  // Use the first 2 seconds to estimate initial thresholds
  const initLength = Math.min(integrated.length, 2 * sampleRate);
  let peakSum = 0;
  let peakCount = 0;

  for (let i = 1; i < initLength - 1; i++) {
    if (integrated[i] > integrated[i - 1] && integrated[i] > integrated[i + 1]) {
      peakSum += integrated[i];
      peakCount++;
    }
  }

  const avgPeak = peakCount > 0 ? peakSum / peakCount : 0;
  // Initial estimates: signal peak = 1/3 of average peak, noise = 1/2 of that
  const spki = avgPeak * 0.33;
  const npki = avgPeak * 0.1;
  const thresholdI = npki + 0.25 * (spki - npki);
  const thresholdII = 0.5 * thresholdI;

  return { spki, npki, thresholdI, thresholdII };
}

/**
 * Find the maximum derivative (slope) near a given index in the derivative signal.
 * Used for T-wave identification.
 */
function findMaxSlope(derivativeData: number[], center: number, radius: number): number {
  let maxSlope = 0;
  const start = Math.max(0, center - radius);
  const end = Math.min(derivativeData.length - 1, center + radius);
  for (let i = start; i <= end; i++) {
    const abs = Math.abs(derivativeData[i]);
    if (abs > maxSlope) maxSlope = abs;
  }
  return maxSlope;
}

/**
 * Main QRS detection loop with adaptive thresholding, searchback, and T-wave logic.
 *
 * @param integrated Integrated signal
 * @param derivativeSignal Derivative signal (for slope-based T-wave discrimination)
 * @param sampleRate Sampling rate in Hz
 * @returns Array of detected QRS indices in the integrated signal
 */
function detectQRS(
  integrated: number[],
  derivativeSignal: number[],
  sampleRate: number,
): number[] {
  const n = integrated.length;
  if (n < sampleRate) return [];

  const refractorySamples = Math.floor((REFRACTORY_PERIOD_MS * sampleRate) / 1000);
  const tWaveRRSamples = Math.floor((T_WAVE_RR_THRESHOLD_MS * sampleRate) / 1000);

  const thresholds = initializeThresholds(integrated, sampleRate);
  let { spki, npki, thresholdI, thresholdII } = thresholds;

  const qrsLocations: QRSDetection[] = [];
  const rrIntervals: number[] = [];
  let lastQRSIndex = -refractorySamples;

  // Phase 1: Linear scan through the signal
  let i = refractorySamples;
  while (i < n) {
    // Find the local maximum within a search window
    const searchEnd = Math.min(n, i + Math.floor(sampleRate * 0.1));
    let maxVal = -Infinity;
    let maxIdx = i;
    for (let j = i; j < searchEnd; j++) {
      if (integrated[j] > maxVal) {
        maxVal = integrated[j];
        maxIdx = j;
      }
    }

    // Check refractory period
    if (maxIdx - lastQRSIndex < refractorySamples) {
      i = maxIdx + refractorySamples;
      continue;
    }

    // Find slope at this peak
    const slope = findMaxSlope(derivativeSignal, maxIdx, Math.floor(sampleRate * 0.04));

    if (maxVal > thresholdI) {
      // --- T-wave identification ---
      // If RR interval is short and slope is small compared to previous QRS,
      // classify as T-wave (not QRS)
      let isTWave = false;
      if (qrsLocations.length > 0 && (maxIdx - lastQRSIndex) < tWaveRRSamples) {
        const prevSlope = qrsLocations[qrsLocations.length - 1].slope;
        if (slope < 0.5 * prevSlope) {
          isTWave = true;
        }
      }

      if (!isTWave) {
        // Confirmed QRS
        const detection: QRSDetection = { index: maxIdx, value: maxVal, slope };
        qrsLocations.push(detection);

        // Update RR intervals
        if (qrsLocations.length >= 2) {
          const rr = maxIdx - lastQRSIndex;
          rrIntervals.push(rr);
        }

        // Update signal threshold
        spki = 0.125 * maxVal + 0.875 * spki;
        lastQRSIndex = maxIdx;
      } else {
        // T-wave: treat as noise
        npki = 0.125 * maxVal + 0.875 * npki;
      }
    } else if (maxVal > thresholdII) {
      // Between thresholds: might be noise, might be missed QRS
      // Check if searchback is warranted
      if (rrIntervals.length >= 2) {
        const avgRR = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
        const searchbackLimit = avgRR * SEARCHBACK_RR_FRACTION;

        if (maxIdx - lastQRSIndex > searchbackLimit) {
          // Searchback: look for a peak between thresholds in the missed region
          const searchStart = lastQRSIndex + refractorySamples;
          const searchRegionEnd = maxIdx;

          let sbMaxVal = -Infinity;
          let sbMaxIdx = searchStart;

          for (let k = searchStart; k < searchRegionEnd; k++) {
            if (integrated[k] > sbMaxVal) {
              sbMaxVal = integrated[k];
              sbMaxIdx = k;
            }
          }

          // Use lower thresholds for searchback
          const lowerThresholdI = thresholdII; // Use threshold II as the lower bar
          if (sbMaxVal > lowerThresholdI && sbMaxVal > npki) {
            const sbSlope = findMaxSlope(derivativeSignal, sbMaxIdx, Math.floor(sampleRate * 0.04));

            // T-wave check for searchback peak too
            let sbIsTWave = false;
            if (qrsLocations.length > 0 && (sbMaxIdx - lastQRSIndex) < tWaveRRSamples) {
              const prevSlope = qrsLocations[qrsLocations.length - 1].slope;
              if (sbSlope < 0.5 * prevSlope) {
                sbIsTWave = true;
              }
            }

            if (!sbIsTWave) {
              const sbDetection: QRSDetection = {
                index: sbMaxIdx,
                value: sbMaxVal,
                slope: sbSlope,
              };
              qrsLocations.push(sbDetection);

              if (qrsLocations.length >= 2) {
                rrIntervals.push(sbMaxIdx - lastQRSIndex);
              }

              spki = 0.125 * sbMaxVal + 0.875 * spki;
              lastQRSIndex = sbMaxIdx;
            } else {
              npki = 0.125 * sbMaxVal + 0.875 * npki;
            }
          }
        }
      }

      // Still below thresholdI: classify as noise
      npki = 0.125 * maxVal + 0.875 * npki;
    } else {
      // Below both thresholds: definite noise
      npki = 0.125 * maxVal + 0.875 * npki;
    }

    // Recalculate thresholds
    thresholdI = npki + 0.25 * (spki - npki);
    thresholdII = 0.5 * thresholdI;

    // Advance past refractory period
    i = lastQRSIndex + refractorySamples;
    if (i <= maxIdx) i = maxIdx + 1;
  }

  return qrsLocations.map((q) => q.index);
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Detect heart rate from ECG data using the Pan-Tompkins algorithm.
 *
 * Processes raw ECG samples through the full Pan-Tompkins pipeline:
 * bandpass → derivative → squaring → integration → adaptive threshold detection.
 *
 * @param data Array of raw ECG amplitude samples (e.g. Lead II)
 * @param sampleRate Sampling rate in Hz (e.g. 250)
 * @returns Heart rate in BPM (30-220), or null if detection fails
 *          (insufficient data, no QRS found, or computed rate out of range)
 */
export function detectHeartRate(data: number[], sampleRate: number): number | null {
  // ── Input validation ──────────────────────────────────────
  if (!data || data.length === 0) return null;
  if (!sampleRate || sampleRate <= 0) return null;

  const minSamples = Math.floor(MIN_SAMPLES_SECONDS * sampleRate);
  if (data.length < minSamples) return null;

  // Check for all-zero or constant data (no signal)
  let allSame = true;
  const first = data[0];
  for (let i = 1; i < data.length; i++) {
    if (data[i] !== first) {
      allSame = false;
      break;
    }
  }
  if (allSame) return null;

  // ── Stage 1: Bandpass filter (5-15 Hz) ────────────────────
  const filtered = bandpassFilter(data);

  // ── Stage 2: Five-point derivative ────────────────────────
  const deriv = derivative(filtered);

  // ── Stage 3: Squaring ─────────────────────────────────────
  const squared = squaring(deriv);

  // ── Stage 4: Moving window integration (150ms) ────────────
  const windowSize = Math.max(1, Math.round(0.15 * sampleRate));
  const integrated = movingWindowIntegrator(squared, windowSize);

  // ── Stage 5: QRS detection ────────────────────────────────
  const qrsIndices = detectQRS(integrated, deriv, sampleRate);

  if (qrsIndices.length < 2) return null;

  // ── Stage 6: Compute heart rate from RR intervals ─────────
  let totalRR = 0;
  for (let i = 1; i < qrsIndices.length; i++) {
    totalRR += qrsIndices[i] - qrsIndices[i - 1];
  }
  const avgRRSamples = totalRR / (qrsIndices.length - 1);

  // Convert to BPM: heart_rate = 60 * sampleRate / avgRR_in_samples
  const bpm = Math.round((60 * sampleRate) / avgRRSamples);

  // ── Validation ────────────────────────────────────────────
  if (bpm < HR_MIN || bpm > HR_MAX) return null;

  return bpm;
}
