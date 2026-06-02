/**
 * WiSense Canvas-based Body Skeleton Renderer
 * Renders 17-keypoint models returned by neural network projections.
 */

class SkeletonCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    
    this.ctx = this.canvas.getContext('2d');
    this.joints = [];
    
    // Keypoint links (parent indices to child indices)
    this.bones = [
      [0, 1], [1, 2], [2, 3], // Spine/neck/head
      [2, 4], [4, 5], [5, 6], // Left Arm
      [2, 7], [7, 8], [8, 9], // Right Arm
      [0, 10], [10, 11], [11, 12], // Left Leg
      [0, 13], [13, 14], [14, 15], // Right Leg
      [1, 16] // Chest anchor
    ];
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const parent = this.canvas.parentElement;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight || 350;
    this.draw();
  }

  updateSkeleton(joints) {
    this.joints = joints;
    this.draw();
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (!this.joints || this.joints.length === 0) {
      // Draw idle calibration ring
      this.ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.canvas.width / 2, this.canvas.height / 2, 60, 0, 2 * Math.PI);
      this.ctx.stroke();
      
      this.ctx.fillStyle = '#9ca3af';
      this.ctx.font = '13px Outfit';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Searching for signal reflections...', this.canvas.width / 2, this.canvas.height / 2 + 10);
      return;
    }

    const w = this.canvas.width;
    const h = this.canvas.height;
    
    // Joint mapping helper
    // Model outputs range roughly X[-1.5, 1.5], Y[0.0, 2.2], Z[-1.5, 1.5]
    // Map to Canvas space
    const project = (pt) => {
      const [x, z, y] = pt; // model layout: x=side, z=height (up), y=depth
      const px = w / 2 + x * (w / 3.5);
      const py = h - y * (h / 2.2) - 20;
      return { x: px, y: py };
    };

    // 1. Draw Bones (Limbs)
    this.ctx.strokeStyle = '#8b5cf6';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = 'rgba(139, 92, 246, 0.4)';
    
    this.bones.forEach(([parentIdx, childIdx]) => {
      if (this.joints[parentIdx] && this.joints[childIdx]) {
        const pt1 = project(this.joints[parentIdx]);
        const pt2 = project(this.joints[childIdx]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(pt1.x, pt1.y);
        this.ctx.lineTo(pt2.x, pt2.y);
        this.ctx.stroke();
      }
    });

    // 2. Draw Keypoint Spheres
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = 'rgba(6, 182, 212, 0.6)';
    this.ctx.fillStyle = '#06b6d4';
    
    this.joints.forEach((joint, idx) => {
      const { x, y } = project(joint);
      
      this.ctx.beginPath();
      // Make head bigger
      const radius = idx === 3 ? 10 : 5;
      this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
      this.ctx.fill();
    });

    // Reset shadow properties for next cycles
    this.ctx.shadowBlur = 0;
  }
}

window.SkeletonCanvas = SkeletonCanvas;
