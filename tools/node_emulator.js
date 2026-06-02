#!/usr/bin/env node

/**
 * WiSense Hardware Node Emulator
 * Simulates a set of active ESP32-S3 nodes streaming CSI frames over WebSocket (Socket.io)
 * to change the aggregator server mode to 'LIVE - ESP32' and demonstrate end-to-end integration.
 */

const { io } = require('socket.io-client');

const targetUrl = process.argv[2] || 'http://localhost:3000';
console.log(`[*] Starting WiSense Hardware Emulator target: ${targetUrl}`);

const socket = io(targetUrl, {
  reconnectionAttempts: 10,
  reconnectionDelay: 2000
});

const macAddresses = [
  'd8:3a:dd:4c:5a:20',
  '3c:61:05:11:ea:04',
  'cc:50:e3:8f:bc:12',
  '84:fc:ac:4d:22:98'
];

let angle = 0;
let step = 0;
let mockPerson = { x: 0.1, y: 0.8, z: 1.2 };

socket.on('connect', () => {
  console.log('[+] Connected to WiSense aggregator. Emulating telemetry transmission...');
  
  // Start transmission loop at 10Hz
  const interval = setInterval(() => {
    angle += 0.05;
    step++;
    
    // Choose active node
    const nodeIndex = step % macAddresses.length;
    const activeMac = macAddresses[nodeIndex];
    
    // Simulate target movement
    const isMoving = Math.sin(angle * 0.1) > -0.2;
    let activity = 'room-active';
    let phaseVar = 0.5 + Math.random() * 0.2;
    let breathBPM = 0;
    let heartBPM = 0;
    
    if (isMoving) {
      mockPerson.x = Math.sin(angle) * 1.4;
      mockPerson.y = 0.8;
      mockPerson.z = Math.cos(angle * 0.6) * 1.0 + 1.4;
    } else {
      activity = 'someone-sleeping';
      mockPerson.y = 0.2; // Lying down
      phaseVar = 0.03 + Math.random() * 0.01;
      breathBPM = 14.8 + Math.sin(step * 0.04) * 0.4;
      heartBPM = 72.5 + Math.sin(step * 0.06) * 1.2;
    }
    
    // Trigger sudden fall every 1000 frames
    const triggerFall = (step % 1000 === 0);
    let accel = Math.random() * 0.15;
    if (triggerFall) {
      accel = 3.4; // Exceed fall threshold
      mockPerson.x = 0.2;
      mockPerson.y = 0.05; // fallen on ground
      mockPerson.z = 0.9;
      activity = 'fall-risk-elevated';
      console.log('[!] Emulating sudden fall event!');
    }
    
    // Generate joints coordinate skeleton
    const pose = generateEmulatorSkeleton(mockPerson, activity);
    
    // Package into csi-frame payload
    const payload = {
      mac: activeMac,
      rssi: -45 - Math.round(Math.abs(mockPerson.x) * 6),
      noise: -95,
      metrics: {
        phaseVariance: phaseVar,
        rssi: -45 - Math.round(Math.abs(mockPerson.x) * 6),
        breathingBpm: breathBPM,
        heartBpm: heartBPM,
        acceleration: accel
      },
      occupancy: {
        state: activity,
        confidence: 0.94,
        count: 1
      },
      pose: pose
    };
    
    // Emit over socket
    socket.emit('csi-frame', payload);
  }, 100);

  socket.on('disconnect', () => {
    console.warn('[-] Disconnected from WiSense aggregator. Stopping transmission.');
    clearInterval(interval);
  });
});

socket.on('connect_error', (err) => {
  console.error('[-] Connection error:', err.message);
});

// Helper to generate joints positions
function generateEmulatorSkeleton(base, state) {
  const joints = [];
  let heightMod = 1.0;
  if (state === 'fall-risk-elevated') heightMod = 0.08;
  else if (state === 'someone-sleeping') heightMod = 0.25;
  
  const hOffset = base.y;
  
  for (let idx = 0; idx < 17; idx++) {
    let dx = 0, dy = 0, dz = 0;
    switch(idx) {
      case 0: dx = 0; dy = 0.9 * heightMod; dz = 0; break; // pelvis
      case 1: dx = 0; dy = 1.1 * heightMod; dz = 0; break; // spine
      case 2: dx = 0; dy = 1.4 * heightMod; dz = 0; break; // neck
      case 3: dx = 0; dy = 1.6 * heightMod; dz = 0; break; // head
      case 4: dx = -0.3; dy = 1.35 * heightMod; dz = 0; break; // l_shoulder
      case 5: dx = -0.5; dy = 1.1 * heightMod; dz = 0.1 * Math.sin(angle); break; // l_elbow
      case 6: dx = -0.6; dy = 0.9 * heightMod; dz = 0.2 * Math.cos(angle); break; // l_wrist
      case 7: dx = 0.3; dy = 1.35 * heightMod; dz = 0; break; // r_shoulder
      case 8: dx = 0.5; dy = 1.1 * heightMod; dz = -0.1 * Math.sin(angle); break; // r_elbow
      case 9: dx = 0.6; dy = 0.9 * heightMod; dz = -0.2 * Math.cos(angle); break; // r_wrist
      case 10: dx = -0.2; dy = 0.8 * heightMod; dz = 0; break; // l_hip
      case 11: dx = -0.25; dy = 0.4 * heightMod; dz = 0.1 * Math.cos(angle); break; // l_knee
      case 12: dx = -0.25; dy = 0.05 * heightMod; dz = 0.2 * Math.sin(angle); break; // l_ankle
      case 13: dx = 0.2; dy = 0.8 * heightMod; dz = 0; break; // r_hip
      case 14: dx = 0.25; dy = 0.4 * heightMod; dz = -0.1 * Math.cos(angle); break; // r_knee
      case 15: dx = 0.25; dy = 0.05 * heightMod; dz = -0.2 * Math.sin(angle); break; // r_ankle
      case 16: dx = 0; dy = 1.25 * heightMod; dz = 0.05 * Math.sin(step * 0.2); break; // chest
    }
    
    joints.push([
      base.x + dx,
      (state === 'fall-risk-elevated') ? base.y + dx * 0.25 : base.y + dz,
      (state === 'fall-risk-elevated') ? 0.22 : dy + hOffset
    ]);
  }
  return joints;
}
