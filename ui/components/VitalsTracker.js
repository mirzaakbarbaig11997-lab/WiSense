/**
 * WiSense Real-time Vitals Scrolling Waveform Canvas Renderer
 * Renders high-fidelity glowing line charts for chest expansion and heart rate pulses.
 */

class VitalsTracker {
  constructor(breathingCanvasId, heartCanvasId) {
    this.bCanvas = document.getElementById(breathingCanvasId);
    this.hCanvas = document.getElementById(heartCanvasId);
    
    this.bCtx = this.bCanvas ? this.bCanvas.getContext('2d') : null;
    this.hCtx = this.hCanvas ? this.hCanvas.getContext('2d') : null;
    
    this.breathHistory = new Array(150).fill(0);
    this.heartHistory = new Array(150).fill(0);
    this.tickCount = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  resize() {
    if (this.bCanvas) {
      const bParent = this.bCanvas.parentElement;
      this.bCanvas.width = bParent.clientWidth;
      this.bCanvas.height = bParent.clientHeight || 60;
    }
    
    if (this.hCanvas) {
      const hParent = this.hCanvas.parentElement;
      this.hCanvas.width = hParent.clientWidth;
      this.hCanvas.height = hParent.clientHeight || 60;
    }
  }

  /**
   * Adds new samples to the scrolling charts
   */
  feedTelemetry(breathingSample, heartSample) {
    this.breathHistory.push(breathingSample);
    if (this.breathHistory.length > 150) this.breathHistory.shift();

    this.heartHistory.push(heartSample);
    if (this.heartHistory.length > 150) this.heartHistory.shift();
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.tickCount++;

    // Render Breathing Waveform
    if (this.bCtx && this.bCanvas) {
      this.drawWave(this.bCtx, this.bCanvas, this.breathHistory, '#06b6d4', 'rgba(6, 182, 212, 0.08)');
    }

    // Render Heart Rate Waveform
    if (this.hCtx && this.hCanvas) {
      this.drawWave(this.hCtx, this.hCanvas, this.heartHistory, '#8b5cf6', 'rgba(139, 92, 246, 0.08)');
    }
  }

  drawWave(ctx, canvas, data, strokeColor, fillColor) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (data.length === 0) return;

    // Center vertical alignment and auto-scaling
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal || 1.0;
    
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 8;
    ctx.shadowColor = strokeColor;
    
    // Draw Grid Lines (Subtle horizontal divider lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Reset stroke back to glowing line details
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 6;
    ctx.shadowColor = strokeColor;

    ctx.beginPath();
    
    const step = w / (data.length - 1);
    
    data.forEach((val, idx) => {
      // Map value to canvas height (leaving 5px safety margin top and bottom)
      const normY = (val - minVal) / range;
      const y = h - (normY * (h - 10) + 5);
      const x = idx * step;
      
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();

    // Fill area below wave
    ctx.shadowBlur = 0; // turn off shadow for solid fills
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
}

window.VitalsTracker = VitalsTracker;
