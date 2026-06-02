/**
 * Test Suite for WiSense Signal Processing Engine (dsp/filters.js)
 */

const { BandpassFilter, calculateBPM, calculateSignalVariance } = require('../dsp/filters');

describe('WiSense DSP Filtering and Vital Estimations', () => {
  
  test('BandpassFilter should construct with correct frequencies', () => {
    // 10 Hz sampling rate, breathing cutoff 0.1Hz - 0.5Hz
    const filter = new BandpassFilter(0.1, 0.5, 10);
    
    expect(filter.b0).toBeDefined();
    expect(filter.a1).toBeDefined();
    expect(filter.x1).toBe(0);
    expect(filter.y1).toBe(0);
  });

  test('BandpassFilter should process samples and modify amplitude output', () => {
    const filter = new BandpassFilter(0.1, 0.5, 10);
    
    // Feed sine wave at 0.25 Hz (inside band) vs 2.5 Hz (outside band)
    const samplesIn = Array.from({ length: 50 }, (_, i) => Math.sin(2 * Math.PI * 0.25 * (i / 10)));
    const samplesOut = Array.from({ length: 50 }, (_, i) => Math.sin(2 * Math.PI * 2.5 * (i / 10)));
    
    const outFiltered = samplesIn.map(s => filter.process(s));
    
    filter.reset();
    const noiseFiltered = samplesOut.map(s => filter.process(s));
    
    // Variance of the in-band signal should be significantly higher than the attenuated noise
    const varIn = calculateSignalVariance(outFiltered);
    const varOut = calculateSignalVariance(noiseFiltered);
    
    expect(varIn).toBeGreaterThan(varOut);
  });

  test('calculateBPM should estimate breathing rate accurately from sine wave', () => {
    // A pure 0.25 Hz sine wave has 15 cycles per minute (15 BPM)
    const fs = 10;
    const duration = 20; // 20 seconds buffer
    const buffer = Array.from({ length: fs * duration }, (_, i) => Math.sin(2 * Math.PI * 0.25 * (i / fs)));
    
    const bpm = calculateBPM(buffer, fs, 8, 24);
    
    // Expect BPM close to 15 (with a tolerance of 1.5 BPM due to zero crossings discretization)
    expect(bpm).toBeGreaterThanOrEqual(13.5);
    expect(bpm).toBeLessThanOrEqual(16.5);
  });

  test('calculateSignalVariance should calculate statistics correctly', () => {
    const data = [1, 2, 3, 4, 5]; // mean = 3, squared diffs from 3: [4, 1, 0, 1, 4] -> sum = 10 -> var = 2
    const variance = calculateSignalVariance(data);
    expect(variance).toBe(2);
  });
});
