/**
 * RemixViewer - Side-by-Side Dual Timeline Viewer
 *
 * Displays the original Giphy GIF alongside the AI-generated remix
 * with synchronized playback and comparison tools.
 */

export class RemixViewer {
  constructor(container) {
    this.container = container;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.currentFrameIndex = 0;
    this.animationFrameId = null;
    this.lastFrameTime = 0;

    // Source and generated data
    this.sourceFrames = [];
    this.sourceDelays = [];
    this.generatedFrames = [];
    this.generatedDelays = [];

    // Canvas elements (will be created)
    this.sourceCanvas = null;
    this.sourceCtx = null;
    this.generatedCanvas = null;
    this.generatedCtx = null;

    // Callbacks
    this.onFrameChange = null;
    this.onPlayStateChange = null;

    this.initialize();
  }

  /**
   * Initialize the viewer UI
   */
  initialize() {
    this.createViewerUI();
    this.setupEventListeners();
  }

  /**
   * Create the side-by-side viewer UI
   */
  createViewerUI() {
    this.container.innerHTML = `
      <div class="remix-viewer">
        <!-- Source (Reference) Panel -->
        <div class="remix-panel source-panel">
          <div class="panel-header">
            <span class="panel-title">Original GIF</span>
            <span class="panel-badge reference">Reference</span>
          </div>
          <div class="panel-canvas-container">
            <canvas class="remix-canvas source-canvas"></canvas>
            <div class="canvas-placeholder">
              <span class="placeholder-icon">🎬</span>
              <span>Select a GIF to remix</span>
            </div>
          </div>
          <div class="panel-info source-info">
            <span class="info-item frame-counter">0 / 0</span>
            <span class="info-item dimensions">--</span>
          </div>
        </div>

        <!-- Sync Controls -->
        <div class="remix-sync-controls">
          <button class="sync-btn play-btn" title="Play/Pause">
            <span class="play-icon">▶</span>
          </button>
          <div class="sync-indicator">
            <div class="sync-line"></div>
          </div>
          <button class="sync-btn regenerate-btn" title="Regenerate Frame">
            <span>🔄</span>
          </button>
        </div>

        <!-- Generated (Output) Panel -->
        <div class="remix-panel generated-panel">
          <div class="panel-header">
            <span class="panel-title">AI Remixed GIF</span>
            <span class="panel-badge output">Output</span>
          </div>
          <div class="panel-canvas-container">
            <canvas class="remix-canvas generated-canvas"></canvas>
            <div class="canvas-placeholder generated-placeholder">
              <span class="placeholder-icon">✨</span>
              <span>AI-generated frames will appear here</span>
            </div>
          </div>
          <div class="panel-info generated-info">
            <span class="info-item frame-counter">0 / 0</span>
            <span class="info-item dimensions">--</span>
          </div>
        </div>
      </div>

      <!-- Playback Controls Bar -->
      <div class="remix-controls-bar">
        <div class="timeline-scrubber">
          <input type="range" class="frame-scrubber" min="0" max="100" value="0">
          <div class="scrubber-markers"></div>
        </div>
        <div class="playback-controls">
          <button class="control-btn prev-frame-btn" title="Previous Frame">⏮</button>
          <button class="control-btn play-pause-btn" title="Play/Pause">▶</button>
          <button class="control-btn next-frame-btn" title="Next Frame">⏭</button>
          <select class="speed-select">
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>
    `;

    // Get canvas references
    this.sourceCanvas = this.container.querySelector('.source-canvas');
    this.sourceCtx = this.sourceCanvas.getContext('2d');
    this.generatedCanvas = this.container.querySelector('.generated-canvas');
    this.generatedCtx = this.generatedCanvas.getContext('2d');

    // Store UI element references
    this.ui = {
      playBtn: this.container.querySelector('.play-btn'),
      playPauseBtn: this.container.querySelector('.play-pause-btn'),
      prevFrameBtn: this.container.querySelector('.prev-frame-btn'),
      nextFrameBtn: this.container.querySelector('.next-frame-btn'),
      regenerateBtn: this.container.querySelector('.regenerate-btn'),
      frameScrubber: this.container.querySelector('.frame-scrubber'),
      speedSelect: this.container.querySelector('.speed-select'),
      sourceInfo: this.container.querySelector('.source-info'),
      generatedInfo: this.container.querySelector('.generated-info'),
      sourcePlaceholder: this.container.querySelector('.source-panel .canvas-placeholder'),
      generatedPlaceholder: this.container.querySelector('.generated-placeholder')
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Play/Pause buttons
    this.ui.playBtn?.addEventListener('click', () => this.togglePlayback());
    this.ui.playPauseBtn?.addEventListener('click', () => this.togglePlayback());

    // Frame navigation
    this.ui.prevFrameBtn?.addEventListener('click', () => this.prevFrame());
    this.ui.nextFrameBtn?.addEventListener('click', () => this.nextFrame());

    // Frame scrubber
    this.ui.frameScrubber?.addEventListener('input', (e) => {
      const maxFrames = Math.max(this.sourceFrames.length, this.generatedFrames.length);
      if (maxFrames > 0) {
        const frameIndex = Math.round((e.target.value / 100) * (maxFrames - 1));
        this.goToFrame(frameIndex);
      }
    });

    // Speed select
    this.ui.speedSelect?.addEventListener('change', (e) => {
      this.playbackSpeed = parseFloat(e.target.value);
    });

    // Regenerate button
    this.ui.regenerateBtn?.addEventListener('click', () => {
      if (this.onRegenerateFrame) {
        this.onRegenerateFrame(this.currentFrameIndex);
      }
    });
  }

  /**
   * Set source frames from Giphy GIF
   * @param {Array} frames - Array of frame data URLs
   * @param {Array} delays - Array of frame delays in ms
   * @param {Object} metadata - Width, height, etc.
   */
  setSourceFrames(frames, delays, metadata = {}) {
    this.sourceFrames = frames;
    this.sourceDelays = delays.length > 0 ? delays : frames.map(() => 100);

    // Set canvas size
    if (metadata.width && metadata.height) {
      this.sourceCanvas.width = metadata.width;
      this.sourceCanvas.height = metadata.height;
    }

    // Hide placeholder, show canvas
    if (frames.length > 0) {
      this.ui.sourcePlaceholder.style.display = 'none';
      this.sourceCanvas.style.display = 'block';

      // Render first frame
      this.renderSourceFrame(0);

      // Update info
      this.updateSourceInfo(metadata);
    }

    // Update scrubber max
    this.updateScrubberRange();
  }

  /**
   * Set generated frames
   * @param {Array} frames - Array of frame data URLs
   * @param {Array} delays - Array of frame delays in ms
   * @param {Object} metadata - Width, height, etc.
   */
  setGeneratedFrames(frames, delays, metadata = {}) {
    this.generatedFrames = frames;
    this.generatedDelays = delays.length > 0 ? delays : frames.map(() => 100);

    // Set canvas size
    if (metadata.width && metadata.height) {
      this.generatedCanvas.width = metadata.width;
      this.generatedCanvas.height = metadata.height;
    } else if (this.sourceCanvas.width) {
      this.generatedCanvas.width = this.sourceCanvas.width;
      this.generatedCanvas.height = this.sourceCanvas.height;
    }

    // Hide placeholder, show canvas
    if (frames.length > 0) {
      this.ui.generatedPlaceholder.style.display = 'none';
      this.generatedCanvas.style.display = 'block';

      // Render current frame
      this.renderGeneratedFrame(this.currentFrameIndex);

      // Update info
      this.updateGeneratedInfo(metadata);
    }

    // Update scrubber max
    this.updateScrubberRange();
  }

  /**
   * Add a single generated frame
   * @param {string} frameData - Frame data URL
   * @param {number} delay - Frame delay
   * @param {number} index - Frame index (or append)
   */
  addGeneratedFrame(frameData, delay = 100, index = -1) {
    if (index >= 0 && index < this.generatedFrames.length) {
      this.generatedFrames[index] = frameData;
      this.generatedDelays[index] = delay;
    } else {
      this.generatedFrames.push(frameData);
      this.generatedDelays.push(delay);
    }

    // Show canvas if hidden
    if (this.generatedFrames.length === 1) {
      this.ui.generatedPlaceholder.style.display = 'none';
      this.generatedCanvas.style.display = 'block';
    }

    // Render if this is the current frame
    if (index === this.currentFrameIndex || index < 0) {
      this.renderGeneratedFrame(this.generatedFrames.length - 1);
    }

    this.updateGeneratedInfo({
      frameCount: this.generatedFrames.length
    });

    this.updateScrubberRange();
  }

  /**
   * Render a source frame to canvas
   * @param {number} index - Frame index
   */
  renderSourceFrame(index) {
    if (index < 0 || index >= this.sourceFrames.length) return;

    const frameData = this.sourceFrames[index];
    this.renderFrameToCanvas(frameData, this.sourceCtx, this.sourceCanvas);

    // Update frame counter
    const counter = this.ui.sourceInfo.querySelector('.frame-counter');
    if (counter) {
      counter.textContent = `${index + 1} / ${this.sourceFrames.length}`;
    }
  }

  /**
   * Render a generated frame to canvas
   * @param {number} index - Frame index
   */
  renderGeneratedFrame(index) {
    if (index < 0 || index >= this.generatedFrames.length) return;

    const frameData = this.generatedFrames[index];
    this.renderFrameToCanvas(frameData, this.generatedCtx, this.generatedCanvas);

    // Update frame counter
    const counter = this.ui.generatedInfo.querySelector('.frame-counter');
    if (counter) {
      counter.textContent = `${index + 1} / ${this.generatedFrames.length}`;
    }
  }

  /**
   * Render frame data to a canvas
   * @param {string} frameData - Data URL or canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {HTMLCanvasElement} canvas - Canvas element
   */
  renderFrameToCanvas(frameData, ctx, canvas) {
    if (!frameData || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (typeof frameData === 'string') {
      // Data URL - load as image
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = frameData;
    } else if (frameData instanceof HTMLCanvasElement) {
      // Canvas element
      ctx.drawImage(frameData, 0, 0, canvas.width, canvas.height);
    }
  }

  /**
   * Go to a specific frame
   * @param {number} index - Frame index
   */
  goToFrame(index) {
    const maxFrames = Math.max(this.sourceFrames.length, this.generatedFrames.length);
    if (maxFrames === 0) return;

    this.currentFrameIndex = Math.max(0, Math.min(index, maxFrames - 1));

    // Render both panels
    if (this.sourceFrames.length > 0) {
      const sourceIndex = this.currentFrameIndex % this.sourceFrames.length;
      this.renderSourceFrame(sourceIndex);
    }

    if (this.generatedFrames.length > 0) {
      const genIndex = this.currentFrameIndex % this.generatedFrames.length;
      this.renderGeneratedFrame(genIndex);
    }

    // Update scrubber
    const scrubberValue = (this.currentFrameIndex / (maxFrames - 1)) * 100;
    this.ui.frameScrubber.value = scrubberValue;

    // Callback
    if (this.onFrameChange) {
      this.onFrameChange(this.currentFrameIndex);
    }
  }

  /**
   * Go to next frame
   */
  nextFrame() {
    const maxFrames = Math.max(this.sourceFrames.length, this.generatedFrames.length);
    if (maxFrames === 0) return;

    this.goToFrame((this.currentFrameIndex + 1) % maxFrames);
  }

  /**
   * Go to previous frame
   */
  prevFrame() {
    const maxFrames = Math.max(this.sourceFrames.length, this.generatedFrames.length);
    if (maxFrames === 0) return;

    this.goToFrame((this.currentFrameIndex - 1 + maxFrames) % maxFrames);
  }

  /**
   * Toggle playback
   */
  togglePlayback() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Start playback
   */
  play() {
    if (this.isPlaying) return;

    const maxFrames = Math.max(this.sourceFrames.length, this.generatedFrames.length);
    if (maxFrames === 0) return;

    this.isPlaying = true;
    this.lastFrameTime = performance.now();

    // Update button icons
    this.updatePlayButtons(true);

    // Start animation loop
    this.animate();

    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }
  }

  /**
   * Pause playback
   */
  pause() {
    this.isPlaying = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Update button icons
    this.updatePlayButtons(false);

    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }
  }

  /**
   * Animation loop
   */
  animate() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;

    // Get delay for current frame
    const sourceDelay = this.sourceDelays[this.currentFrameIndex % this.sourceDelays.length] || 100;
    const adjustedDelay = sourceDelay / this.playbackSpeed;

    if (elapsed >= adjustedDelay) {
      this.lastFrameTime = now;
      this.nextFrame();
    }

    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  /**
   * Update play button icons
   * @param {boolean} playing - Whether playing
   */
  updatePlayButtons(playing) {
    const icon = playing ? '⏸' : '▶';

    if (this.ui.playBtn) {
      this.ui.playBtn.querySelector('.play-icon').textContent = icon;
    }
    if (this.ui.playPauseBtn) {
      this.ui.playPauseBtn.textContent = icon;
    }
  }

  /**
   * Update source panel info
   * @param {Object} metadata - Source metadata
   */
  updateSourceInfo(metadata) {
    const dimensions = this.ui.sourceInfo.querySelector('.dimensions');
    if (dimensions && metadata.width && metadata.height) {
      dimensions.textContent = `${metadata.width}×${metadata.height}`;
    }
  }

  /**
   * Update generated panel info
   * @param {Object} metadata - Generated metadata
   */
  updateGeneratedInfo(metadata) {
    const dimensions = this.ui.generatedInfo.querySelector('.dimensions');
    if (dimensions && metadata.width && metadata.height) {
      dimensions.textContent = `${metadata.width}×${metadata.height}`;
    } else if (dimensions && metadata.frameCount) {
      dimensions.textContent = `${metadata.frameCount} frames`;
    }
  }

  /**
   * Update scrubber range
   */
  updateScrubberRange() {
    const maxFrames = Math.max(this.sourceFrames.length, this.generatedFrames.length);
    // Keep range 0-100, we'll calculate frame from percentage
    this.ui.frameScrubber.max = 100;
  }

  /**
   * Clear generated frames
   */
  clearGenerated() {
    this.generatedFrames = [];
    this.generatedDelays = [];

    this.generatedCtx.clearRect(0, 0, this.generatedCanvas.width, this.generatedCanvas.height);

    this.ui.generatedPlaceholder.style.display = 'flex';
    this.generatedCanvas.style.display = 'none';

    const counter = this.ui.generatedInfo.querySelector('.frame-counter');
    if (counter) counter.textContent = '0 / 0';
  }

  /**
   * Clear all frames
   */
  clearAll() {
    this.pause();

    this.sourceFrames = [];
    this.sourceDelays = [];
    this.generatedFrames = [];
    this.generatedDelays = [];
    this.currentFrameIndex = 0;

    // Clear canvases
    this.sourceCtx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    this.generatedCtx.clearRect(0, 0, this.generatedCanvas.width, this.generatedCanvas.height);

    // Show placeholders
    this.ui.sourcePlaceholder.style.display = 'flex';
    this.ui.generatedPlaceholder.style.display = 'flex';
    this.sourceCanvas.style.display = 'none';
    this.generatedCanvas.style.display = 'none';

    // Reset info
    const sourceCounter = this.ui.sourceInfo.querySelector('.frame-counter');
    const genCounter = this.ui.generatedInfo.querySelector('.frame-counter');
    if (sourceCounter) sourceCounter.textContent = '0 / 0';
    if (genCounter) genCounter.textContent = '0 / 0';

    // Reset scrubber
    this.ui.frameScrubber.value = 0;
  }

  /**
   * Set callback for frame regeneration requests
   * @param {Function} callback - Callback function
   */
  setOnRegenerateFrame(callback) {
    this.onRegenerateFrame = callback;
  }

  /**
   * Get current frame index
   */
  getCurrentFrameIndex() {
    return this.currentFrameIndex;
  }

  /**
   * Get source frame at current index
   */
  getCurrentSourceFrame() {
    if (this.sourceFrames.length === 0) return null;
    return this.sourceFrames[this.currentFrameIndex % this.sourceFrames.length];
  }

  /**
   * Get generated frame at current index
   */
  getCurrentGeneratedFrame() {
    if (this.generatedFrames.length === 0) return null;
    return this.generatedFrames[this.currentFrameIndex % this.generatedFrames.length];
  }

  /**
   * Get all generated frames for export
   */
  getGeneratedFramesForExport() {
    return {
      frames: [...this.generatedFrames],
      delays: [...this.generatedDelays]
    };
  }

  /**
   * Destroy the viewer
   */
  destroy() {
    this.pause();
    this.container.innerHTML = '';
  }
}
