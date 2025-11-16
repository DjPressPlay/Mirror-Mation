export class TimelineManager {
  constructor(timelineElement) {
    this.timeline = timelineElement;
    this.layers = {
      background: [],
      character: [],
      interaction: []
    };
    this.selectedLayer = 'background';
    this.selectedFrameIndex = null;
    this.isPlaying = false;
    this.playbackSpeed = 500;
    this.currentPlaybackIndex = 0;
    this.playbackInterval = null;
    
    this.onFrameSelect = null;
    this.onLayerUpdate = null;
  }

  setSelectedLayer(layerName) {
    if (this.layers.hasOwnProperty(layerName)) {
      this.selectedLayer = layerName;
      this.render();
    }
  }

  getSelectedLayer() {
    return this.selectedLayer;
  }

  addFrame(layerName, frameData) {
    if (!this.layers[layerName]) return;
    
    this.layers[layerName].push(frameData);
    this.selectedFrameIndex = this.layers[layerName].length - 1;
    this.render();
    
    if (this.onLayerUpdate) {
      this.onLayerUpdate(layerName, this.layers[layerName]);
    }
  }

  removeFrame(layerName, frameIndex) {
    if (!this.layers[layerName]) return;
    
    this.layers[layerName].splice(frameIndex, 1);
    
    if (this.selectedFrameIndex >= this.layers[layerName].length) {
      this.selectedFrameIndex = this.layers[layerName].length - 1;
    }
    
    this.render();
    
    if (this.onLayerUpdate) {
      this.onLayerUpdate(layerName, this.layers[layerName]);
    }
  }

  getLayerFrames(layerName) {
    return this.layers[layerName] || [];
  }

  getAllFramesAtIndex(frameIndex) {
    return {
      background: this.layers.background[frameIndex] || null,
      character: this.layers.character[frameIndex] || null,
      interaction: this.layers.interaction[frameIndex] || null
    };
  }

  getMaxFrameCount() {
    return Math.max(
      this.layers.background.length,
      this.layers.character.length,
      this.layers.interaction.length,
      0
    );
  }

  render() {
    this.timeline.innerHTML = '';
    
    const currentLayerFrames = this.layers[this.selectedLayer];
    
    currentLayerFrames.forEach((frame, index) => {
      const frameDiv = document.createElement('div');
      frameDiv.classList.add('frame');
      frameDiv.setAttribute('data-frame-num', index + 1);
      
      if (index === this.selectedFrameIndex) {
        frameDiv.classList.add('selected');
      }
      
      frameDiv.style.backgroundImage = `url(${frame})`;
      
      frameDiv.addEventListener('click', () => {
        this.selectedFrameIndex = index;
        this.render();
        
        if (this.onFrameSelect) {
          this.onFrameSelect(this.selectedLayer, index, frame);
        }
      });
      
      this.timeline.appendChild(frameDiv);
    });
  }

  play(sceneViewer) {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.currentPlaybackIndex = 0;
    const maxFrames = this.getMaxFrameCount();
    
    if (maxFrames === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.playbackInterval = setInterval(() => {
      ['background', 'character', 'interaction'].forEach(layerName => {
        const frames = this.layers[layerName];
        if (frames.length > 0) {
          const frameIndex = this.currentPlaybackIndex % frames.length;
          sceneViewer.renderFrame(layerName, frameIndex);
        }
      });
      
      this.currentPlaybackIndex++;
      
      if (this.currentPlaybackIndex >= maxFrames) {
        this.stop();
      }
    }, this.playbackSpeed);
  }

  stop() {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    this.isPlaying = false;
    this.currentPlaybackIndex = 0;
  }

  pause() {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    this.isPlaying = false;
  }

  setPlaybackSpeed(speed) {
    this.playbackSpeed = speed;
    
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  exportAllLayers() {
    return {
      background: [...this.layers.background],
      character: [...this.layers.character],
      interaction: [...this.layers.interaction]
    };
  }

  importLayers(layersData) {
    if (layersData.background) this.layers.background = layersData.background;
    if (layersData.character) this.layers.character = layersData.character;
    if (layersData.interaction) this.layers.interaction = layersData.interaction;
    
    this.render();
  }

  clear(layerName) {
    if (layerName) {
      this.layers[layerName] = [];
    } else {
      this.layers.background = [];
      this.layers.character = [];
      this.layers.interaction = [];
    }
    this.selectedFrameIndex = null;
    this.render();
  }
}
