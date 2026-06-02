/**
 * Integration Tests for WiSense Occupancy Classifications (dsp/occupancy.js)
 */

const { OccupancyDetector } = require('../dsp/occupancy');

describe('WiSense Occupancy Decision System', () => {
  let detector;

  beforeEach(() => {
    detector = new OccupancyDetector({
      presence_threshold: 0.15,
      fall_acceleration_threshold: 2.5
    });
  });

  test('should classify active room when variance exceeds thresholds', () => {
    // High phase variance indicates movement
    const metrics = {
      phaseVariance: 0.6,
      breathingBpm: 0,
      heartBpm: 0,
      acceleration: 0.2
    };

    const result = detector.classifyState(metrics);
    expect(result.state).toBe('room-active');
    expect(result.confidence).toBeGreaterThan(0.2);
  });

  test('should classify sleep state when stationary but vitals present', () => {
    // Low variance but valid vitals
    const metrics = {
      phaseVariance: 0.1,
      breathingBpm: 14.5,
      heartBpm: 72.0,
      acceleration: 0.1
    };

    const result = detector.classifyState(metrics);
    expect(result.state).toBe('someone-sleeping');
    expect(result.confidence).toBe(0.88);
  });

  test('should trigger fall alert on high acceleration spike', () => {
    // Two sequential spikes of high acceleration triggers a fall state
    const spike = {
      phaseVariance: 0.8,
      breathingBpm: 0,
      heartBpm: 0,
      acceleration: 3.5 // exceeds threshold 2.5
    };

    // First frame: increases debounce
    let result = detector.classifyState(spike);
    
    // Second frame: triggers fall
    result = detector.classifyState(spike);
    
    expect(result.state).toBe('fall-risk-elevated');
    expect(result.alert).toBe(true);
  });

  test('should classify no-movement if phase is completely calm', () => {
    const metrics = {
      phaseVariance: 0.005,
      breathingBpm: 0,
      heartBpm: 0,
      acceleration: 0.05
    };

    const result = detector.classifyState(metrics);
    expect(result.state).toBe('no-movement');
  });
});
