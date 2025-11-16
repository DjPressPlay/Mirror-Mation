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
    
    this.draggedFrameIndex = null;
    this.draggedFrameElement = null;
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

  deleteFrame(layerName, frameIndex) {
    if (!this.layers[layerName]) return;
    if (this.layers[layerName].length === 0) return;
    
    this.removeFrame(layerName, frameIndex);
  }

  duplicateFrame(layerName, frameIndex) {
    if (!this.layers[layerName]) return;
    if (!this.layers[layerName][frameIndex]) return;
    
    const frameToDuplicate = this.layers[layerName][frameIndex];
    this.layers[layerName].splice(frameIndex + 1, 0, frameToDuplicate);
    
    this.selectedFrameIndex = frameIndex + 1;
    this.render();
    
    if (this.onLayerUpdate) {
      this.onLayerUpdate(layerName, this.layers[layerName]);
    }
  }

  moveFrame(layerName, fromIndex, toIndex) {
    if (!this.layers[layerName]) return;
    if (fromIndex < 0 || fromIndex >= this.layers[layerName].length) return;
    if (toIndex < 0 || toIndex >= this.layers[layerName].length) return;
    if (fromIndex === toIndex) return;
    
    const frameToMove = this.layers[layerName][fromIndex];
    this.layers[layerName].splice(fromIndex, 1);
    this.layers[layerName].splice(toIndex, 0, frameToMove);
    
    this.selectedFrameIndex = toIndex;
    this.render();
    
    if (this.onLayerUpdate) {
      this.onLayerUpdate(layerName, this.layers[layerName]);
    }
  }

  startDrag(frameIndex, frameElement) {
    this.draggedFrameIndex = frameIndex;
    this.draggedFrameElement = frameElement;
    frameElement.style.opacity = '0.5';
    frameElement.classList.add('dragging');
  }

  endDrag() {
    if (this.draggedFrameElement) {
      this.draggedFrameElement.style.opacity = '1';
      this.draggedFrameElement.classList.remove('dragging');
    }
    this.draggedFrameIndex = null;
    this.draggedFrameElement = null;
  }

  handleDrop(targetIndex) {
    if (this.draggedFrameIndex !== null && this.draggedFrameIndex !== targetIndex) {
      this.moveFrame(this.selectedLayer, this.draggedFrameIndex, targetIndex);
    }
    this.endDrag();
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
        
        if (this.selectedLayer === 'background') {
          frameDiv.classList.add('layer-background');
        } else if (this.selectedLayer === 'character') {
          frameDiv.classList.add('layer-characters');
        } else if (this.selectedLayer === 'interaction') {
          frameDiv.classList.add('layer-interaction');
        }
      }
      
      frameDiv.style.backgroundImage = `url(${frame})`;
      
      const optionsDiv = document.createElement('div');
      optionsDiv.classList.add('frame-options');
      
      const deleteBtn = document.createElement('button');
      deleteBtn.classList.add('frame-option-btn', 'delete');
      deleteBtn.textContent = '🗑️ Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteFrame(this.selectedLayer, index);
      });
      
      const moveBtn = document.createElement('button');
      moveBtn.classList.add('frame-option-btn', 'move');
      moveBtn.textContent = '↔️ Move';
      moveBtn.draggable = false;
      moveBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
      moveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      
      const duplicateBtn = document.createElement('button');
      duplicateBtn.classList.add('frame-option-btn', 'duplicate');
      duplicateBtn.textContent = '📋 Duplicate';
      duplicateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.duplicateFrame(this.selectedLayer, index);
      });
      
      optionsDiv.appendChild(deleteBtn);
      optionsDiv.appendChild(moveBtn);
      optionsDiv.appendChild(duplicateBtn);
      
      frameDiv.appendChild(optionsDiv);
      
      frameDiv.addEventListener('click', () => {
        this.selectedFrameIndex = index;
        this.render();
        
        if (this.onFrameSelect) {
          this.onFrameSelect(this.selectedLayer, index, frame);
        }
      });
      
      frameDiv.draggable = true;
      
      frameDiv.addEventListener('dragstart', (e) => {
        this.startDrag(index, frameDiv);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', frameDiv.innerHTML);
      });
      
      frameDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (this.draggedFrameIndex !== null && this.draggedFrameIndex !== index) {
          frameDiv.style.borderLeft = '4px solid #3b82f6';
        }
      });
      
      frameDiv.addEventListener('dragleave', (e) => {
        frameDiv.style.borderLeft = '';
      });
      
      frameDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        frameDiv.style.borderLeft = '';
        this.handleDrop(index);
      });
      
      frameDiv.addEventListener('dragend', (e) => {
        this.endDrag();
        document.querySelectorAll('.frame').forEach(f => {
          f.style.borderLeft = '';
        });
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
