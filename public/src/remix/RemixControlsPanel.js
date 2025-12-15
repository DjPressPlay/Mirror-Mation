/**
 * Remix Controls Panel
 *
 * UI component for controlling GIF remix settings:
 * - Motion intensity (more/less motion)
 * - Smoothness (smooth/glitchy)
 * - Speed control
 * - Style presets
 * - Loop type selection
 */

import { RemixStylePresets } from './GifRemixAI.js';

export class RemixControlsPanel {
  constructor(container) {
    this.container = container;
    this.settings = {
      motionIntensity: 0.5,
      smoothness: 0.5,
      speed: 1.0,
      styleInfluence: 0.7,
      loopType: 'seamless',
      stylePreset: null
    };

    // Callbacks
    this.onSettingsChange = null;
    this.onGenerate = null;
    this.onExport = null;

    this.initialize();
  }

  /**
   * Initialize the controls panel
   */
  initialize() {
    this.createControlsUI();
    this.setupEventListeners();
  }

  /**
   * Create the controls UI
   */
  createControlsUI() {
    this.container.innerHTML = `
      <div class="remix-controls-panel">
        <!-- Header -->
        <div class="controls-header">
          <h3 class="controls-title">Remix Controls</h3>
          <span class="controls-subtitle">Adjust how your GIF is regenerated</span>
        </div>

        <!-- Motion Section -->
        <div class="control-section">
          <div class="control-header">
            <label class="control-label">Motion Intensity</label>
            <span class="control-value motion-value">50%</span>
          </div>
          <div class="slider-container">
            <span class="slider-label-left">Less Motion</span>
            <input type="range" class="remix-slider motion-slider" min="0" max="100" value="50">
            <span class="slider-label-right">More Motion</span>
          </div>
          <p class="control-hint">Controls the amount of movement in generated frames</p>
        </div>

        <!-- Smoothness Section -->
        <div class="control-section">
          <div class="control-header">
            <label class="control-label">Smoothness</label>
            <span class="control-value smoothness-value">50%</span>
          </div>
          <div class="slider-container">
            <span class="slider-label-left">Glitchy</span>
            <input type="range" class="remix-slider smoothness-slider" min="0" max="100" value="50">
            <span class="slider-label-right">Smooth</span>
          </div>
          <p class="control-hint">Lower values add glitch effects, higher values create fluid transitions</p>
        </div>

        <!-- Speed Section -->
        <div class="control-section">
          <div class="control-header">
            <label class="control-label">Speed</label>
            <span class="control-value speed-value">1.0x</span>
          </div>
          <div class="slider-container">
            <span class="slider-label-left">Slower</span>
            <input type="range" class="remix-slider speed-slider" min="25" max="200" value="100">
            <span class="slider-label-right">Faster</span>
          </div>
        </div>

        <!-- Style Influence Section -->
        <div class="control-section">
          <div class="control-header">
            <label class="control-label">Style Match</label>
            <span class="control-value style-influence-value">70%</span>
          </div>
          <div class="slider-container">
            <span class="slider-label-left">Creative</span>
            <input type="range" class="remix-slider style-influence-slider" min="0" max="100" value="70">
            <span class="slider-label-right">Faithful</span>
          </div>
          <p class="control-hint">How closely to match the original GIF's style</p>
        </div>

        <!-- Style Presets -->
        <div class="control-section">
          <label class="control-label">Style Preset</label>
          <div class="style-presets-grid">
            <button class="style-preset-btn" data-preset="none">
              <span class="preset-icon">🎨</span>
              <span class="preset-name">None</span>
            </button>
            <button class="style-preset-btn" data-preset="vaporwave">
              <span class="preset-icon">🌴</span>
              <span class="preset-name">Vaporwave</span>
            </button>
            <button class="style-preset-btn" data-preset="cartoon">
              <span class="preset-icon">🎬</span>
              <span class="preset-name">Cartoon</span>
            </button>
            <button class="style-preset-btn" data-preset="anime">
              <span class="preset-icon">🌸</span>
              <span class="preset-name">Anime</span>
            </button>
            <button class="style-preset-btn" data-preset="pixel">
              <span class="preset-icon">👾</span>
              <span class="preset-name">Pixel Art</span>
            </button>
            <button class="style-preset-btn" data-preset="glitch">
              <span class="preset-icon">📺</span>
              <span class="preset-name">Glitch</span>
            </button>
            <button class="style-preset-btn" data-preset="dreamy">
              <span class="preset-icon">☁️</span>
              <span class="preset-name">Dreamy</span>
            </button>
            <button class="style-preset-btn" data-preset="neon">
              <span class="preset-icon">💡</span>
              <span class="preset-name">Neon</span>
            </button>
          </div>
        </div>

        <!-- Loop Type -->
        <div class="control-section">
          <label class="control-label">Loop Type</label>
          <div class="loop-type-options">
            <button class="loop-type-btn active" data-loop="seamless" title="Smooth cross-fade loop">
              <span class="loop-icon">🔄</span>
              <span>Seamless</span>
            </button>
            <button class="loop-type-btn" data-loop="bounce" title="Forward then reverse">
              <span class="loop-icon">↔️</span>
              <span>Bounce</span>
            </button>
            <button class="loop-type-btn" data-loop="normal" title="Standard loop">
              <span class="loop-icon">➡️</span>
              <span>Normal</span>
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="control-actions">
          <button class="action-btn generate-btn" id="remixGenerateBtn">
            <span class="btn-icon">✨</span>
            <span class="btn-text">Generate Remix</span>
          </button>
          <button class="action-btn export-btn" id="remixExportBtn" disabled>
            <span class="btn-icon">📥</span>
            <span class="btn-text">Export GIF</span>
          </button>
        </div>

        <!-- Progress Indicator -->
        <div class="remix-progress" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <span class="progress-text">Preparing...</span>
          <button class="cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    // Store element references
    this.ui = {
      motionSlider: this.container.querySelector('.motion-slider'),
      motionValue: this.container.querySelector('.motion-value'),
      smoothnessSlider: this.container.querySelector('.smoothness-slider'),
      smoothnessValue: this.container.querySelector('.smoothness-value'),
      speedSlider: this.container.querySelector('.speed-slider'),
      speedValue: this.container.querySelector('.speed-value'),
      styleInfluenceSlider: this.container.querySelector('.style-influence-slider'),
      styleInfluenceValue: this.container.querySelector('.style-influence-value'),
      stylePresetBtns: this.container.querySelectorAll('.style-preset-btn'),
      loopTypeBtns: this.container.querySelectorAll('.loop-type-btn'),
      generateBtn: this.container.querySelector('.generate-btn'),
      exportBtn: this.container.querySelector('.export-btn'),
      progressContainer: this.container.querySelector('.remix-progress'),
      progressBar: this.container.querySelector('.progress-fill'),
      progressText: this.container.querySelector('.progress-text'),
      cancelBtn: this.container.querySelector('.cancel-btn')
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Motion slider
    this.ui.motionSlider?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.settings.motionIntensity = value / 100;
      this.ui.motionValue.textContent = `${value}%`;
      this.notifySettingsChange();
    });

    // Smoothness slider
    this.ui.smoothnessSlider?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.settings.smoothness = value / 100;
      this.ui.smoothnessValue.textContent = `${value}%`;
      this.notifySettingsChange();
    });

    // Speed slider
    this.ui.speedSlider?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.settings.speed = value / 100;
      this.ui.speedValue.textContent = `${(value / 100).toFixed(1)}x`;
      this.notifySettingsChange();
    });

    // Style influence slider
    this.ui.styleInfluenceSlider?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      this.settings.styleInfluence = value / 100;
      this.ui.styleInfluenceValue.textContent = `${value}%`;
      this.notifySettingsChange();
    });

    // Style preset buttons
    this.ui.stylePresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectStylePreset(btn.dataset.preset);
      });
    });

    // Loop type buttons
    this.ui.loopTypeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectLoopType(btn.dataset.loop);
      });
    });

    // Generate button
    this.ui.generateBtn?.addEventListener('click', () => {
      if (this.onGenerate) {
        this.onGenerate(this.getSettings());
      }
    });

    // Export button
    this.ui.exportBtn?.addEventListener('click', () => {
      if (this.onExport) {
        this.onExport(this.getSettings());
      }
    });

    // Cancel button
    this.ui.cancelBtn?.addEventListener('click', () => {
      if (this.onCancel) {
        this.onCancel();
      }
    });
  }

  /**
   * Select a style preset
   */
  selectStylePreset(presetId) {
    // Update button states
    this.ui.stylePresetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === presetId);
    });

    if (presetId === 'none') {
      this.settings.stylePreset = null;
    } else {
      const preset = RemixStylePresets[presetId];
      if (preset) {
        this.settings.stylePreset = presetId;

        // Apply preset settings to sliders
        if (preset.settings.smoothness !== undefined) {
          const smoothnessValue = Math.round(preset.settings.smoothness * 100);
          this.ui.smoothnessSlider.value = smoothnessValue;
          this.ui.smoothnessValue.textContent = `${smoothnessValue}%`;
          this.settings.smoothness = preset.settings.smoothness;
        }

        if (preset.settings.styleInfluence !== undefined) {
          const styleValue = Math.round(preset.settings.styleInfluence * 100);
          this.ui.styleInfluenceSlider.value = styleValue;
          this.ui.styleInfluenceValue.textContent = `${styleValue}%`;
          this.settings.styleInfluence = preset.settings.styleInfluence;
        }

        if (preset.settings.motionIntensity !== undefined) {
          const motionValue = Math.round(preset.settings.motionIntensity * 100);
          this.ui.motionSlider.value = motionValue;
          this.ui.motionValue.textContent = `${motionValue}%`;
          this.settings.motionIntensity = preset.settings.motionIntensity;
        }
      }
    }

    this.notifySettingsChange();
  }

  /**
   * Select a loop type
   */
  selectLoopType(loopType) {
    this.ui.loopTypeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.loop === loopType);
    });

    this.settings.loopType = loopType;
    this.notifySettingsChange();
  }

  /**
   * Get current settings
   */
  getSettings() {
    const settings = { ...this.settings };

    // Add style preset prompt if selected
    if (this.settings.stylePreset && RemixStylePresets[this.settings.stylePreset]) {
      settings.stylePrompt = RemixStylePresets[this.settings.stylePreset].prompt;
    }

    return settings;
  }

  /**
   * Update settings programmatically
   */
  updateSettings(newSettings) {
    if (newSettings.motionIntensity !== undefined) {
      const value = Math.round(newSettings.motionIntensity * 100);
      this.settings.motionIntensity = newSettings.motionIntensity;
      this.ui.motionSlider.value = value;
      this.ui.motionValue.textContent = `${value}%`;
    }

    if (newSettings.smoothness !== undefined) {
      const value = Math.round(newSettings.smoothness * 100);
      this.settings.smoothness = newSettings.smoothness;
      this.ui.smoothnessSlider.value = value;
      this.ui.smoothnessValue.textContent = `${value}%`;
    }

    if (newSettings.speed !== undefined) {
      const value = Math.round(newSettings.speed * 100);
      this.settings.speed = newSettings.speed;
      this.ui.speedSlider.value = value;
      this.ui.speedValue.textContent = `${newSettings.speed.toFixed(1)}x`;
    }

    if (newSettings.styleInfluence !== undefined) {
      const value = Math.round(newSettings.styleInfluence * 100);
      this.settings.styleInfluence = newSettings.styleInfluence;
      this.ui.styleInfluenceSlider.value = value;
      this.ui.styleInfluenceValue.textContent = `${value}%`;
    }

    if (newSettings.loopType !== undefined) {
      this.selectLoopType(newSettings.loopType);
    }
  }

  /**
   * Show progress indicator
   */
  showProgress(percent = 0, message = 'Processing...') {
    this.ui.progressContainer.style.display = 'block';
    this.ui.progressBar.style.width = `${percent}%`;
    this.ui.progressText.textContent = message;
    this.ui.generateBtn.disabled = true;
  }

  /**
   * Update progress
   */
  updateProgress(percent, message) {
    this.ui.progressBar.style.width = `${percent}%`;
    if (message) {
      this.ui.progressText.textContent = message;
    }
  }

  /**
   * Hide progress indicator
   */
  hideProgress() {
    this.ui.progressContainer.style.display = 'none';
    this.ui.generateBtn.disabled = false;
  }

  /**
   * Enable/disable export button
   */
  setExportEnabled(enabled) {
    this.ui.exportBtn.disabled = !enabled;
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks) {
    if (callbacks.onSettingsChange) this.onSettingsChange = callbacks.onSettingsChange;
    if (callbacks.onGenerate) this.onGenerate = callbacks.onGenerate;
    if (callbacks.onExport) this.onExport = callbacks.onExport;
    if (callbacks.onCancel) this.onCancel = callbacks.onCancel;
  }

  /**
   * Notify settings change
   */
  notifySettingsChange() {
    if (this.onSettingsChange) {
      this.onSettingsChange(this.getSettings());
    }
  }

  /**
   * Reset to defaults
   */
  reset() {
    this.settings = {
      motionIntensity: 0.5,
      smoothness: 0.5,
      speed: 1.0,
      styleInfluence: 0.7,
      loopType: 'seamless',
      stylePreset: null
    };

    this.ui.motionSlider.value = 50;
    this.ui.motionValue.textContent = '50%';
    this.ui.smoothnessSlider.value = 50;
    this.ui.smoothnessValue.textContent = '50%';
    this.ui.speedSlider.value = 100;
    this.ui.speedValue.textContent = '1.0x';
    this.ui.styleInfluenceSlider.value = 70;
    this.ui.styleInfluenceValue.textContent = '70%';

    this.selectLoopType('seamless');
    this.selectStylePreset('none');
    this.hideProgress();
    this.setExportEnabled(false);
  }
}
