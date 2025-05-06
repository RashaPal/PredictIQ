/**
 * SLA Configuration Manager
 * Handles user-configurable SLA thresholds
 */
class SLAConfig {
  static DEFAULT_THRESHOLDS = {
    'to do': 15,
    'todo': 15,
    'researching': 7,
    'ready for story refinement': 10,
    'ready to develop': 7,
    'in progress': 20,
    'released': 10,
    'enabled': 5,
    'paused': 20,
    'default': 30
  };
  
  constructor() {
    this.thresholds = { ...SLAConfig.DEFAULT_THRESHOLDS };
    this.loadFromLocalStorage();
    this.initialize();
    this.updateCurrentSLADisplay();
  }
  
  /**
   * Initialize the SLA configuration UI
   */
  initialize() {
    // Set initial values in the UI
    this.updateUIValues();
    
    // Set up event listeners
    document.getElementById('saveSLABtn').addEventListener('click', () => {
      this.saveSettings();
    });
    
    document.getElementById('resetSLABtn').addEventListener('click', () => {
      this.resetToDefaults();
    });
  }
  
  /**
   * Update UI input values from current thresholds
   */
  updateUIValues() {
    document.getElementById('sla-todo').value = this.thresholds['to do'];
    document.getElementById('sla-researching').value = this.thresholds['researching'];
    document.getElementById('sla-refinement').value = this.thresholds['ready for story refinement'];
    document.getElementById('sla-ready-develop').value = this.thresholds['ready to develop'];
    document.getElementById('sla-in-progress').value = this.thresholds['in progress'];
    document.getElementById('sla-released').value = this.thresholds['released'];
    document.getElementById('sla-enabled').value = this.thresholds['enabled'];
    document.getElementById('sla-paused').value = this.thresholds['paused'];
    document.getElementById('sla-default').value = this.thresholds['default'];
  }
  
  /**
   * Get thresholds from UI inputs
   */
  getUIValues() {
    return {
      'to do': parseInt(document.getElementById('sla-todo').value) || SLAConfig.DEFAULT_THRESHOLDS['to do'],
      'todo': parseInt(document.getElementById('sla-todo').value) || SLAConfig.DEFAULT_THRESHOLDS['to do'],
      'researching': parseInt(document.getElementById('sla-researching').value) || SLAConfig.DEFAULT_THRESHOLDS['researching'],
      'ready for story refinement': parseInt(document.getElementById('sla-refinement').value) || SLAConfig.DEFAULT_THRESHOLDS['ready for story refinement'],
      'refinement': parseInt(document.getElementById('sla-refinement').value) || SLAConfig.DEFAULT_THRESHOLDS['ready for story refinement'],
      'refinement ready': parseInt(document.getElementById('sla-refinement').value) || SLAConfig.DEFAULT_THRESHOLDS['ready for story refinement'],
      'ready to develop': parseInt(document.getElementById('sla-ready-develop').value) || SLAConfig.DEFAULT_THRESHOLDS['ready to develop'],
      'in progress': parseInt(document.getElementById('sla-in-progress').value) || SLAConfig.DEFAULT_THRESHOLDS['in progress'],
      'in development': parseInt(document.getElementById('sla-in-progress').value) || SLAConfig.DEFAULT_THRESHOLDS['in progress'],
      'released': parseInt(document.getElementById('sla-released').value) || SLAConfig.DEFAULT_THRESHOLDS['released'],
      'enabled': parseInt(document.getElementById('sla-enabled').value) || SLAConfig.DEFAULT_THRESHOLDS['enabled'],
      'paused': parseInt(document.getElementById('sla-paused').value) || SLAConfig.DEFAULT_THRESHOLDS['paused'],
      'default': parseInt(document.getElementById('sla-default').value) || SLAConfig.DEFAULT_THRESHOLDS['default']
    };
  }
  
  /**
   * Save settings to local storage and update current thresholds
   */
  saveSettings() {
    this.thresholds = this.getUIValues();
    this.saveToLocalStorage();
    this.updateCurrentSLADisplay();
    
    // Show success message
    ErrorHandler.handle('SLA settings saved successfully!', '', true, 'info');
    
    // Trigger reanalyze if data exists
    if (window.app && window.app.epicsData && window.app.epicsData.length > 0) {
      window.app.reanalyzeWithNewSLA();
    }
  }
  
  /**
   * Reset to default values
   */
  resetToDefaults() {
    this.thresholds = { ...SLAConfig.DEFAULT_THRESHOLDS };
    this.updateUIValues();
    this.saveToLocalStorage();
    this.updateCurrentSLADisplay();
    
    // Show success message
    ErrorHandler.handle('SLA settings reset to defaults!', '', true, 'info');
    
    // Trigger reanalyze if data exists
    if (window.app && window.app.epicsData && window.app.epicsData.length > 0) {
      window.app.reanalyzeWithNewSLA();
    }
  }
  
  /**
   * Save thresholds to local storage
   */
  saveToLocalStorage() {
    localStorage.setItem('jiraAnalyzerSLAThresholds', JSON.stringify(this.thresholds));
  }
  
  /**
   * Load thresholds from local storage
   */
  loadFromLocalStorage() {
    const stored = localStorage.getItem('jiraAnalyzerSLAThresholds');
    if (stored) {
      try {
        this.thresholds = JSON.parse(stored);
      } catch (e) {
        console.error('Error loading SLA settings from local storage:', e);
        this.thresholds = { ...SLAConfig.DEFAULT_THRESHOLDS };
      }
    }
  }
  
  /**
   * Get current thresholds
   */
  getThresholds() {
    return this.thresholds;
  }
  
  /**
   * Update the current SLA display in the info panel
   */
  updateCurrentSLADisplay() {
    const displayElement = document.getElementById('currentSLADisplay');
    if (!displayElement) return;
    
    displayElement.innerHTML = `
      <div class="sla-item">
        <span class="sla-label">To Do:</span>
        <span class="sla-value">${this.thresholds['to do']} days</span>
      </div>
      <div class="sla-item">
        <span class="sla-label">Researching:</span>
        <span class="sla-value">${this.thresholds['researching']} days</span>
      </div>
      <div class="sla-item">
        <span class="sla-label">Ready for Story Refinement:</span>
        <span class="sla-value">${this.thresholds['ready for story refinement']} days</span>
      </div>
      <div class="sla-item">
        <span class="sla-label">Ready to Develop:</span>
        <span class="sla-value">${this.thresholds['ready to develop']} days</span>
      </div>
      <div class="sla-item">
        <span class="sla-label">In Progress:</span>
        <span class="sla-value">${this.thresholds['in progress']} days</span>
      </div>
      <div class="sla-item">
        <span class="sla-label">Released:</span>
        <span class="sla-value">${this.thresholds['released']} days</span>
      </div>
      <div class="sla-item">
        <span class="sla-label">Enabled:</span>
        <span class="sla-value">${this.thresholds['enabled']} days</span>
      </div>
      <div class="sla-item">
        <span class="sla-label">Paused:</span>
        <span class="sla-value">${this.thresholds['paused']} days</span>
      </div>
      <div class="sla-item">
        <span class="sla-label">Any Other Status:</span>
        <span class="sla-value">${this.thresholds['default']} days</span>
      </div>
    `;
  }
}

// Make SLAConfig available globally
window.SLAConfig = SLAConfig;