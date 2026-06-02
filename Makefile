# WiSense Build and Development Makefile

.PHONY: install start test build provision clean

# Install node dependencies
install:
	npm install

# Start local server in development mode
start:
	node server.js

# Run Jest unit and integration tests
test:
	npm run test

# Compile ESP-IDF firmware for ESP32-S3 (requires ESP-IDF environment)
build-esp32:
	cd firmware/esp32-s3-csi-node && idf.py build

# Flash ESP32-S3 firmware to connected COM port
flash-esp32:
	cd firmware/esp32-s3-csi-node && idf.py -p $(PORT) flash

# Clean transient build configurations
clean:
	rm -rf node_modules
	rm -rf firmware/esp32-s3-csi-node/build

# Start hardware node emulator pointing to local host
emulate-local:
	node tools/node_emulator.js http://localhost:3000

# Start hardware node emulator pointing to Railway deployment
emulate-railway:
	node tools/node_emulator.js https://wisense-production.up.railway.app
