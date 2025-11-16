export class SceneViewer {
  constructor(containerElement) {
    this.container = containerElement;
    this.backgroundLayer = null;
    this.characterLayer = null;
    this.interactionLayer = null;
    this.isPlaying = false;
    this.currentFrame = 0;
    
    this.init();
  }

  init() {
    this.container.style.position = 'relative';
    this.container.style.width = '800px';
    this.container.style.height = '500px';
    this.container.style.overflow = 'hidden';
    
    this.backgroundLayer = this.createLayer('background', 1);
    this.characterLayer = this.createLayer('character', 2);
    this.interactionLayer = this.createLayer('interaction', 3);
    
    this.container.appendChild(this.backgroundLayer.canvas);
    this.container.appendChild(this.characterLayer.canvas);
    this.container.appendChild(this.interactionLayer.canvas);
  }

  createLayer(name, zIndex) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = zIndex;
    canvas.classList.add(`scene-layer-${name}`);
    
    const ctx = canvas.getContext('2d');
    
    return {
      name,
      canvas,
      ctx,
      frames: [],
      currentFrameIndex: 0,
      isVisible: true
    };
  }

  getLayer(layerName) {
    switch(layerName) {
      case 'background': return this.backgroundLayer;
      case 'character': return this.characterLayer;
      case 'interaction': return this.interactionLayer;
      default: return null;
    }
  }

  addFrameToLayer(layerName, frameData) {
    const layer = this.getLayer(layerName);
    if (!layer) return;
    
    layer.frames.push(frameData);
  }

  setLayerFrames(layerName, frames) {
    const layer = this.getLayer(layerName);
    if (!layer) return;
    
    layer.frames = frames;
  }

  renderFrame(layerName, frameIndex) {
    const layer = this.getLayer(layerName);
    if (!layer || !layer.frames[frameIndex]) return;
    
    const frameData = layer.frames[frameIndex];
    
    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    
    if (typeof frameData === 'string') {
      const img = new Image();
      img.onload = () => {
        layer.ctx.drawImage(img, 0, 0, layer.canvas.width, layer.canvas.height);
      };
      img.src = frameData;
    } else if (frameData instanceof HTMLCanvasElement) {
      layer.ctx.drawImage(frameData, 0, 0, layer.canvas.width, layer.canvas.height);
    } else if (frameData instanceof ImageData) {
      layer.ctx.putImageData(frameData, 0, 0);
    }
    
    layer.currentFrameIndex = frameIndex;
  }

  syncAllLayers(timestamp) {
    ['background', 'character', 'interaction'].forEach(layerName => {
      const layer = this.getLayer(layerName);
      if (!layer || !layer.isVisible) return;
      
      const frameIndex = Math.floor(timestamp / 100) % Math.max(layer.frames.length, 1);
      if (layer.frames.length > 0) {
        this.renderFrame(layerName, frameIndex);
      }
    });
  }

  clearLayer(layerName) {
    const layer = this.getLayer(layerName);
    if (!layer) return;
    
    layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
  }

  clearAllLayers() {
    this.clearLayer('background');
    this.clearLayer('character');
    this.clearLayer('interaction');
  }

  setLayerVisibility(layerName, visible) {
    const layer = this.getLayer(layerName);
    if (!layer) return;
    
    layer.isVisible = visible;
    layer.canvas.style.display = visible ? 'block' : 'none';
  }

  getCompositeFrame() {
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = 800;
    compositeCanvas.height = 500;
    const compositeCtx = compositeCanvas.getContext('2d');
    
    if (this.backgroundLayer.isVisible && this.backgroundLayer.frames.length > 0) {
      compositeCtx.drawImage(this.backgroundLayer.canvas, 0, 0);
    }
    
    if (this.characterLayer.isVisible && this.characterLayer.frames.length > 0) {
      compositeCtx.drawImage(this.characterLayer.canvas, 0, 0);
    }
    
    if (this.interactionLayer.isVisible && this.interactionLayer.frames.length > 0) {
      compositeCtx.drawImage(this.interactionLayer.canvas, 0, 0);
    }
    
    return compositeCanvas;
  }

  exportFrame() {
    return this.getCompositeFrame().toDataURL('image/png');
  }
}
