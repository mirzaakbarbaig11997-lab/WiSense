/**
 * Digital Signal Processing Filters for WiSense
 * Provides real-time filtering for human vital extraction (breathing and heart rate)
 * using IIR Butterworth Bandpass structures.
 */

class BandpassFilter {
  constructor(lowCutoff, highCutoff, sampleRate, order = 2) {
    this.lowCutoff = lowCutoff;
    this.highCutoff = highCutoff;
    this.sampleRate = sampleRate;
    this.order = order;
    
    // Design coefficients for a 2nd order Butterworth bandpass
    this.calculateCoefficients();
    this.reset();
  }

  calculateCoefficients() {
    // Bilinear transform design of Butterworth bandpass filter
    const wcL = 2 * Math.PI * this.lowCutoff / this.sampleRate;
    const wcH = 2 * Math.PI * this.highCutoff / this.sampleRate;
    
    // Pre-warped frequencies
    const wL = 2 * Math.tan(wcL / 2);
    const wH = 2 * Math.tan(wcH / 2);
    
    const bw = wH - wL;
    const w0 = Math.sqrt(wL * wH);
    
    // Normalized Butterworth design for bandpass:
    // H(s) = s*bw / (s^2 + s*bw + w0^2)
    // S-to-Z transformation: s = 2 * (z - 1) / (z + 1)
    const c = 4 + 2 * bw + w0 * w0;
    
    this.b0 = bw * 2 / c;
    this.b1 = 0;
    this.b2 = -bw * 2 / c;
    
    this.a1 = (2 * w0 * w0 - 8) / c;
    this.a2 = (4 - 2 * bw + w0 * w0) / c;
  }

  reset() {
    this.x1 = 0;
    this.x2 = 0;
    this.y1 = 0;
    this.y2 = 0;
  }

  /**
   * Processes a single input sample and returns the filtered sample.
   */
  process(sample) {
    const output = (this.b0 * sample) + (this.b1 * this.x1) + (this.b2 * this.x2) 
                   - (this.a1 * this.y1) - (this.a2 * this.y2);
    
    // Shift states
    this.x2 = this.x1;
    this.x1 = sample;
    this.y2 = this.y1;
    this.y1 = output;
    
    return output;
  }
}

/**
 * Calculates zero-crossing rates in BPM for a given signal buffer.
 */
function calculateBPM(buffer, sampleRate, minBPM, maxBPM) {
  if (buffer.length < sampleRate * 2) return 0; // Need at least 2 seconds
  
  // Detrend/center buffer around zero
  const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
  const centered = buffer.map(v => v - mean);
  
  let crossings = 0;
  let prevVal = centered[0];
  
  for (let i = 1; i < centered.length; i++) {
    const val = centered[i];
    if ((prevVal < 0 && val >= 0) || (prevVal > 0 && val <= 0)) {
      crossings++;
    }
    prevVal = val;
  }
  
  const durationSeconds = buffer.length / sampleRate;
  // Two crossings per full cycle (sine wave crosses 0 twice per period)
  const frequencyHz = (crossings / 2) / durationSeconds;
  const bpm = frequencyHz * 60;
  
  if (bpm >= minBPM && bpm <= maxBPM) {
    return Math.round(bpm * 10) / 10;
  }
  
  // Return a sensible default or average if outside bounds
  return 0;
}

/**
 * Calculates signal standard deviation / variance for motion detection
 */
function calculateSignalVariance(buffer) {
  if (buffer.length === 0) return 0;
  const mean = buffer.reduce((a, b) => a + b, 0) / buffer.length;
  const sqDiffs = buffer.map(v => Math.pow(v - mean, 2));
  return sqDiffs.reduce((a, b) => a + b, 0) / buffer.length;
}

module.exports = {
  BandpassFilter,
  calculateBPM,
  calculateSignalVariance
};
