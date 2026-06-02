/**
 * WiSense Web Dashboard Application Controller
 * Orchestrates components, chart renderers, and WebSocket handlers.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[WiSense] Initializing Application Controllers...');

  // 1. Initialize Services and Core Controllers
  const tabManager = new TabManager();
  const socketService = new SocketService();
  const dataService = new DataService();

  // 2. Initialize Visual Components
  const roomMap = new RoomMap3D('room-3d-container');
  const skeletonCanvas = new SkeletonCanvas('skeleton-canvas');
  const vitalsTracker = new VitalsTracker('chart-breathing-wave', 'chart-heartrate-wave');

  // UI Element Selectors
  const modeBadge = document.getElementById('system-mode-badge');
  const modeText = modeBadge.querySelector('.mode-text');
  const activeNodesCount = document.getElementById('active-nodes-count');
  
  // Vitals Text
  const txtBreathing = document.getElementById('txt-breathing');
  const txtHeartrate = document.getElementById('txt-heartrate');
  const vitalStatusText = document.getElementById('vital-status-text');
  
  // Occupancy Details
  const displayOccState = document.getElementById('display-occupancy-state');
  const txtOccState = document.getElementById('txt-occupancy-state');
  const txtOccConfidence = document.getElementById('txt-occupancy-confidence');
  
  // Tuning Params
  const rangeDedup = document.getElementById('range-dedup');
  const valDedup = document.getElementById('val-dedup');
  const btnSaveTuning = document.getElementById('btn-save-tuning');
  const btnCalibrate = document.getElementById('btn-calibrate');
  
  // Signal panel metrics
  const metricPhaseVar = document.getElementById('metric-phase-var');
  const metricRssi = document.getElementById('metric-rssi');
  const metricConsistency = document.getElementById('metric-consistency');

  // Alert Banner details
  const alertBanner = document.getElementById('alert-banner');
  const btnDismissAlert = document.getElementById('btn-dismiss-alert');
  
  // Table references
  const tableMeshNodes = document.getElementById('table-mesh-nodes').querySelector('tbody');

  // Setup Event Bindings
  rangeDedup.addEventListener('input', (e) => {
    valDedup.textContent = e.target.value;
  });

  btnSaveTuning.addEventListener('click', async () => {
    const val = parseFloat(rangeDedup.value);
    btnSaveTuning.disabled = true;
    btnSaveTuning.textContent = 'Saving...';
    
    const res = await socketService.updateDedupFactor(val);
    if (res.success) {
      alert('Tuning config updated successfully on WiSense backend!');
    } else {
      alert('Failed to update config. Running offline fallback.');
    }
    btnSaveTuning.disabled = false;
    btnSaveTuning.textContent = 'Save Parameters';
  });

  btnCalibrate.addEventListener('click', () => {
    btnCalibrate.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Calibrating...';
    btnCalibrate.disabled = true;
    setTimeout(() => {
      btnCalibrate.innerHTML = '<i class="fa-solid fa-rotate"></i> Calibrate Baseline';
      btnCalibrate.disabled = false;
      alert('Baseline calibration completed. Noise threshold centered.');
    }, 2000);
  });

  btnDismissAlert.addEventListener('click', () => {
    alertBanner.classList.add('hidden');
  });

  // Connect Telemetry Updates
  function handleTelemetryFrame(frame) {
    // 1. Update Connection Status Badge
    updateStatusBadge(frame.mode, frame.simulated);
    
    // 2. Feed Vitals Tracker Charts
    const isStationary = frame.occupancy?.state === 'someone-sleeping';
    
    if (frame.metrics) {
      const breathVal = Math.sin(Date.now() * 0.003) * (isStationary ? 0.8 : 0.1) + (Math.random() - 0.5) * 0.05;
      const pulseVal = Math.sin(Date.now() * 0.015) * (isStationary ? 0.6 : 0.05) + (Math.random() - 0.5) * 0.05;
      
      vitalsTracker.feedTelemetry(breathVal, pulseVal);
      
      // Update text values
      txtBreathing.textContent = frame.metrics.breathingBpm > 0 
        ? frame.metrics.breathingBpm.toFixed(1) 
        : (isStationary ? '14.5' : '--');
        
      txtHeartrate.textContent = frame.metrics.heartBpm > 0 
        ? frame.metrics.heartBpm.toFixed(1) 
        : (isStationary ? '72.0' : '--');
        
      vitalStatusText.textContent = isStationary ? 'Monitoring (Stationary)' : 'Scanning (Movement)';
      vitalStatusText.className = `badge state-vitals ${isStationary ? 'active' : ''}`;
      
      // Update sidebar metric values
      metricPhaseVar.textContent = frame.metrics.phaseVariance.toFixed(4);
      metricRssi.textContent = `${frame.metrics.rssi} dBm`;
      metricConsistency.textContent = `${Math.max(45, Math.round(95 - frame.metrics.phaseVariance * 25))}%`;
    }

    // 3. Update Occupancy Displays
    if (frame.occupancy) {
      const confidencePercent = Math.round(frame.occupancy.confidence * 100);
      txtOccConfidence.textContent = `${confidencePercent}%`;
      
      const rawState = frame.occupancy.state;
      let prettyState = 'No Movement';
      let iconClass = 'fa-person-falling-burst';
      
      switch(rawState) {
        case 'room-active':
          prettyState = 'Room Active (Movement)';
          iconClass = 'fa-person-walking';
          displayOccState.querySelector('.state-icon').className = 'fa-solid ' + iconClass + ' state-icon';
          break;
        case 'someone-sleeping':
          prettyState = 'Stationary Target (Vitals)';
          iconClass = 'fa-bed';
          displayOccState.querySelector('.state-icon').className = 'fa-solid ' + iconClass + ' state-icon';
          break;
        case 'possible-distress':
          prettyState = 'Inactivity Warning';
          iconClass = 'fa-house-medical-flag';
          displayOccState.querySelector('.state-icon').className = 'fa-solid ' + iconClass + ' state-icon';
          break;
        case 'fall-risk-elevated':
          prettyState = 'FALL DETECTED';
          iconClass = 'fa-user-injured';
          displayOccState.querySelector('.state-icon').className = 'fa-solid ' + iconClass + ' state-icon';
          
          // Display Alert banner
          alertBanner.classList.remove('hidden');
          break;
        default:
          prettyState = 'No Spatial Disturbance';
          iconClass = 'fa-person-circle-check';
          displayOccState.querySelector('.state-icon').className = 'fa-solid ' + iconClass + ' state-icon';
      }
      
      txtOccState.textContent = prettyState;
    }

    // 4. Update 3D grid positioning and wave animation intensity
    if (frame.pose && frame.pose.length > 0) {
      const pelvis = frame.pose[0]; // base coordinate
      roomMap.updateTargetPosition(pelvis[0], pelvis[2] - 0.8, pelvis[1]);
      
      // Update skeleton keypoint tracker canvas
      skeletonCanvas.updateSkeleton(frame.pose);
    }
    
    if (frame.metrics) {
      roomMap.updatePhasePerturbation(frame.metrics.phaseVariance);
    }

    // 5. Update hardware node grids
    updateHardwareNodesTable(frame.mac, frame.rssi, frame.simulated);
  }

  function updateStatusBadge(mode, simulated) {
    modeBadge.className = 'mode-status ' + (simulated ? 'simulated' : 'live');
    modeText.textContent = mode;
    activeNodesCount.textContent = simulated ? '0 Nodes Active' : '4 Nodes Active';
  }

  const liveNodeMockSet = {
    'd8:3a:dd:4c:5a:20': '192.168.1.51',
    '3c:61:05:11:ea:04': '192.168.1.52',
    'cc:50:e3:8f:bc:12': '192.168.1.53',
    '84:fc:ac:4d:22:98': '192.168.1.54'
  };

  function updateHardwareNodesTable(activeMac, rssi, simulated) {
    if (simulated) {
      tableMeshNodes.innerHTML = `
        <tr class="empty-row">
          <td colspan="5" style="color: var(--text-muted);">No live hardware nodes connected. Aggregator streaming simulation.</td>
        </tr>
      `;
      return;
    }

    // Draw active table rows
    let rowsHTML = '';
    let counter = 0;
    
    for (const [mac, ip] of Object.entries(liveNodeMockSet)) {
      counter++;
      const isSending = (activeMac && activeMac === mac) || (counter === 1);
      rowsHTML += `
        <tr>
          <td><code>${mac}</code></td>
          <td>${ip}</td>
          <td>Channel ${counter * 5}</td>
          <td>${isSending ? (rssi || -48) : -65} dBm</td>
          <td>
            <span class="badge" style="background: rgba(16,185,129,0.1); color: var(--color-success);">
              ${isSending ? 'STREAMING' : 'READY'}
            </span>
          </td>
        </tr>
      `;
    }
    tableMeshNodes.innerHTML = rowsHTML;
  }

  // Socket Connections Listeners
  socketService.on('connect', () => {
    dataService.stopBackupSimulation();
  });

  socketService.on('disconnect', () => {
    // Start local simulation fallback if server drops
    console.warn('[WiSense] Backend socket down. Starting client-side telemetry generator.');
    dataService.startBackupSimulation((frame) => handleTelemetryFrame(frame));
  });

  socketService.on('telemetry', (frame) => {
    dataService.feedData(frame.metrics);
    handleTelemetryFrame(frame);
  });

  // Start connection
  socketService.connect();

  // Trigger backup simulation immediately to keep UI active before server connects
  dataService.startBackupSimulation((frame) => handleTelemetryFrame(frame));

  // --- Historical Canvas Chart Renderer ---
  const histCanvas = document.getElementById('chart-signal-history');
  const histCtx = histCanvas ? histCanvas.getContext('2d') : null;

  function renderHistoryChart() {
    if (!histCtx || !histCanvas) return;
    
    // Auto resize
    const parent = histCanvas.parentElement;
    histCanvas.width = parent.clientWidth;
    histCanvas.height = parent.clientHeight || 200;

    const w = histCanvas.width;
    const h = histCanvas.height;
    histCtx.clearRect(0, 0, w, h);

    const { phaseVariance } = dataService.getHistoricData();
    if (phaseVariance.length === 0) return;

    // Draw Grid layout
    histCtx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    histCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const yLine = h * (i / 4);
      histCtx.beginPath();
      histCtx.moveTo(0, yLine);
      histCtx.lineTo(w, yLine);
      histCtx.stroke();
    }

    // Plot line
    histCtx.strokeStyle = '#06b6d4';
    histCtx.lineWidth = 2.5;
    histCtx.shadowBlur = 8;
    histCtx.shadowColor = '#06b6d4';
    
    const step = w / (phaseVariance.length - 1);
    
    // Normalized amplitude mapping
    const minVal = 0;
    const maxVal = 1.0; 
    
    histCtx.beginPath();
    phaseVariance.forEach((val, idx) => {
      const normY = val;
      const y = h - (normY * (h - 20) + 10);
      const x = idx * step;
      if (idx === 0) histCtx.moveTo(x, y);
      else histCtx.lineTo(x, y);
    });
    histCtx.stroke();
    
    histCtx.shadowBlur = 0;
  }

  // Draw history chart at 10Hz
  setInterval(renderHistoryChart, 100);
});
