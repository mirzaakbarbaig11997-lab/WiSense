/**
 * WiSense Tab Management Component
 * Controls visibility of tab sheets and updates global header titles.
 */

class TabManager {
  constructor() {
    this.navItems = document.querySelectorAll('.nav-item');
    this.tabPanes = document.querySelectorAll('.tab-pane');
    this.titleElement = document.getElementById('current-tab-title');
    this.subtitleElement = document.getElementById('current-tab-subtitle');
    
    this.tabMeta = {
      'dashboard': {
        title: 'System Dashboard',
        subtitle: 'Real-time room occupancy and vital telemetry overview.'
      },
      'sensing': {
        title: 'WiFi Sensing',
        subtitle: '3D multipath phase perturbations and channel metrics.'
      },
      'tracker': {
        title: 'Spatial Tracking',
        subtitle: 'WiFi-DensePose human skeleton keypoint tracking.'
      },
      'hardware': {
        title: 'Hardware Mesh',
        subtitle: 'ESP32-S3 wireless node configuration and connection logs.'
      }
    };

    this.init();
  }

  init() {
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tabId = item.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });
  }

  switchTab(tabId) {
    // 1. Update navigation items active state
    this.navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 2. Update tab contents active state
    this.tabPanes.forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // 3. Update titles
    const meta = this.tabMeta[tabId];
    if (meta) {
      this.titleElement.textContent = meta.title;
      this.subtitleElement.textContent = meta.subtitle;
    }

    // Trigger window resize event to redraw Three.js/Canvas plots on tab switches
    window.dispatchEvent(new Event('resize'));
  }
}

// Export for browser
window.TabManager = TabManager;
