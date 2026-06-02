const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const dgram = require('dgram');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

// Load configurations
let config = {
  server: { port: process.env.PORT || 3000, host: '0.0.0.0' },
  dsp: { presence_threshold: 0.15, fall_acceleration_threshold: 2.5 },
  mesh: { expected_nodes: 4 }
};

if (fs.existsSync(path.join(__dirname, 'config.json'))) {
  try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch (err) {
    console.error('[WiSense] Failed to parse config.json, using defaults.');
  }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'ui')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Import DSP helpers
const { BandpassFilter, calculateBPM, calculateSignalVariance } = require('./dsp/filters');
const { OccupancyDetector } = require('./dsp/occupancy');

const detector = new OccupancyDetector(config.dsp);

// System states
let systemMode = 'SIMULATED DATA'; // SIMULATED DATA, LIVE - ESP32
let lastLiveFrameTime = 0;
let meshNodes = {};
let mockPersonPosition = { x: 0, y: 0.8, z: 0.5 };
let mockAngle = 0;

// Setup UDP client listener for ESP32 nodes
const udpServer = dgram.createSocket('udp4');
const UDP_PORT = 8082;

udpServer.on('message', (msg, rinfo) => {
  // Parse binary CSI packet structure
  try {
    if (msg.length < 12) return; // invalid size
    const mac = Array.from(msg.subarray(0, 6)).map(b => b.toString(16).padStart(2, '0')).join(':');
    const rssi = msg.readInt8(6);
    const noise = msg.readInt8(7);
    const len = msg.readUInt16LE(8);
    
    // Add to mesh nodes tracking
    meshNodes[mac] = {
      ip: rinfo.address,
      rssi: rssi,
      noise: noise,
      lastSeen: Date.now()
    };
    
    systemMode = 'LIVE - ESP32';
    lastLiveFrameTime = Date.now();
    
    // Broadcast received telemetry
    io.emit('telemetry', {
      mac,
      rssi,
      noise,
      mode: 'LIVE - ESP32',
      simulated: false,
      timestamp: Date.now()
    });
  } catch (e) {
    console.error('[WiSense] UDP CSI packet parsing error:', e);
  }
});

udpServer.on('error', (err) => {
  console.error('[WiSense] UDP Server error:', err.stack);
});

try {
  udpServer.bind(UDP_PORT, () => {
    console.log(`[WiSense] Listening for ESP32 raw CSI UDP packets on port ${UDP_PORT}`);
  });
} catch (e) {
  console.error('[WiSense] Failed to bind UDP port 8082 (likely occupied):', e.message);
}

// Generate realistic simulated CSI signal streams & poses
// simulating person moving, breathing, and heartbeats
let breathingBuffer = [];
let heartRateBuffer = [];
let sampleCounter = 0;

const breathFilter = new BandpassFilter(0.1, 0.5, 10); // 10Hz sampling
const heartFilter = new BandpassFilter(0.8, 2.0, 10);

setInterval(() => {
  const now = Date.now();
  
  // Check if live data has timed out (5s)
  if (now - lastLiveFrameTime > 5000) {
    systemMode = 'SIMULATED DATA';
  }
  
  if (systemMode === 'SIMULATED DATA') {
    sampleCounter++;
    
    // Create base movements
    mockAngle += 0.05;
    
    // Simulate person moving in oval path
    const isMoving = Math.sin(mockAngle * 0.1) > -0.2; // 80% time moving, 20% stationary
    let activity = 'room-active';
    let phaseVar = 0.5 + Math.random() * 0.2;
    let breathBPM = 0;
    let heartBPM = 0;
    
    if (isMoving) {
      mockPersonPosition.x = Math.sin(mockAngle) * 1.5;
      mockPersonPosition.y = 0.8;
      mockPersonPosition.z = Math.cos(mockAngle * 0.7) * 1.2 + 1.5;
    } else {
      // Stationary: Vitals are dominant
      activity = 'someone-sleeping';
      mockPersonPosition.y = 0.2; // sitting/lying down
      phaseVar = 0.03 + Math.random() * 0.02; // very low noise
      
      // Target breathing sine wave (0.25 Hz = 15 BPM) + noise
      const breathSignal = Math.sin(sampleCounter * 2 * Math.PI * 0.25 / 10) + (Math.random() - 0.5) * 0.2;
      const filteredBreath = breathFilter.process(breathSignal);
      breathingBuffer.push(filteredBreath);
      if (breathingBuffer.length > 100) breathingBuffer.shift();
      breathBPM = calculateBPM(breathingBuffer, 10, 8, 24) || 14.5;
      
      // Target heart rate (1.2 Hz = 72 BPM) + noise
      const heartSignal = Math.sin(sampleCounter * 2 * Math.PI * 1.2 / 10) + (Math.random() - 0.5) * 0.2;
      const filteredHeart = heartFilter.process(heartSignal);
      heartRateBuffer.push(filteredHeart);
      if (heartRateBuffer.length > 100) heartRateBuffer.shift();
      heartBPM = calculateBPM(heartRateBuffer, 10, 50, 110) || 72.1;
    }
    
    // Simulate a random fall every 80 seconds
    const triggerFall = (sampleCounter % 800) === 0;
    let accel = Math.random() * 0.2;
    if (triggerFall) {
      accel = 3.2; // cross fall threshold (2.5)
      mockPersonPosition.x = 0;
      mockPersonPosition.y = 0.05; // on ground
      mockPersonPosition.z = 1.0;
    }
    
    // Classify using DSP occupancy detector
    const classifier = detector.classifyState({
      phaseVariance: phaseVar,
      breathingBpm: breathBPM,
      heartBpm: heartBPM,
      acceleration: accel
    });
    
    // Build 17-keypoint skeleton based on character position
    const skeleton = generateSkeleton(mockPersonPosition, classifier.state);
    
    // Send simulated telemetry to connected clients
    io.emit('telemetry', {
      mode: 'SIMULATED DATA',
      simulated: true,
      timestamp: now,
      metrics: {
        phaseVariance: phaseVar,
        rssi: -45 - Math.round(Math.abs(mockPersonPosition.x) * 5),
        breathingBpm: breathBPM,
        heartBpm: heartBPM,
        acceleration: accel
      },
      occupancy: {
        state: classifier.state,
        confidence: classifier.confidence,
        count: isMoving ? 1 : 1
      },
      pose: skeleton
    });
  }
}, 100); // 10Hz streaming

// Helper to generate 17 keypoint nodes
function generateSkeleton(base, state) {
  const joints = [];
  const jointNames = [
    'pelvis', 'spine', 'neck', 'head',                  // 0, 1, 2, 3
    'l_shoulder', 'l_elbow', 'l_wrist',                 // 4, 5, 6
    'r_shoulder', 'r_elbow', 'r_wrist',                 // 7, 8, 9
    'l_hip', 'l_knee', 'l_ankle',                       // 10, 11, 12
    'r_hip', 'r_knee', 'r_ankle',                       // 13, 14, 15
    'chest'                                             // 16
  ];
  
  // Height coefficients
  let heightMod = 1.0;
  if (state === 'fall-risk-elevated') heightMod = 0.1;
  else if (state === 'someone-sleeping') heightMod = 0.25;
  
  const hOffset = base.y;
  
  jointNames.forEach((name, idx) => {
    let dx = 0, dy = 0, dz = 0;
    switch(idx) {
      case 0: dx = 0; dy = 0.9 * heightMod; dz = 0; break; // pelvis
      case 1: dx = 0; dy = 1.1 * heightMod; dz = 0; break; // spine
      case 2: dx = 0; dy = 1.4 * heightMod; dz = 0; break; // neck
      case 3: dx = 0; dy = 1.6 * heightMod; dz = 0; break; // head
      
      case 4: dx = -0.3; dy = 1.35 * heightMod; dz = 0; break; // l_shoulder
      case 5: dx = -0.5; dy = 1.1 * heightMod; dz = 0.1 * Math.sin(mockAngle); break; // l_elbow
      case 6: dx = -0.6; dy = 0.9 * heightMod; dz = 0.2 * Math.cos(mockAngle); break; // l_wrist
      
      case 7: dx = 0.3; dy = 1.35 * heightMod; dz = 0; break; // r_shoulder
      case 8: dx = 0.5; dy = 1.1 * heightMod; dz = -0.1 * Math.sin(mockAngle); break; // r_elbow
      case 9: dx = 0.6; dy = 0.9 * heightMod; dz = -0.2 * Math.cos(mockAngle); break; // r_wrist
      
      case 10: dx = -0.2; dy = 0.8 * heightMod; dz = 0; break; // l_hip
      case 11: dx = -0.25; dy = 0.4 * heightMod; dz = 0.1 * Math.cos(mockAngle); break; // l_knee
      case 12: dx = -0.25; dy = 0.05 * heightMod; dz = 0.2 * Math.sin(mockAngle); break; // l_ankle
      
      case 13: dx = 0.2; dy = 0.8 * heightMod; dz = 0; break; // r_hip
      case 14: dx = 0.25; dy = 0.4 * heightMod; dz = -0.1 * Math.cos(mockAngle); break; // r_knee
      case 15: dx = 0.25; dy = 0.05 * heightMod; dz = -0.2 * Math.sin(mockAngle); break; // r_ankle
      
      case 16: dx = 0; dy = 1.25 * heightMod; dz = 0.05 * Math.sin(sampleCounter * 0.2); break; // chest (expanding/breathing)
    }
    
    joints.push([
      base.x + dx,
      (state === 'fall-risk-elevated') ? base.y + dx * 0.2 : base.y + dz, // switch dimensions on fall
      (state === 'fall-risk-elevated') ? 0.25 : dy + hOffset
    ]);
  });
  
  return joints;
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', system: 'WiSense', version: '1.0.0' });
});

app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: systemMode,
    nodesConnected: Object.keys(meshNodes).length,
    activeSensors: Object.keys(meshNodes).map(mac => ({
      mac,
      ip: meshNodes[mac].ip,
      rssi: meshNodes[mac].rssi,
      age: Date.now() - meshNodes[mac].lastSeen
    }))
  });
});

app.get('/api/v1/sensing/state', (req, res) => {
  res.json({
    mode: systemMode,
    timestamp: Date.now(),
    deviceConfig: config.mesh
  });
});

app.post('/api/v1/config/dedup-factor', (req, res) => {
  const { factor } = req.body;
  if (typeof factor === 'number') {
    console.log(`[WiSense] Updated calibration dedup factor to: ${factor}`);
    res.json({ success: true, factor });
  } else {
    res.status(400).json({ error: 'Invalid config factor' });
  }
});

// Render index.html for any other frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui', 'index.html'));
});

server.listen(config.server.port, config.server.host, () => {
  console.log(`[WiSense] Aggregator server running at http://${config.server.host}:${config.server.port}`);
});
