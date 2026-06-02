/**
 * WiSense 3D Room Map & Signal Field Component
 * Uses Three.js to render nodes, signal wave particles, and tracked human targets in 3D.
 */

class RoomMap3D {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight || 400;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.personTracker = null;
    this.nodes = [];
    this.particleWaveAngle = 0;

    this.init();
  }

  init() {
    // 1. Create Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04050b);

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 100);
    this.camera.position.set(0, 5, 7);
    this.camera.lookAt(0, 0.8, 0);

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x06b6d4, 0.8);
    dirLight.position.set(5, 10, 5);
    this.scene.add(dirLight);

    const floorLight = new THREE.PointLight(0x8b5cf6, 0.5, 10);
    floorLight.position.set(0, 0.1, 0);
    this.scene.add(floorLight);

    // 5. Floor Grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x06b6d4, 0x1e293b);
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

    // 6. Draw 4 WiFi Nodes at corners
    const nodeCoords = [
      { x: -3.5, z: -3.5 },
      { x: 3.5, z: -3.5 },
      { x: -3.5, z: 3.5 },
      { x: 3.5, z: 3.5 }
    ];

    nodeCoords.forEach((coord, index) => {
      const geometry = new THREE.BoxGeometry(0.3, 0.4, 0.3);
      const material = new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.2
      });
      const node = new THREE.Mesh(geometry, material);
      node.position.set(coord.x, 0.2, coord.z);
      this.scene.add(node);
      this.nodes.push(node);
    });

    // 7. Dynamic Wave Particle Field
    const particleGeometry = new THREE.BufferGeometry();
    const particleCount = 400;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // Scatter particles in a 6x6x2.5 meter grid
      positions[i * 3] = (Math.random() - 0.5) * 7;
      positions[i * 3 + 1] = Math.random() * 2.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7;

      // Color Cyan -> Violet gradients
      colors[i * 3] = 0.02 + Math.random() * 0.1; // R
      colors[i * 3 + 1] = 0.5 + Math.random() * 0.4; // G (cyan)
      colors[i * 3 + 2] = 0.8 + Math.random() * 0.2; // B
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle Shader Material (Round points)
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particles);

    // 8. Tracked Human target (Glowing Sphere)
    const trackerGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const trackerMaterial = new THREE.MeshStandardMaterial({
      color: 0x8b5cf6,
      emissive: 0x8b5cf6,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.85
    });
    this.personTracker = new THREE.Mesh(trackerGeometry, trackerMaterial);
    this.personTracker.position.set(0, 0.8, 0.5);
    this.scene.add(this.personTracker);

    // 9. Resize handler
    window.addEventListener('resize', () => this.onResize());

    // 10. Start Animation Loop
    this.animate();
  }

  updateTargetPosition(x, y, z) {
    if (!this.personTracker) return;
    
    // Smooth target movement interpolations
    this.personTracker.position.x += (x - this.personTracker.position.x) * 0.15;
    this.personTracker.position.y += (y - this.personTracker.position.y) * 0.15;
    this.personTracker.position.z += (z - this.personTracker.position.z) * 0.15;
  }

  updatePhasePerturbation(variance) {
    if (!this.particles) return;
    
    // Set particle color intensity based on variance (motion)
    const colors = this.particles.geometry.attributes.color.array;
    for (let i = 0; i < colors.length; i += 3) {
      if (variance > 0.4) {
        // More high energy violet/orange particles during movement
        colors[i] = 0.5 + Math.random() * 0.4;
        colors[i + 1] = 0.1 + Math.random() * 0.2;
        colors[i + 2] = 0.8;
      } else {
        // Calm cyan/blue waves
        colors[i] = 0.02;
        colors[i + 1] = 0.5 + Math.random() * 0.3;
        colors[i + 2] = 0.8;
      }
    }
    this.particles.geometry.attributes.color.needsUpdate = true;
  }

  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight || 400;
    
    if (this.camera && this.renderer) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    this.particleWaveAngle += 0.01;
    
    // 1. Slow Camera Orbit Rotation
    this.camera.position.x = Math.sin(this.particleWaveAngle * 0.15) * 7.5;
    this.camera.position.z = Math.cos(this.particleWaveAngle * 0.15) * 7.5;
    this.camera.lookAt(0, 0.8, 0);

    // 2. Animate Signal wave particles
    if (this.particles) {
      const positions = this.particles.geometry.attributes.position.array;
      const count = positions.length / 3;

      for (let i = 0; i < count; i++) {
        // Add waving motion to particle heights
        positions[i * 3 + 1] += Math.sin(this.particleWaveAngle + positions[i * 3]) * 0.003;
        
        // Wrap heights
        if (positions[i * 3 + 1] > 2.5) positions[i * 3 + 1] = 0;
        if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 2.5;
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Node status pulse animations
    if (this.nodes.length > 0) {
      this.nodes.forEach((node, index) => {
        const pulse = 0.3 + 0.15 * Math.sin(this.particleWaveAngle * 3 + index);
        node.material.emissiveIntensity = pulse;
      });
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.RoomMap3D = RoomMap3D;
