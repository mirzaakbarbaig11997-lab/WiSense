/**
 * WiSense WebSocket / Socket.io Connection Service
 * Manages WebSocket sessions, connection flags, and registers telemetry callbacks.
 */

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.callbacks = {};
  }

  connect() {
    console.log('[WiSense] Connecting to Aggregator host...');
    
    // Auto-detect host location
    const host = window.location.origin;
    this.socket = io(host, {
      reconnectionAttempts: 20,
      reconnectionDelay: 1500
    });

    this.socket.on('connect', () => {
      console.log('[WiSense] Connected to Aggregator server successfully.');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.trigger('connect', { connected: true });
    });

    this.socket.on('disconnect', () => {
      console.warn('[WiSense] Connection lost.');
      this.connected = false;
      this.trigger('disconnect', { connected: false });
    });

    this.socket.on('telemetry', (data) => {
      this.trigger('telemetry', data);
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      this.reconnectAttempts = attempt;
      this.trigger('reconnecting', { attempt });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[WiSense] Reconnection failed.');
      this.trigger('failed', { failed: true });
    });
  }

  on(event, cb) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(cb);
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  /**
   * Updates tuning variables (e.g. calibration factor) on the aggregator server
   */
  async updateDedupFactor(factor) {
    try {
      const response = await fetch('/api/v1/config/dedup-factor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ factor })
      });
      return await response.json();
    } catch (e) {
      console.error('[WiSense] Failed to update dedup factor:', e);
      return { success: false, error: e.message };
    }
  }
}

window.SocketService = SocketService;
