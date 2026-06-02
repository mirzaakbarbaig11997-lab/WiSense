/**
 * WiSense Telemetry Stream & Local Simulation Service
 * Handles data smoothing, cache buffers, and provides a client-side
 * simulation backup loop if the main WebSocket server becomes unreachable.
 */

class DataService {
  constructor() {
    this.historyBufferLimit = 100;
    this.phaseVarianceHistory = new Array(this.historyBufferLimit).fill(0.02);
    this.rssiHistory = new Array(this.historyBufferLimit).fill(-45);
    
    // Target simulation parameters (client-side backup)
    this.backupTimer = null;
    this.simulateLocal = false;
    this.simAngle = 0;
    this.simSampleIndex = 0;
  }

  feedData(metrics) {
    if (!metrics) return;
    
    // Feed arrays for historic metrics graphs
    this.phaseVarianceHistory.push(metrics.phaseVariance || 0.02);
    if (this.phaseVarianceHistory.length > this.historyBufferLimit) {
      this.phaseVarianceHistory.shift();
    }

    this.rssiHistory.push(metrics.rssi || -45);
    if (this.rssiHistory.length > this.historyBufferLimit) {
      this.rssiHistory.shift();
    }
  }

  getHistoricData() {
    return {
      phaseVariance: this.phaseVarianceHistory,
      rssi: this.rssiHistory
    };
  }

  /**
   * Starts local mock loop to keep UI functional even if Node.js server goes down.
   * Matches the client-side simulation safety fallback of RuView.
   */
  startBackupSimulation(callback) {
    if (this.backupTimer) return;
    this.simulateLocal = true;
    
    this.backupTimer = setInterval(() => {
      if (!this.simulateLocal) return;

      this.simAngle += 0.05;
      this.simSampleIndex++;
      
      const isMoving = Math.sin(this.simAngle * 0.1) > -0.2;
      const valVar = isMoving ? 0.4 + Math.random() * 0.2 : 0.03 + Math.random() * 0.02;
      
      const simulatedFrame = {
        mode: 'SIMULATED DATA',
        simulated: true,
        timestamp: Date.now(),
        metrics: {
          phaseVariance: valVar,
          rssi: -50 - Math.round(Math.abs(Math.sin(this.simAngle)) * 8),
          breathingBpm: isMoving ? 0 : 15.2 + Math.sin(this.simSampleIndex * 0.05) * 0.5,
          heartBpm: isMoving ? 0 : 71.5 + Math.sin(this.simSampleIndex * 0.08) * 1.5,
          acceleration: (this.simSampleIndex % 200 === 0) ? 2.8 : Math.random() * 0.15
        },
        occupancy: {
          state: (this.simSampleIndex % 200 === 0) 
                  ? 'fall-risk-elevated' 
                  : (isMoving ? 'room-active' : 'someone-sleeping'),
          confidence: 0.90,
          count: 1
        },
        pose: this.generateMockSkeleton(isMoving)
      };

      this.feedData(simulatedFrame.metrics);
      callback(simulatedFrame);
    }, 100);
  }

  stopBackupSimulation() {
    this.simulateLocal = false;
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
  }

  generateMockSkeleton(isMoving) {
    const joints = [];
    const base = {
      x: isMoving ? Math.sin(this.simAngle) * 1.2 : 0.2,
      y: isMoving ? 0.7 : 0.15,
      z: isMoving ? Math.cos(this.simAngle) * 0.8 + 1.2 : 1.4
    };

    for (let i = 0; i < 17; i++) {
      joints.push([
        base.x + (Math.random() - 0.5) * 0.15,
        base.y + (Math.random() - 0.5) * 0.1,
        base.z + (i * 0.08)
      ]);
    }
    return joints;
  }
}

window.DataService = DataService;
