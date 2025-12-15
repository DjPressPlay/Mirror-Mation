import { SceneViewer } from './scene/SceneViewer.js';
import { CanvasEditor } from './canvas/CanvasEditor.js';
import { TimelineManager } from './timeline/TimelineManager.js';
import { AIService } from './ai/AIService.js';
import { GifEncoder } from './gif/GifEncoder.js';
import { GifLibrary } from './gif/GifLibrary.js';
import { AIBRoll } from './gif/AIBRoll.js';
import { GiphyService } from './giphy/GiphyService.js';
import { GifRemixManager, GifFrameExtractor, RemixViewer, GifRemixAI, RemixControlsPanel } from './remix/index.js';

class MirrorMationApp {
  constructor() {
    this.sceneViewer = null;
    this.canvasEditor = null;
    this.timelineManager = null;
    this.aiService = null;
    this.gifEncoder = null;
    this.gifLibrary = null;
    this.aiBRoll = null;
    this.giphyService = null;
    this.fileBin = [];
    this.notificationSystem = null;
    this.isGeneratingGif = false;

    // Remix module components
    this.remixManager = null;
    this.remixViewer = null;
    this.remixControls = null;
    this.remixAI = null;
    this.frameExtractor = null;
    this.remixGiphyResults = [];

    // Floating visualizer components
    this.floatingViewer = null;
    this.floatingControls = null;
    this.floatingGiphyResults = [];
    this.floatingGiphyOffset = 0;
    this.floatingGiphyQuery = '';

    // GIF Gallery state
    this.galleryGifs = [];
    this.selectedGalleryGifs = new Set();

    this.init();
  }

  init() {
    const sceneContainer = document.getElementById('previewCanvas');
    this.sceneViewer = new SceneViewer(sceneContainer.parentElement);
    
    sceneContainer.style.display = 'none';
    
    const canvasOverlay = document.getElementById('canvasOverlay');
    const paintCanvas = document.getElementById('paintCanvas');
    this.canvasEditor = new CanvasEditor(canvasOverlay, paintCanvas);
    
    const timelineElement = document.getElementById('timeline');
    this.timelineManager = new TimelineManager(timelineElement);
    
    this.notificationSystem = new NotificationSystem();

    this.aiService = new AIService();
    this.setupAIService();

    // Initialize GIF modules
    this.gifEncoder = new GifEncoder();
    this.gifLibrary = new GifLibrary();
    this.aiBRoll = new AIBRoll(this.aiService);
    this.setupGifModules();

    // Initialize Giphy service
    this.giphyService = new GiphyService();
    this.setupGiphyService();

    // Initialize Remix module
    this.initializeRemixModule();

    // Initialize Floating Visualizer
    this.initializeFloatingVisualizer();

    // Initialize GIF Gallery
    this.initializeGifGallery();

    this.setupEventListeners();
    this.connectModules();
    this.setupOverlayDragAndResize();
    this.setupGifLibraryUI();
  }

  initializeRemixModule() {
    // Initialize core remix components
    this.remixManager = new GifRemixManager();
    this.frameExtractor = new GifFrameExtractor();
    this.remixAI = new GifRemixAI(this.aiService);

    // Initialize viewer if container exists
    const viewerContainer = document.getElementById('remixViewerContainer');
    if (viewerContainer) {
      this.remixViewer = new RemixViewer(viewerContainer);
    }

    // Initialize controls if container exists
    const controlsContainer = document.getElementById('remixControlsContainer');
    if (controlsContainer) {
      this.remixControls = new RemixControlsPanel(controlsContainer);
      this.setupRemixControlsCallbacks();
    }

    // Setup remix manager callbacks
    this.setupRemixManagerCallbacks();

    // Setup remix mode button
    this.setupRemixModeButton();
  }

  setupRemixManagerCallbacks() {
    this.remixManager.setCallbacks({
      onSourceLoaded: (data) => {
        this.notificationSystem.notify('success', 'GIF Loaded', `${data.gif.title || 'GIF'} loaded for remixing`);
      },
      onFrameGenerated: (data) => {
        if (this.remixViewer) {
          this.remixViewer.addGeneratedFrame(data.frame, 100, data.index);
        }
        if (this.remixControls) {
          this.remixControls.setExportEnabled(true);
        }
      },
      onProgressUpdate: (data) => {
        if (this.remixControls) {
          this.remixControls.updateProgress(data.percent || 0, data.message);
        }
      },
      onError: (error) => {
        this.notificationSystem.notify('error', 'Remix Error', error.message);
        if (this.remixControls) {
          this.remixControls.hideProgress();
        }
      },
      onComplete: (data) => {
        this.notificationSystem.notify('success', 'Remix Complete', `Generated ${data.frameCount} frames`);
        if (this.remixControls) {
          this.remixControls.hideProgress();
          this.remixControls.setExportEnabled(true);
        }
      }
    });
  }

  setupRemixControlsCallbacks() {
    if (!this.remixControls) return;

    this.remixControls.setCallbacks({
      onSettingsChange: (settings) => {
        this.remixManager.updateSettings(settings);
      },
      onGenerate: async (settings) => {
        await this.generateRemix(settings);
      },
      onExport: async (settings) => {
        await this.exportRemixedGif(settings);
      },
      onCancel: () => {
        if (this.remixAI) {
          this.remixAI.abort();
        }
        this.remixControls.hideProgress();
      }
    });
  }

  setupRemixModeButton() {
    const remixBtn = document.getElementById('remixGifBtn');
    const remixOverlay = document.getElementById('remixModeOverlay');
    const closeRemixBtn = document.getElementById('closeRemixMode');
    const remixSearchInput = document.getElementById('remixSearchInput');

    if (remixBtn) {
      remixBtn.addEventListener('click', () => {
        this.openRemixMode();
      });
    }

    if (closeRemixBtn) {
      closeRemixBtn.addEventListener('click', () => {
        this.closeRemixMode();
      });
    }

    if (remixSearchInput) {
      remixSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchGifsForRemix(remixSearchInput.value);
        }
      });
    }
  }

  openRemixMode() {
    const remixOverlay = document.getElementById('remixModeOverlay');
    if (remixOverlay) {
      remixOverlay.classList.add('active');
      // Load trending GIFs for remix
      this.loadTrendingGifsForRemix();
    }
  }

  closeRemixMode() {
    const remixOverlay = document.getElementById('remixModeOverlay');
    if (remixOverlay) {
      remixOverlay.classList.remove('active');
    }
    // Reset remix state
    if (this.remixViewer) {
      this.remixViewer.clearAll();
    }
    if (this.remixControls) {
      this.remixControls.reset();
    }
    this.remixManager.reset();
  }

  async loadTrendingGifsForRemix() {
    try {
      const results = await this.giphyService.getTrending({ limit: 12 });
      this.remixGiphyResults = results;
      this.renderRemixGifResults(results);
    } catch (error) {
      console.error('Failed to load trending GIFs:', error);
    }
  }

  async searchGifsForRemix(query) {
    if (!query.trim()) {
      this.loadTrendingGifsForRemix();
      return;
    }

    try {
      const results = await this.giphyService.search(query, { limit: 12 });
      this.remixGiphyResults = results;
      this.renderRemixGifResults(results);
    } catch (error) {
      console.error('Failed to search GIFs:', error);
      this.notificationSystem.notify('error', 'Search Failed', error.message);
    }
  }

  renderRemixGifResults(results) {
    const container = document.getElementById('remixGifResults');
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #6b7280; padding: 2rem;">No GIFs found. Try a different search.</div>';
      return;
    }

    container.innerHTML = results.map(gif => `
      <div class="remix-gif-item" data-gif-id="${gif.id}">
        <img src="${gif.urls.preview || gif.urls.fixed_width}" alt="${gif.title}" loading="lazy">
        <div class="select-overlay">Select</div>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.remix-gif-item').forEach(item => {
      item.addEventListener('click', () => {
        const gifId = item.dataset.gifId;
        const gif = results.find(g => g.id === gifId);
        if (gif) {
          this.selectGifForRemix(gif);
        }
      });
    });
  }

  async selectGifForRemix(gif) {
    try {
      this.notificationSystem.notify('info', 'Loading GIF', 'Extracting frames...');

      // Load source GIF
      await this.remixManager.loadSourceGif(gif);

      // Extract frames from GIF
      const gifUrl = gif.urls.fixed_width || gif.urls.original;
      const extractResult = await this.frameExtractor.extractFromUrl(gifUrl);

      // Set frames in remix manager
      this.remixManager.setSourceFrames(extractResult.frames, {
        delays: extractResult.delays
      });

      // Update viewer with source frames
      if (this.remixViewer) {
        this.remixViewer.setSourceFrames(extractResult.frames, extractResult.delays, {
          width: extractResult.width,
          height: extractResult.height
        });
      }

      this.notificationSystem.notify('success', 'GIF Ready', `${extractResult.frameCount} frames extracted. Adjust settings and generate!`);

    } catch (error) {
      console.error('Failed to select GIF for remix:', error);
      this.notificationSystem.notify('error', 'Failed to Load GIF', error.message);
    }
  }

  async generateRemix(settings) {
    const sourceFrames = this.remixManager.getSourceFrames();
    if (sourceFrames.length === 0) {
      this.notificationSystem.notify('warning', 'No Source GIF', 'Please select a GIF to remix first.');
      return;
    }

    if (this.remixControls) {
      this.remixControls.showProgress(0, 'Starting remix generation...');
    }

    try {
      // Clear previous generated frames
      if (this.remixViewer) {
        this.remixViewer.clearGenerated();
      }
      this.remixManager.clearGeneratedFrames();

      // Setup AI callbacks for progress
      this.remixAI.setCallbacks({
        onProgress: (data) => {
          if (this.remixControls) {
            this.remixControls.updateProgress(data.percent, data.message);
          }
        },
        onFrameComplete: (data) => {
          // Add to manager and viewer
          this.remixManager.addGeneratedFrame(data.frame, data.index);
        },
        onError: (error) => {
          this.notificationSystem.notify('error', 'Generation Error', error.message);
        },
        onComplete: (data) => {
          if (this.remixControls) {
            this.remixControls.hideProgress();
            this.remixControls.setExportEnabled(true);
          }
          this.notificationSystem.notify('success', 'Remix Complete!', `Generated ${data.frameCount} frames`);

          // Update viewer with all generated frames
          if (this.remixViewer && data.frames) {
            this.remixViewer.setGeneratedFrames(data.frames, this.remixManager.calculateOutputTiming(), {
              width: 480,
              height: 270
            });
          }
        }
      });

      // Generate remix
      const result = await this.remixAI.generateRemix({
        sourceFrames,
        keyFrames: this.remixManager.getKeyFrames(3).map(kf => kf.index),
        settings,
        basePrompt: settings.stylePrompt || '',
        frameCount: sourceFrames.length
      });

      return result;

    } catch (error) {
      console.error('Remix generation error:', error);
      if (this.remixControls) {
        this.remixControls.hideProgress();
      }
      this.notificationSystem.notify('error', 'Remix Failed', error.message);
    }
  }

  async exportRemixedGif(settings) {
    const generatedFrames = this.remixManager.getGeneratedFrames();
    if (generatedFrames.length === 0) {
      this.notificationSystem.notify('warning', 'No Frames', 'Generate a remix first before exporting.');
      return;
    }

    this.notificationSystem.notify('info', 'Exporting', 'Creating your remixed GIF...');

    try {
      // Apply loop enhancement
      const loopType = settings.loopType || 'seamless';
      const enhancedFrames = this.aiBRoll.applyLoopEnhancement(generatedFrames, loopType);

      // Calculate FPS from speed setting
      const fps = Math.round(12 * (settings.speed || 1.0));

      // Show progress
      this.showGifProgress();

      // Encode GIF
      await this.gifEncoder.encode(enhancedFrames, {
        fps: fps,
        quality: 10,
        loop: true,
        width: 480,
        height: 270,
        seamless: loopType === 'seamless',
        dither: 'FloydSteinberg'
      });

      // The gifEncoder complete callback will handle saving and downloading

    } catch (error) {
      console.error('Export error:', error);
      this.hideGifProgress();
      this.notificationSystem.notify('error', 'Export Failed', error.message);
    }
  }

  setupGifModules() {
    // Setup GIF encoder callbacks
    this.gifEncoder.setProgressCallback((progress) => {
      const message = progress.phase === 'adding'
        ? `Adding frames: ${progress.current}/${progress.total}`
        : `Encoding GIF: ${progress.percent}%`;
      this.updateGifProgress(progress.percent, message);
    });

    this.gifEncoder.setCompleteCallback((result) => {
      this.isGeneratingGif = false;
      this.hideGifProgress();

      // Add to library
      const gif = this.gifLibrary.addGif({
        blob: result.blob,
        url: result.url,
        name: `GIF_${new Date().toLocaleTimeString().replace(/:/g, '-')}`,
        category: 'Custom',
        tags: ['created'],
        metadata: {
          frameCount: result.frameCount,
          fps: result.fps,
          duration: result.duration,
          width: 800,
          height: 500
        }
      });

      this.notificationSystem.notify('success', 'GIF Created!',
        `${result.frameCount} frames, ${result.duration}s duration, ${(result.size / 1024).toFixed(1)}KB`);

      // Auto-download
      GifEncoder.download(result.blob, `${gif.name}.gif`);

      this.renderGifLibrary();
    });

    this.gifEncoder.setErrorCallback((error) => {
      this.isGeneratingGif = false;
      this.hideGifProgress();
      this.notificationSystem.notify('error', 'GIF Error', error.message);
    });
  }

  setupGiphyService() {
    // Set up callbacks
    this.giphyService.setLoadingCallback((loading) => {
      const resultsContainer = document.getElementById('giphyResults');
      if (loading && resultsContainer) {
        resultsContainer.innerHTML = '<div class="giphy-loading">Loading GIFs...</div>';
      }
    });

    this.giphyService.setResultsCallback((results, meta) => {
      this.renderGiphyResults(results, meta);
    });

    this.giphyService.setErrorCallback((error) => {
      const resultsContainer = document.getElementById('giphyResults');
      if (resultsContainer) {
        resultsContainer.innerHTML = `<div class="giphy-loading">Error: ${error.message}</div>`;
      }
      this.notificationSystem.notify('error', 'Giphy Error', error.message);
    });
  }

  renderGiphyResults(results, meta) {
    const resultsContainer = document.getElementById('giphyResults');
    if (!resultsContainer) return;

    if (results.length === 0) {
      resultsContainer.innerHTML = '<div class="giphy-loading">No GIFs found. Try a different search!</div>';
      return;
    }

    resultsContainer.innerHTML = results.map(gif => `
      <div class="giphy-result-item" data-gif-id="${gif.id}">
        <img src="${gif.urls.preview || gif.urls.fixed_width}" alt="${gif.title}" loading="lazy">
        <div class="giphy-add-overlay">+</div>
      </div>
    `).join('');

    // Add click handlers for each GIF
    resultsContainer.querySelectorAll('.giphy-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const gifId = item.dataset.gifId;
        const gif = results.find(g => g.id === gifId);
        if (gif) {
          this.addGiphyGifToCanvas(gif);
        }
      });
    });
  }

  async addGiphyGifToCanvas(gif) {
    try {
      // Load the GIF as an image
      const result = await this.giphyService.loadGifAsImage(gif, 'fixed_width');

      // Check if canvas overlay is open
      const canvasOverlay = document.getElementById('canvasOverlay');
      if (!canvasOverlay.classList.contains('active')) {
        // Open the canvas overlay
        this.canvasEditor.show();
      }

      // Add the image to the canvas editor
      this.canvasEditor.loadImage(result.dataUrl);

      // Also add to file bin for reuse
      const fileItem = {
        id: Date.now() + Math.random(),
        name: `giphy_${gif.slug || gif.id}.png`,
        data: result.dataUrl,
        source: 'giphy',
        originalGif: gif
      };
      this.fileBin.push(fileItem);
      this.renderFileBin();

      this.notificationSystem.notify('success', 'GIF Added!', `"${gif.title}" has been added to the canvas`);

    } catch (error) {
      this.notificationSystem.notify('error', 'Failed to Load GIF', error.message);
    }
  }

  // ============================================
  // Floating GIF Visualizer Methods
  // ============================================

  initializeFloatingVisualizer() {
    const visualizer = document.getElementById('floatingGifVisualizer');
    const openBtn = document.getElementById('openVisualizerBtn');
    const closeBtn = document.getElementById('closeVisualizerBtn');
    const searchInput = document.getElementById('floatingGifSearchInput');
    const searchBtn = document.getElementById('floatingGifSearchBtn');
    const loadMoreBtn = document.getElementById('loadMoreGifsBtn');
    const dragHandle = document.getElementById('visualizerDragHandle');

    // Initialize viewer in floating container
    const viewerContainer = document.getElementById('floatingViewerContainer');
    if (viewerContainer) {
      this.floatingViewer = new RemixViewer(viewerContainer);
    }

    // Open/Close handlers
    if (openBtn) {
      openBtn.addEventListener('click', () => this.openFloatingVisualizer());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeFloatingVisualizer());
    }

    // Search handlers
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        const query = searchInput?.value || '';
        this.searchFloatingGifs(query);
      });
    }

    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.searchFloatingGifs(searchInput.value);
        }
      });
    }

    // Load more handler
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => this.loadMoreFloatingGifs());
    }

    // Make the visualizer draggable
    if (dragHandle && visualizer) {
      this.setupVisualizerDrag(dragHandle, visualizer);
    }
  }

  openFloatingVisualizer() {
    const visualizer = document.getElementById('floatingGifVisualizer');
    if (visualizer) {
      visualizer.classList.add('active');
      // Load trending GIFs when opening
      this.loadFloatingTrendingGifs();
    }
  }

  closeFloatingVisualizer() {
    const visualizer = document.getElementById('floatingGifVisualizer');
    if (visualizer) {
      visualizer.classList.remove('active');
    }
  }

  async loadFloatingTrendingGifs() {
    this.floatingGiphyQuery = '';
    this.floatingGiphyOffset = 0;

    try {
      const results = await this.giphyService.getTrending({ limit: 30, offset: 0 });
      this.floatingGiphyResults = results;
      this.renderFloatingGifResults(results, false);
    } catch (error) {
      console.error('Failed to load trending GIFs:', error);
      this.notificationSystem.notify('error', 'Load Failed', 'Could not load trending GIFs');
    }
  }

  async searchFloatingGifs(query) {
    this.floatingGiphyQuery = query;
    this.floatingGiphyOffset = 0;

    if (!query.trim()) {
      this.loadFloatingTrendingGifs();
      return;
    }

    try {
      const results = await this.giphyService.search(query, { limit: 30, offset: 0 });
      this.floatingGiphyResults = results;
      this.renderFloatingGifResults(results, false);
    } catch (error) {
      console.error('Failed to search GIFs:', error);
      this.notificationSystem.notify('error', 'Search Failed', error.message);
    }
  }

  async loadMoreFloatingGifs() {
    this.floatingGiphyOffset += 30;

    try {
      let results;
      if (this.floatingGiphyQuery) {
        results = await this.giphyService.search(this.floatingGiphyQuery, {
          limit: 30,
          offset: this.floatingGiphyOffset
        });
      } else {
        results = await this.giphyService.getTrending({
          limit: 30,
          offset: this.floatingGiphyOffset
        });
      }

      this.floatingGiphyResults = [...this.floatingGiphyResults, ...results];
      this.renderFloatingGifResults(results, true);

      this.notificationSystem.notify('info', 'More GIFs Loaded', `Loaded ${results.length} more GIFs`);
    } catch (error) {
      console.error('Failed to load more GIFs:', error);
      this.notificationSystem.notify('error', 'Load Failed', error.message);
    }
  }

  renderFloatingGifResults(results, append = false) {
    const container = document.getElementById('floatingGifResults');
    if (!container) return;

    if (!append) {
      container.innerHTML = '';
    }

    if (results.length === 0 && !append) {
      container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #6b7280; padding: 2rem;">No GIFs found. Try a different search.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();

    results.forEach(gif => {
      const item = document.createElement('div');
      item.className = 'floating-gif-item';
      item.dataset.gifId = gif.id;
      item.innerHTML = `
        <img src="${gif.urls.preview || gif.urls.fixed_width}" alt="${gif.title}" loading="lazy">
        <div class="select-badge">Select</div>
      `;

      item.addEventListener('click', () => {
        this.selectFloatingGif(gif);
      });

      fragment.appendChild(item);
    });

    container.appendChild(fragment);
  }

  async selectFloatingGif(gif) {
    try {
      this.notificationSystem.notify('info', 'Loading GIF', 'Extracting frames...');

      // Extract frames from GIF
      const gifUrl = gif.urls.fixed_width || gif.urls.original;
      const extractResult = await this.frameExtractor.extractFromUrl(gifUrl);

      // Update floating viewer with source frames
      if (this.floatingViewer) {
        this.floatingViewer.setSourceFrames(extractResult.frames, extractResult.delays, {
          width: extractResult.width,
          height: extractResult.height
        });
      }

      // Also set in remix manager for potential generation
      this.remixManager.loadSourceGif(gif);
      this.remixManager.setSourceFrames(extractResult.frames, {
        delays: extractResult.delays
      });

      this.notificationSystem.notify('success', 'GIF Ready', `${extractResult.frameCount} frames extracted`);

      // Add to gallery
      this.addGifToGallery({
        id: gif.id,
        title: gif.title,
        url: gif.urls.fixed_width || gif.urls.original,
        thumbnail: gif.urls.preview || gif.urls.thumbnail,
        source: 'giphy',
        frameCount: extractResult.frameCount,
        width: extractResult.width,
        height: extractResult.height
      });

    } catch (error) {
      console.error('Failed to select GIF:', error);
      this.notificationSystem.notify('error', 'Failed to Load GIF', error.message);
    }
  }

  setupVisualizerDrag(handle, element) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;

      isDragging = true;
      const rect = element.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      element.style.transition = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      element.style.left = `${startLeft + deltaX}px`;
      element.style.top = `${startTop + deltaY}px`;
      element.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  // ============================================
  // GIF Gallery Methods
  // ============================================

  initializeGifGallery() {
    const selectAllBtn = document.getElementById('selectAllGifsBtn');
    const exportSelectedBtn = document.getElementById('exportSelectedBtn');

    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => this.selectAllGalleryGifs());
    }

    if (exportSelectedBtn) {
      exportSelectedBtn.addEventListener('click', () => this.exportSelectedGalleryGifs());
    }

    // Load any existing GIFs from library
    this.syncGalleryWithLibrary();
  }

  syncGalleryWithLibrary() {
    const libraryGifs = this.gifLibrary.getGifsByCategory('All');
    libraryGifs.forEach(gif => {
      if (!this.galleryGifs.find(g => g.id === gif.id)) {
        this.galleryGifs.push({
          id: gif.id,
          title: gif.name,
          url: gif.url,
          thumbnail: gif.url,
          source: 'created',
          frameCount: gif.frameCount || gif.metadata?.frameCount,
          duration: gif.duration || gif.metadata?.duration
        });
      }
    });
    this.renderGifGallery();
  }

  addGifToGallery(gifData) {
    // Avoid duplicates
    if (this.galleryGifs.find(g => g.id === gifData.id)) {
      return;
    }

    this.galleryGifs.push({
      ...gifData,
      addedAt: Date.now()
    });

    this.renderGifGallery();
    this.notificationSystem.notify('success', 'Added to Gallery', `"${gifData.title}" added to your collection`);
  }

  removeGifFromGallery(gifId) {
    this.galleryGifs = this.galleryGifs.filter(g => g.id !== gifId);
    this.selectedGalleryGifs.delete(gifId);
    this.renderGifGallery();
  }

  toggleGalleryGifSelection(gifId) {
    if (this.selectedGalleryGifs.has(gifId)) {
      this.selectedGalleryGifs.delete(gifId);
    } else {
      this.selectedGalleryGifs.add(gifId);
    }
    this.renderGifGallery();
  }

  selectAllGalleryGifs() {
    if (this.selectedGalleryGifs.size === this.galleryGifs.length) {
      // Deselect all
      this.selectedGalleryGifs.clear();
    } else {
      // Select all
      this.galleryGifs.forEach(g => this.selectedGalleryGifs.add(g.id));
    }
    this.renderGifGallery();
  }

  async exportSelectedGalleryGifs() {
    if (this.selectedGalleryGifs.size === 0) {
      this.notificationSystem.notify('warning', 'No Selection', 'Select some GIFs to export first');
      return;
    }

    const selectedGifs = this.galleryGifs.filter(g => this.selectedGalleryGifs.has(g.id));

    this.notificationSystem.notify('info', 'Exporting', `Preparing ${selectedGifs.length} GIF(s) for download...`);

    // For now, just download them individually
    for (const gif of selectedGifs) {
      if (gif.url) {
        try {
          const response = await fetch(gif.url);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${gif.title || 'gif'}.gif`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Failed to download GIF:', error);
        }
      }
    }

    this.notificationSystem.notify('success', 'Export Complete', `Downloaded ${selectedGifs.length} GIF(s)`);
  }

  renderGifGallery() {
    const container = document.getElementById('gifGalleryDesktop');
    const countSpan = document.getElementById('galleryCount');

    if (!container) return;

    // Update count
    if (countSpan) {
      countSpan.textContent = `(${this.galleryGifs.length} GIF${this.galleryGifs.length !== 1 ? 's' : ''})`;
    }

    if (this.galleryGifs.length === 0) {
      container.innerHTML = `
        <div class="gif-gallery-empty">
          <div class="gif-gallery-empty-icon">🎬</div>
          <div class="gif-gallery-empty-title">Your GIF Gallery</div>
          <div class="gif-gallery-empty-desc">
            Create GIFs using the Remix feature or browse Giphy to add GIFs to your collection for editing and export.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.galleryGifs.map(gif => {
      const isSelected = this.selectedGalleryGifs.has(gif.id);
      return `
        <div class="gif-gallery-item ${isSelected ? 'selected' : ''}" data-gif-id="${gif.id}">
          <img src="${gif.thumbnail || gif.url}" alt="${gif.title}" loading="lazy">
          <div class="gif-gallery-item-overlay">
            <div class="gif-gallery-item-title">${gif.title || 'Untitled GIF'}</div>
            <div class="gif-gallery-item-meta">
              ${gif.frameCount ? gif.frameCount + ' frames' : ''}
              ${gif.source === 'giphy' ? ' • Giphy' : ' • Created'}
            </div>
          </div>
          <div class="gif-gallery-item-actions">
            <button class="gif-gallery-action-btn edit" title="Edit">✏️</button>
            <button class="gif-gallery-action-btn download" title="Download">⬇️</button>
            <button class="gif-gallery-action-btn delete" title="Remove">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Add event handlers
    container.querySelectorAll('.gif-gallery-item').forEach(item => {
      const gifId = item.dataset.gifId;

      // Click to select
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.gif-gallery-action-btn')) {
          this.toggleGalleryGifSelection(gifId);
        }
      });

      // Action buttons
      item.querySelector('.edit')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editGalleryGif(gifId);
      });

      item.querySelector('.download')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadGalleryGif(gifId);
      });

      item.querySelector('.delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeGifFromGallery(gifId);
      });
    });
  }

  async editGalleryGif(gifId) {
    const gif = this.galleryGifs.find(g => g.id === gifId);
    if (!gif) return;

    // Open the floating visualizer with this GIF
    this.openFloatingVisualizer();

    try {
      const extractResult = await this.frameExtractor.extractFromUrl(gif.url);

      if (this.floatingViewer) {
        this.floatingViewer.setSourceFrames(extractResult.frames, extractResult.delays, {
          width: extractResult.width,
          height: extractResult.height
        });
      }

      this.notificationSystem.notify('info', 'Editing GIF', `"${gif.title}" loaded for editing`);
    } catch (error) {
      this.notificationSystem.notify('error', 'Load Failed', error.message);
    }
  }

  async downloadGalleryGif(gifId) {
    const gif = this.galleryGifs.find(g => g.id === gifId);
    if (!gif || !gif.url) return;

    try {
      const response = await fetch(gif.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gif.title || 'gif'}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.notificationSystem.notify('success', 'Downloaded', `"${gif.title}" has been downloaded`);
    } catch (error) {
      this.notificationSystem.notify('error', 'Download Failed', error.message);
    }
  }

  setupAIService() {
    this.aiService.setProgressCallback((progress) => {
      this.notificationSystem.notify('info', 'AI Processing', progress.message);
    });

    this.aiService.setCompleteCallback((result) => {
      this.notificationSystem.notify('success', 'AI Complete', 'Frame generated successfully');
    });

    this.aiService.setErrorCallback((error) => {
      this.notificationSystem.notify('error', 'AI Error', 
        error.message || 'Failed to generate frame');
    });
  }

  connectModules() {
    // Simplified: Now using single timeline layer
    this.timelineManager.onLayerUpdate = (layerName, frames) => {
      this.sceneViewer.setLayerFrames(layerName, frames);
      this.notificationSystem.notify('success', 'Timeline Updated', `Timeline updated with ${frames.length} frame(s)`);
    };

    this.timelineManager.onFrameSelect = (layerName, frameIndex, frameData) => {
      this.sceneViewer.renderFrame(layerName, frameIndex);
      this.canvasEditor.startEditMode(layerName, frameIndex, frameData);
      this.updateEditModeUI();
    };

    this.canvasEditor.onFrameComplete = (layerName, frameData) => {
      this.timelineManager.addFrame(layerName, frameData);
      this.notificationSystem.notify('success', 'Frame Added', 'New frame added to timeline');
    };

    this.canvasEditor.onFrameUpdate = (layerName, frameIndex, frameData) => {
      this.timelineManager.updateFrame(layerName, frameIndex, frameData);
      this.sceneViewer.renderFrame(layerName, frameIndex);
      this.notificationSystem.notify('info', 'Frame Updated', `Frame ${frameIndex + 1} has been updated`);
    };

    // Expose section info getter for AI agent
    window.getTimelineSections = (layerName) => {
      return this.timelineManager.getAllSections(layerName || this.timelineManager.selectedLayer);
    };

    window.getTimelineFramesInSection = (layerName, sectionIndex) => {
      return this.timelineManager.getSectionInfo(layerName, sectionIndex);
    };
  }

  setupEventListeners() {
    // Layer system removed - simplified single timeline

    document.getElementById('playPreview').addEventListener('click', () => {
      if (this.timelineManager.isPlaying) {
        this.timelineManager.stop();
        this.notificationSystem.notify('info', 'Playback Stopped', 'Animation preview has been stopped');
      } else {
        this.timelineManager.play(this.sceneViewer);
        this.notificationSystem.notify('info', 'Playing Preview', 'Animation preview is now playing');
      }
    });
    
    document.getElementById('generateGIF').addEventListener('click', () => {
      this.generateGIF();
    });
    
    document.getElementById('frameRateSelect').addEventListener('change', (e) => {
      const fps = parseInt(e.target.value);
      const playbackSpeed = 1000 / fps;
      this.timelineManager.setPlaybackSpeed(playbackSpeed);
      this.notificationSystem.notify('info', 'Frame Rate Updated', `Animation playback set to ${fps} FPS`);
    });
    
    const defaultFps = 12;
    this.timelineManager.setPlaybackSpeed(1000 / defaultFps);
    
    this.setupCanvasEditorControls();
  }

  setupCanvasEditorControls() {
    const selectTool = document.getElementById('selectTool');
    const brushTool = document.getElementById('brushTool');
    const eraserTool = document.getElementById('eraserTool');
    const lineTool = document.getElementById('lineTool');
    const rectTool = document.getElementById('rectTool');
    const circleTool = document.getElementById('circleTool');
    const tools = [selectTool, brushTool, eraserTool, lineTool, rectTool, circleTool];
    
    tools.forEach(tool => {
      tool.addEventListener('click', (e) => {
        tools.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        if (e.target === selectTool) this.canvasEditor.setTool('select');
        else if (e.target === brushTool) this.canvasEditor.setTool('brush');
        else if (e.target === eraserTool) this.canvasEditor.setTool('eraser');
        else if (e.target === lineTool) this.canvasEditor.setTool('line');
        else if (e.target === rectTool) this.canvasEditor.setTool('rect');
        else if (e.target === circleTool) this.canvasEditor.setTool('circle');
      });
    });
    
    const colorPicker = document.getElementById('colorPicker');
    colorPicker.addEventListener('input', (e) => {
      this.canvasEditor.setBrushColor(e.target.value);
    });
    
    const brushSize = document.getElementById('brushSize');
    const brushSizeValue = document.getElementById('brushSizeValue');
    brushSize.addEventListener('input', (e) => {
      this.canvasEditor.setBrushSize(e.target.value);
      brushSizeValue.textContent = e.target.value + 'px';
    });
    
    document.getElementById('clearCanvas').addEventListener('click', () => {
      this.canvasEditor.clear();
      this.notificationSystem.notify('info', 'Canvas Cleared', 'Canvas has been cleared for a new page');
    });
    
    document.getElementById('undoBtn').addEventListener('click', () => {
      this.canvasEditor.undo();
      this.notificationSystem.notify('info', 'Undo', 'Last action has been undone');
    });
    
    document.getElementById('closePaint').addEventListener('click', async () => {
      if (this.canvasEditor.isEditMode()) {
        const confirmClose = await this.notificationSystem.confirm('Unsaved Changes', 'You have unsaved changes. Do you want to discard them?');
        if (!confirmClose) return;
        this.canvasEditor.cancelEdit();
      } else {
        this.canvasEditor.hide();
      }
      this.updateEditModeUI();
    });
    
    const zoomWrapper = document.querySelector('.canvas-zoom-wrapper');
    
    document.getElementById('zoomIn').addEventListener('click', () => {
      this.canvasEditor.zoomIn(zoomWrapper);
    });
    
    document.getElementById('zoomOut').addEventListener('click', () => {
      this.canvasEditor.zoomOut(zoomWrapper);
    });
    
    document.getElementById('panUp').addEventListener('click', () => {
      this.canvasEditor.panUp(50, zoomWrapper);
    });
    
    document.getElementById('panDown').addEventListener('click', () => {
      this.canvasEditor.panDown(50, zoomWrapper);
    });
    
    document.getElementById('panLeft').addEventListener('click', () => {
      this.canvasEditor.panLeft(50, zoomWrapper);
    });
    
    document.getElementById('panRight').addEventListener('click', () => {
      this.canvasEditor.panRight(50, zoomWrapper);
    });
    
    document.getElementById('panCenter').addEventListener('click', () => {
      this.canvasEditor.resetView(zoomWrapper);
    });
    
    document.getElementById('addFrameBtn').addEventListener('click', () => {
      this.canvasEditor.addFrameToTimeline();
    });
    
    document.getElementById('applyEditBtn').addEventListener('click', () => {
      this.canvasEditor.applyEdit();
      this.updateEditModeUI();
    });
    
    document.getElementById('cancelEditBtn').addEventListener('click', () => {
      this.canvasEditor.cancelEdit();
      this.updateEditModeUI();
    });
    
    const uploadImageBtn = document.getElementById('uploadImageBtn');
    uploadImageBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.onchange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
          files.forEach(file => this.addFileToFileBin(file));
          this.notificationSystem.notify('success', 'Images Uploaded', `${files.length} image(s) added to File Bin`);
        }
      };
      input.click();
    });

    this.setupFileBinDragAndDrop();

    this.setupCanvasMouseEvents();

    // Layer button removed - simplified single timeline
  }
  
  updateEditModeUI() {
    const isEditMode = this.canvasEditor.isEditMode();
    const editModeIndicator = document.getElementById('editModeIndicator');
    const editModeActions = document.getElementById('editModeActions');
    const addFrameBtn = document.getElementById('addFrameBtn');

    if (isEditMode) {
      const editInfo = this.canvasEditor.getEditModeInfo();
      editModeIndicator.style.display = 'flex';
      editModeActions.style.display = 'flex';
      addFrameBtn.style.display = 'none';

      const badge = editModeIndicator.querySelector('.edit-mode-badge');
      badge.textContent = `EDITING Frame ${editInfo.frameIndex + 1}`;
    } else {
      editModeIndicator.style.display = 'none';
      editModeActions.style.display = 'none';
      addFrameBtn.style.display = 'block';
    }
  }

  // Layer visuals no longer needed - single timeline
  updateLayerVisuals(layerType) {
    // No-op - layer system removed
  }

  // Layer buttons no longer needed - single timeline
  updateSidePanelLayerButtons(layerType) {
    // No-op - layer system removed
  }
  
  setupCanvasMouseEvents() {
    const paintCanvas = document.getElementById('paintCanvas');
    const zoomWrapper = document.querySelector('.canvas-zoom-wrapper');
    
    paintCanvas.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        return;
      }
      
      const rect = paintCanvas.getBoundingClientRect();
      const scaleX = paintCanvas.width / rect.width;
      const scaleY = paintCanvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      this.canvasEditor.startDrawing(x, y);
    });
    
    paintCanvas.addEventListener('mousemove', (e) => {
      if (!this.canvasEditor.isDrawing && !this.canvasEditor.draggingImageId && !this.canvasEditor.resizingImageId) return;
      
      const rect = paintCanvas.getBoundingClientRect();
      const scaleX = paintCanvas.width / rect.width;
      const scaleY = paintCanvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      this.canvasEditor.draw(x, y);
    });
    
    paintCanvas.addEventListener('mouseup', (e) => {
      const rect = paintCanvas.getBoundingClientRect();
      const scaleX = paintCanvas.width / rect.width;
      const scaleY = paintCanvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      
      this.canvasEditor.endDrawing(x, y);
    });
    
    paintCanvas.addEventListener('mouseleave', () => {
      this.canvasEditor.isDrawing = false;
      this.canvasEditor.draggingImageId = null;
      this.canvasEditor.resizingImageId = null;
    });
    
    paintCanvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.canvasEditor.zoomIn(zoomWrapper);
      } else {
        this.canvasEditor.zoomOut(zoomWrapper);
      }
    });
    
    const paintCanvasContainer = document.querySelector('.paint-canvas-container');
    
    paintCanvasContainer.addEventListener('mousedown', (e) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        this.canvasEditor.isPanning = true;
        this.canvasEditor.panStartX = e.clientX - this.canvasEditor.panX;
        this.canvasEditor.panStartY = e.clientY - this.canvasEditor.panY;
        paintCanvas.style.cursor = 'grab';
        e.preventDefault();
      }
    });
    
    paintCanvasContainer.addEventListener('mousemove', (e) => {
      if (this.canvasEditor.isPanning) {
        this.canvasEditor.panX = e.clientX - this.canvasEditor.panStartX;
        this.canvasEditor.panY = e.clientY - this.canvasEditor.panStartY;
        this.canvasEditor.updateCanvasTransform(zoomWrapper);
        paintCanvas.style.cursor = 'grabbing';
      }
    });
    
    paintCanvasContainer.addEventListener('mouseup', () => {
      if (this.canvasEditor.isPanning) {
        this.canvasEditor.isPanning = false;
        paintCanvas.style.cursor = 'crosshair';
      }
    });
    
    paintCanvasContainer.addEventListener('mouseleave', () => {
      if (this.canvasEditor.isPanning) {
        this.canvasEditor.isPanning = false;
        paintCanvas.style.cursor = 'crosshair';
      }
    });
  }

  // Layer button removed - no-op
  updateCanvasLayerButton() {
    // No-op - layer system removed
  }

  setupOverlayDragAndResize() {
    const overlay = document.getElementById('canvasOverlay');
    const dragHandle = document.querySelector('.canvas-top-bar');
    const resizeHandle = document.querySelector('.resize-handle');
    
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;
    
    dragHandle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) {
        return;
      }
      
      isDragging = true;
      const rect = overlay.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      
      overlay.style.transition = 'none';
      e.preventDefault();
    });
    
    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      const rect = overlay.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startWidth = rect.width;
      startHeight = rect.height;
      
      overlay.style.transition = 'none';
      e.preventDefault();
      e.stopPropagation();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        overlay.style.left = `${startLeft + deltaX}px`;
        overlay.style.top = `${startTop + deltaY}px`;
        overlay.style.transform = 'none';
      } else if (isResizing) {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        
        const newWidth = Math.max(450, Math.min(startWidth + deltaX, window.innerWidth * 0.95));
        const newHeight = Math.max(350, Math.min(startHeight + deltaY, window.innerHeight * 0.95));
        
        overlay.style.width = `${newWidth}px`;
        overlay.style.height = `${newHeight}px`;
        overlay.style.transform = 'none';
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
      }
    });
  }
  
  addFileToFileBin(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target.result;
      const fileItem = {
        id: Date.now() + Math.random(),
        name: file.name,
        data: imageData
      };
      
      this.fileBin.push(fileItem);
      this.renderFileBin();
    };
    reader.readAsDataURL(file);
  }
  
  renderFileBin() {
    const fileBinContainer = document.getElementById('fileBin');
    
    if (this.fileBin.length === 0) {
      fileBinContainer.innerHTML = '<div class="file-bin-empty">Upload images to see them here</div>';
      return;
    }
    
    fileBinContainer.innerHTML = '';
    
    this.fileBin.forEach(fileItem => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'file-bin-item';
      itemDiv.draggable = true;
      itemDiv.dataset.fileId = fileItem.id;
      
      const thumbnail = document.createElement('img');
      thumbnail.className = 'file-bin-thumbnail';
      thumbnail.src = fileItem.data;
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-bin-name';
      nameSpan.textContent = fileItem.name;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-bin-remove';
      removeBtn.textContent = '×';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        this.removeFileFromFileBin(fileItem.id);
      };
      
      itemDiv.appendChild(thumbnail);
      itemDiv.appendChild(nameSpan);
      itemDiv.appendChild(removeBtn);
      
      fileBinContainer.appendChild(itemDiv);
    });
  }
  
  removeFileFromFileBin(fileId) {
    this.fileBin = this.fileBin.filter(f => f.id !== fileId);
    this.renderFileBin();
  }
  
  setupFileBinDragAndDrop() {
    const fileBinContainer = document.getElementById('fileBin');
    const canvasOverlay = document.getElementById('canvasOverlay');
    let draggedFileId = null;
    
    fileBinContainer.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('file-bin-item')) {
        draggedFileId = e.target.dataset.fileId;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', draggedFileId);
      }
    });
    
    fileBinContainer.addEventListener('dragend', (e) => {
      if (e.target.classList.contains('file-bin-item')) {
        e.target.classList.remove('dragging');
        draggedFileId = null;
      }
    });
    
    canvasOverlay.addEventListener('dragover', (e) => {
      if (!canvasOverlay.classList.contains('active')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      canvasOverlay.classList.add('drag-over');
    });
    
    canvasOverlay.addEventListener('dragleave', (e) => {
      if (e.target === canvasOverlay) {
        canvasOverlay.classList.remove('drag-over');
      }
    });
    
    canvasOverlay.addEventListener('drop', (e) => {
      if (!canvasOverlay.classList.contains('active')) return;
      e.preventDefault();
      canvasOverlay.classList.remove('drag-over');

      const fileId = e.dataTransfer.getData('text/plain');
      if (fileId) {
        const fileItem = this.fileBin.find(f => f.id == fileId);
        if (fileItem) {
          this.canvasEditor.loadImage(fileItem.data);
        }
      }
    });
  }

  // ============================================
  // GIF Generation Methods
  // ============================================

  async generateGIF() {
    if (this.isGeneratingGif) {
      this.notificationSystem.notify('warning', 'Already Processing', 'A GIF is currently being generated.');
      return;
    }

    const maxFrames = this.timelineManager.getMaxFrameCount();
    if (maxFrames === 0) {
      this.notificationSystem.notify('warning', 'No Frames', 'Add some frames to the timeline first!');
      return;
    }

    this.isGeneratingGif = true;
    this.showGifProgress();

    try {
      // Collect composited frames from all layers
      const frames = await this.collectAllFrames();

      // Get loop settings
      const loopType = this.getSelectedLoopType();
      const enhancedFrames = this.aiBRoll.applyLoopEnhancement(frames, loopType);

      // Get FPS from selector
      const fps = parseInt(document.getElementById('frameRateSelect').value);

      // Check seamless option
      const seamless = document.getElementById('seamlessLoop')?.checked || false;

      // Generate GIF
      await this.gifEncoder.encode(enhancedFrames, {
        fps: fps,
        quality: 10,
        loop: true,
        width: 800,
        height: 500,
        seamless: seamless,
        dither: 'FloydSteinberg'
      });

    } catch (error) {
      this.isGeneratingGif = false;
      this.hideGifProgress();
      this.notificationSystem.notify('error', 'GIF Generation Failed', error.message);
    }
  }

  async collectAllFrames() {
    const frames = [];
    const maxFrames = this.timelineManager.getMaxFrameCount();

    for (let i = 0; i < maxFrames; i++) {
      // Render each layer at this frame index
      ['background', 'character', 'interaction'].forEach(layerName => {
        const layerFrames = this.timelineManager.getLayerFrames(layerName);
        if (layerFrames.length > 0) {
          const frameIndex = i % layerFrames.length;
          this.sceneViewer.renderFrame(layerName, frameIndex);
        }
      });

      // Small delay to ensure rendering completes
      await new Promise(resolve => setTimeout(resolve, 10));

      // Get composite frame
      const compositeCanvas = this.sceneViewer.getCompositeFrame();
      frames.push(compositeCanvas);
    }

    return frames;
  }

  getSelectedLoopType() {
    const loopSelect = document.getElementById('loopTypeSelect');
    return loopSelect ? loopSelect.value : 'normal';
  }

  showGifProgress() {
    let progressOverlay = document.getElementById('gifProgressOverlay');
    if (!progressOverlay) {
      progressOverlay = document.createElement('div');
      progressOverlay.id = 'gifProgressOverlay';
      progressOverlay.innerHTML = `
        <div class="gif-progress-content">
          <div class="gif-progress-spinner"></div>
          <h3>Creating Your GIF</h3>
          <div class="gif-progress-bar">
            <div class="gif-progress-fill" style="width: 0%"></div>
          </div>
          <p class="gif-progress-text">Preparing frames...</p>
          <button class="gif-cancel-btn" onclick="window.cancelGifGeneration()">Cancel</button>
        </div>
      `;
      document.body.appendChild(progressOverlay);

      // Add cancel function to window
      window.cancelGifGeneration = () => {
        this.gifEncoder.abort();
        this.isGeneratingGif = false;
        this.hideGifProgress();
        this.notificationSystem.notify('info', 'Cancelled', 'GIF generation was cancelled.');
      };
    }
    progressOverlay.classList.add('active');
  }

  updateGifProgress(percent, message) {
    const progressFill = document.querySelector('.gif-progress-fill');
    const progressText = document.querySelector('.gif-progress-text');
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = message;
  }

  hideGifProgress() {
    const progressOverlay = document.getElementById('gifProgressOverlay');
    if (progressOverlay) {
      progressOverlay.classList.remove('active');
    }
  }

  // ============================================
  // GIF Library UI Methods
  // ============================================

  setupGifLibraryUI() {
    // Library will be rendered in the sidebar
    this.renderGifLibrary();
  }

  renderGifLibrary() {
    const libraryContainer = document.getElementById('gifLibraryContainer');
    if (!libraryContainer) return;

    const gifs = this.gifLibrary.getGifsByCategory('All');
    const storageInfo = this.gifLibrary.getStorageInfo();

    if (gifs.length === 0) {
      libraryContainer.innerHTML = `
        <div class="gif-library-empty">
          <p>No GIFs yet!</p>
          <p class="small">Create your first looping GIF</p>
        </div>
      `;
      return;
    }

    libraryContainer.innerHTML = `
      <div class="gif-library-stats">
        ${gifs.length} GIFs | ${(storageInfo.used / 1024 / 1024).toFixed(1)}MB used
      </div>
      <div class="gif-library-grid">
        ${gifs.map(gif => `
          <div class="gif-library-item" data-gif-id="${gif.id}">
            <img src="${gif.url || gif.thumbnail}" alt="${gif.name}" />
            <div class="gif-item-info">
              <span class="gif-name">${gif.name}</span>
              <span class="gif-meta">${gif.frameCount}f | ${gif.duration}s</span>
            </div>
            <div class="gif-item-actions">
              <button class="gif-download-btn" title="Download">⬇️</button>
              <button class="gif-delete-btn" title="Delete">🗑️</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Add event listeners
    libraryContainer.querySelectorAll('.gif-library-item').forEach(item => {
      const gifId = item.dataset.gifId;

      item.querySelector('.gif-download-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const gif = this.gifLibrary.gifs.find(g => g.id === gifId);
        if (gif && gif.blob) {
          GifEncoder.download(gif.blob, `${gif.name}.gif`);
        }
      });

      item.querySelector('.gif-delete-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.gifLibrary.removeGif(gifId);
        this.renderGifLibrary();
        this.notificationSystem.notify('info', 'Deleted', 'GIF removed from library');
      });
    });
  }

  async exportGifPack() {
    const gifs = this.gifLibrary.gifs;
    if (gifs.length === 0) {
      this.notificationSystem.notify('warning', 'No GIFs', 'Create some GIFs first to export a pack.');
      return;
    }

    try {
      const gifIds = gifs.map(g => g.id);
      const result = await this.gifLibrary.exportPack(gifIds, 'ai-gif-pack');
      this.notificationSystem.notify('success', 'Pack Exported', `${result.count} GIFs exported successfully!`);
    } catch (error) {
      this.notificationSystem.notify('error', 'Export Failed', error.message);
    }
  }
}

class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.badge = document.querySelector('#chatBubble .notification-badge');
    this.popup = document.getElementById('notificationPopup');
    this.popupTimeout = null;
    this.confirmDialog = document.getElementById('confirmationDialog');
    
    this.setupUI();
  }
  
  setupUI() {
    const popupClose = this.popup.querySelector('.notification-popup-close');
    popupClose.addEventListener('click', () => {
      this.hidePopup();
    });
    
    this.popup.addEventListener('click', () => {
      const chatBubble = document.getElementById('chatBubble');
      chatBubble.click();
      this.hidePopup();
    });
  }
  
  notify(type = 'info', title = 'Notification', message = '') {
    const notification = {
      type,
      title,
      message,
      timestamp: new Date()
    };
    
    this.notifications.push(notification);
    this.unreadCount++;
    this.updateBadge();
    this.showPopup(notification);
    this.addToChatMessages(notification);
  }

  confirm(title = 'Confirm', message = 'Are you sure?') {
    return new Promise((resolve) => {
      const confirmTitle = this.confirmDialog.querySelector('.confirmation-title');
      const confirmMessage = this.confirmDialog.querySelector('.confirmation-message');
      const confirmBtn = this.confirmDialog.querySelector('.confirmation-confirm');
      const cancelBtn = this.confirmDialog.querySelector('.confirmation-cancel');
      
      confirmTitle.textContent = title;
      confirmMessage.textContent = message;
      
      this.confirmDialog.classList.add('active');
      
      const handleConfirm = () => {
        this.confirmDialog.classList.remove('active');
        this.notify('info', title, 'Changes discarded');
        cleanup();
        resolve(true);
      };
      
      const handleCancel = () => {
        this.confirmDialog.classList.remove('active');
        cleanup();
        resolve(false);
      };
      
      const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
      };
      
      confirmBtn.addEventListener('click', handleConfirm);
      cancelBtn.addEventListener('click', handleCancel);
    });
  }
  
  updateBadge() {
    this.badge.textContent = this.unreadCount;
    if (this.unreadCount > 0) {
      this.badge.classList.add('active');
    } else {
      this.badge.classList.remove('active');
    }
  }
  
  showPopup(notification) {
    if (this.popupTimeout) {
      clearTimeout(this.popupTimeout);
    }
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    this.popup.className = 'notification-popup active ' + notification.type;
    this.popup.querySelector('.notification-popup-title').innerHTML = 
      `<span>${icons[notification.type] || 'ℹ'}</span>${notification.title}`;
    this.popup.querySelector('.notification-popup-message').textContent = notification.message;
    
    this.popupTimeout = setTimeout(() => {
      this.hidePopup();
    }, 4000);
  }
  
  hidePopup() {
    this.popup.classList.remove('active');
    if (this.popupTimeout) {
      clearTimeout(this.popupTimeout);
      this.popupTimeout = null;
    }
  }
  
  addToChatMessages(notification) {
    const chatMessages = document.querySelector('.chat-messages');
    const message = document.createElement('div');
    message.classList.add('message', 'notification', notification.type);
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    
    const timeStr = notification.timestamp.toLocaleTimeString();
    
    message.innerHTML = `
      <div class="notification-header">
        <span>${icons[notification.type] || 'ℹ'}</span>
        <strong>${notification.title}</strong>
      </div>
      <div>${notification.message}</div>
      <div class="notification-time">${timeStr}</div>
    `;
    
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  clearUnread() {
    this.unreadCount = 0;
    this.updateBadge();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new MirrorMationApp();

  // ============================================
  // Tutorial System
  // ============================================
  const tutorialOverlay = document.getElementById('tutorialOverlay');
  const skipTutorial = document.getElementById('skipTutorial');
  const startTutorial = document.getElementById('startTutorial');
  const dontShowTutorial = document.getElementById('dontShowTutorial');

  // Check if user has seen tutorial
  const hasSeenTutorial = localStorage.getItem('ai-gif-studio-tutorial-seen');

  if (!hasSeenTutorial && tutorialOverlay) {
    // Show tutorial on first visit
    setTimeout(() => {
      tutorialOverlay.classList.add('active');
    }, 500);
  }

  function closeTutorial() {
    if (dontShowTutorial && dontShowTutorial.checked) {
      localStorage.setItem('ai-gif-studio-tutorial-seen', 'true');
    }
    tutorialOverlay.classList.remove('active');
  }

  if (skipTutorial) {
    skipTutorial.addEventListener('click', closeTutorial);
  }

  if (startTutorial) {
    startTutorial.addEventListener('click', () => {
      closeTutorial();
      // Optionally highlight the first element
      const chatBubble = document.getElementById('chatBubble');
      if (chatBubble) {
        chatBubble.classList.add('tutorial-highlight');
        setTimeout(() => {
          chatBubble.classList.remove('tutorial-highlight');
        }, 5000);
      }
    });
  }

  // Export Pack button handler
  const exportPackBtn = document.getElementById('exportPackBtn');
  if (exportPackBtn) {
    exportPackBtn.addEventListener('click', () => {
      app.exportGifPack();
    });
  }

  // ============================================
  // Chat System with Tabs
  // ============================================
  const chatBubble = document.getElementById('chatBubble');
  const chatOverlay = document.getElementById('chatOverlay');
  const chatClose = document.querySelector('.chat-close');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  const chatMessages = document.querySelector('.chat-messages');

  // Chat tabs
  const chatTabs = document.querySelectorAll('.chat-tab');
  const aiTabContent = document.getElementById('aiTabContent');
  const giphyTabContent = document.getElementById('giphyTabContent');

  chatTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      chatTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = tab.dataset.tab;
      if (tabName === 'ai') {
        aiTabContent.classList.add('active');
        giphyTabContent.classList.remove('active');
      } else if (tabName === 'giphy') {
        aiTabContent.classList.remove('active');
        giphyTabContent.classList.add('active');
        // Load trending GIFs when switching to Giphy tab
        if (app.giphyService && !app.giphyService.getTrendingResults().length) {
          app.giphyService.getTrending();
        }
      }
    });
  });

  // ============================================
  // Giphy Search
  // ============================================
  const giphySearchInput = document.getElementById('giphySearchInput');
  const giphySearchBtn = document.getElementById('giphySearchBtn');

  async function performGiphySearch() {
    const query = giphySearchInput.value.trim();
    if (app.giphyService) {
      if (query) {
        await app.giphyService.search(query);
      } else {
        await app.giphyService.getTrending();
      }
    }
  }

  if (giphySearchBtn) {
    giphySearchBtn.addEventListener('click', performGiphySearch);
  }

  if (giphySearchInput) {
    giphySearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performGiphySearch();
      }
    });
  }

  // ============================================
  // Chat Bubble & Overlay
  // ============================================
  chatBubble.addEventListener('click', () => {
    chatOverlay.classList.add('active');
    chatBubble.style.display = 'none';
    if (app.notificationSystem) {
      app.notificationSystem.clearUnread();
    }
  });

  chatClose.addEventListener('click', () => {
    chatOverlay.classList.remove('active');
    chatBubble.style.display = 'flex';
  });

  function addMessage(text, sender) {
    const message = document.createElement('div');
    message.classList.add('message', sender);
    message.textContent = text;
    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
      addMessage(text, 'user');
      chatInput.value = '';

      const aiKeywords = ['make', 'create', 'generate', 'add', 'change', 'replace', 'background', 'character', 'interaction', 'guy', 'standing', 'walking', 'scene'];
      const containsAIKeyword = aiKeywords.some(keyword => text.toLowerCase().includes(keyword));

      if (containsAIKeyword) {
        const currentLayer = app.timelineManager.getSelectedLayer();
        const selectedFrameIndex = app.timelineManager.selectedFrameIndex;
        const frames = app.timelineManager.getLayerFrames(currentLayer);

        if (selectedFrameIndex !== null && frames[selectedFrameIndex]) {
          addMessage('Processing your request with AI...', 'agent');

          try {
            const result = await app.aiService.branchFrame({
              prompt: text,
              sourceFrameData: frames[selectedFrameIndex],
              layerType: currentLayer,
              frameIndex: selectedFrameIndex,
              sectionIndex: app.timelineManager.getSectionForFrame(selectedFrameIndex)
            });

            app.timelineManager.updateFrame(currentLayer, selectedFrameIndex, result.generatedFrame);

            addMessage(
              `Frame ${selectedFrameIndex + 1} on ${currentLayer} layer has been updated with your request: "${text}"`,
              'agent'
            );

          } catch (error) {
            addMessage(
              `Failed to generate frame: ${error.message}. Please make sure BRIA_API_KEY is set in Netlify environment variables.`,
              'agent'
            );
          }
        } else {
          addMessage(
            'Please select a frame on the timeline first, then I can help you modify it with AI.',
            'agent'
          );
        }
      } else {
        setTimeout(() => {
          const response = 'I can help you modify frames with AI! Try saying things like:\n\n- "Make a guy standing"\n- "Create a walking character"\n- "Change background to a forest"\n- "Add interaction effects"\n\nSelect a frame on the timeline, then give me instructions!\n\nTip: Switch to the GIF Search tab to find and add GIFs from Giphy!';
          addMessage(response, 'agent');
          if (app.notificationSystem && !chatOverlay.classList.contains('active')) {
            app.notificationSystem.notify('info', 'AI Response', 'New message from AI Agent');
          }
        }, 800);
      }
    }
  }

  chatSend.addEventListener('click', sendMessage);

  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Add Help button handler to show tutorial
  const helpBtn = document.querySelector('#filesHeader button:last-child');
  if (helpBtn && helpBtn.textContent === 'Help') {
    helpBtn.addEventListener('click', () => {
      if (tutorialOverlay) {
        tutorialOverlay.classList.add('active');
      }
    });
  }
});
