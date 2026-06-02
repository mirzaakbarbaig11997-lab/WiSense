# 📡 WiSense — Spatial Intelligence Platform

WiSense is a contactless, camera-free spatial intelligence and sensing system that turns standard WiFi signals into real-time tracking, vital signs monitoring, and safety alerts. Running entirely on edge hardware, WiSense intercepts WiFi Channel State Information (CSI) disturbances to detect human presence, chest expansions (breathing), pulse (heart rate), and sudden falls.

Visit **[wisense.io](https://wisense.io)** for more details.

---

## 🛠️ Architecture & Components

The codebase is organized into four core parts:

1. **[Aggregator Server (server.js)](file:///C:/Users/user/WiSense/server.js)**: A lightweight Node.js Express server that aggregates telemetry. It runs a UDP listener on port `8082` for incoming ESP32 packets and hosts a Socket.io server to stream live coordinates and statistics to the client UI. It includes a built-in simulation fallback.
2. **[Digital Signal Processing (dsp/)](file:///C:/Users/user/WiSense/dsp/)**:
   * **[filters.js](file:///C:/Users/user/WiSense/dsp/filters.js)**: Real-time 2nd order IIR Butterworth Bandpass filters (Breathing: `0.1–0.5 Hz` / Heart Rate: `0.8–2.0 Hz`) and zero-crossing BPM calculation math.
   * **[occupancy.js](file:///C:/Users/user/WiSense/dsp/occupancy.js)**: Inference rules to classify rooms into states (`no-movement`, `room-active`, `someone-sleeping`, `possible-distress`, or `fall-risk-elevated`).
   * **[processor.py](file:///C:/Users/user/WiSense/dsp/processor.py)**: Python-based CSI parsing interface that demonstrates loading models from Hugging Face.
3. **[Firmware (firmware/)](file:///C:/Users/user/WiSense/firmware/)**:
   * **[esp32-s3-csi-node](file:///C:/Users/user/WiSense/firmware/esp32-s3-csi-node/)**: ESP-IDF C code setting up station promiscuous mode to extract subcarrier CSI frames and stream UDP payloads.
   * **[arduino-csi-client](file:///C:/Users/user/WiSense/firmware/arduino-csi-client/)**: Clean Arduino IDE `.ino` client for fast setup.
   * **[provision.py](file:///C:/Users/user/WiSense/firmware/provision.py)**: Provisioning helper to configure node connections over serial COM interfaces.
4. **[Web Dashboard UI (ui/)](file:///C:/Users/user/WiSense/ui/)**:
   * **[index.html](file:///C:/Users/user/WiSense/ui/index.html)** & **[style.css](file:///C:/Users/user/WiSense/ui/style.css)**: Glassmorphic dark theme displaying room HUD metrics, tables, and charts.
   * **[components/RoomMap3D.js](file:///C:/Users/user/WiSense/ui/components/RoomMap3D.js)**: WebGL-based Three.js rendering representing the 3D room and dynamic wave scattering.
   * **[components/SkeletonCanvas.js](file:///C:/Users/user/WiSense/ui/components/SkeletonCanvas.js)**: HTML5 Canvas rendering representing a 17-keypoint skeleton.
   * **[components/VitalsTracker.js](file:///C:/Users/user/WiSense/ui/components/VitalsTracker.js)**: Rolling vital waveform plotting.

---

## 🚀 Getting Started

### Prerequisites

* Node.js (version 18 or higher)
* python 3.x (optional, for model loading & provisioning)

### Installation

1. Install the Node.js dependencies using the [Makefile](file:///C:/Users/user/WiSense/Makefile):
   ```bash
   make install
   ```

2. Start the local aggregator server:
   ```bash
   make start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

If no hardware is connected, the UI automatically starts a high-fidelity client simulation fallback loop, allowing you to interact with all the features (moving target, 3D scatter field, vitals history, and fall alerts).

---

## 🧪 Testing

We have built unit and integration tests covering the DSP filters and occupancy classification state machine. Run them using:

```bash
make test
```

---

## 📡 Provisioning ESP32 Hardware Nodes

1. Flash the firmware compiled under [firmware/arduino-csi-client](file:///C:/Users/user/WiSense/firmware/arduino-csi-client/arduino-csi-client.ino) to an ESP32-S3 module.
2. Run the Python helper to point it to your server:
   ```bash
   python firmware/provision.py --port COM9 --ssid "Your_WiFi" --password "WiFi_Pass" --target-ip 192.168.1.10
   ```
3. Once connected to WiFi, the node will begin capturing CSI frames and streaming UDP packets to your host machine on port `8082`. The UI will transition from `SIMULATED DATA` to `LIVE - ESP32`.
