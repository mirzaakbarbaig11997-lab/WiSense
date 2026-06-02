/**
 * WiSense Occupancy and State Inference Engine
 * Classifies rooms and zones based on real-time signal metrics
 */

class OccupancyDetector {
  constructor(config = {}) {
    this.varianceThreshold = config.presence_threshold || 0.15;
    this.fallThreshold = config.fall_acceleration_threshold || 2.5;
    
    // Historic values to track sudden transitions
    this.stateHistory = [];
    this.fallDebounceFrames = 0;
    this.fallCooldownFrames = 0;
  }

  /**
   * Evaluates the latest signal metrics and outputs a semantic room state
   * @param {Object} metrics - { rssi, phaseVariance, breathingBpm, heartBpm, acceleration }
   * @returns {Object} { state: string, confidence: number }
   */
  classifyState(metrics) {
    const { phaseVariance, breathingBpm, heartBpm, acceleration } = metrics;
    
    // Handle fall cooldowns
    if (this.fallCooldownFrames > 0) {
      this.fallCooldownFrames--;
    }

    // 1. Fall detection (High priority: sudden high acceleration/variance spike)
    if (acceleration > this.fallThreshold && this.fallCooldownFrames === 0) {
      this.fallDebounceFrames++;
      if (this.fallDebounceFrames >= 2) { // 2 consecutive frames of extreme disturbance
        this.fallDebounceFrames = 0;
        this.fallCooldownFrames = 15; // Cooldown for 15 evaluations
        return { state: 'fall-risk-elevated', confidence: 0.92, alert: true };
      }
    } else {
      this.fallDebounceFrames = Math.max(0, this.fallDebounceFrames - 1);
    }

    // 2. High movement / Active Room
    if (phaseVariance > this.varianceThreshold * 3) {
      return { state: 'room-active', confidence: Math.min(0.99, phaseVariance * 0.4) };
    }

    // 3. Low movement, Vitals present (Sleeping or stationary user)
    if (phaseVariance > this.varianceThreshold * 0.2 && phaseVariance <= this.varianceThreshold * 1.5) {
      if (breathingBpm > 0 && heartBpm > 0) {
        // Typical breathing rate is low (6-25 BPM), heart rate (50-100 BPM)
        if (breathingBpm >= 6 && breathingBpm <= 20) {
          return { state: 'someone-sleeping', confidence: 0.88 };
        }
        return { state: 'meeting-in-progress', confidence: 0.85 };
      }
    }

    // 4. Inactivity anomaly (Possible distress: vitals lost/irregular but minor heat phase)
    if (phaseVariance > 0.02 && phaseVariance <= this.varianceThreshold * 0.2) {
      if (breathingBpm === 0 || heartBpm === 0) {
        return { state: 'possible-distress', confidence: 0.76, alert: true };
      }
    }

    // 5. Completely empty / No movement
    return { state: 'no-movement', confidence: 0.95 };
  }
}

module.exports = {
  OccupancyDetector
};
