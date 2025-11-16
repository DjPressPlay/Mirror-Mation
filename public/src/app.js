import { SceneViewer } from './scene/SceneViewer.js';
import { CanvasEditor } from './canvas/CanvasEditor.js';
import { TimelineManager } from './timeline/TimelineManager.js';

class MirrorMationApp {
  constructor() {
    this.sceneViewer = null;
    this.canvasEditor = null;
    this.timelineManager = null;
    this.fileBin = [];
    
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
    
    this.setupEventListeners();
    this.connectModules();
    this.setupOverlayDragAndResize();
  }

  connectModules() {
    this.timelineManager.onLayerUpdate = (layerName, frames) => {
      this.sceneViewer.setLayerFrames(layerName, frames);
    };
    
    this.timelineManager.onFrameSelect = (layerName, frameIndex, frameData) => {
      this.sceneViewer.renderFrame(layerName, frameIndex);
    };
    
    this.canvasEditor.onFrameComplete = (layerName, frameData) => {
      this.timelineManager.addFrame(layerName, frameData);
    };
  }

  setupEventListeners() {
    const layers = document.querySelectorAll('.layer');
    layers.forEach(layer => {
      layer.addEventListener('click', () => {
        layers.forEach(l => l.classList.remove('active'));
        layer.classList.add('active');
        
        const layerType = layer.getAttribute('data-layer');
        
        this.updateLayerVisuals(layerType);
        
        if (layerType === 'overlay') {
          this.canvasEditor.show();
        } else {
          this.canvasEditor.hide();
          if (['background', 'characters', 'interaction'].includes(layerType)) {
            const normalizedLayerName = layerType === 'characters' ? 'character' : layerType;
            this.timelineManager.setSelectedLayer(normalizedLayerName);
            this.canvasEditor.setCurrentLayer(normalizedLayerName);
          }
        }
      });
    });
    
    document.getElementById('playPreview').addEventListener('click', () => {
      if (this.timelineManager.isPlaying) {
        this.timelineManager.stop();
      } else {
        this.timelineManager.play(this.sceneViewer);
      }
    });
    
    document.getElementById('generateGIF').addEventListener('click', () => {
      alert('GIF generation not implemented yet.');
    });
    
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
    });
    
    document.getElementById('undoBtn').addEventListener('click', () => {
      this.canvasEditor.undo();
    });
    
    document.getElementById('closePaint').addEventListener('click', () => {
      this.canvasEditor.hide();
      const bgLayer = document.querySelector('.layer[data-layer="background"]');
      document.querySelectorAll('.layer').forEach(l => l.classList.remove('active'));
      bgLayer.classList.add('active');
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
        }
      };
      input.click();
    });
    
    this.setupFileBinDragAndDrop();
    
    this.setupCanvasMouseEvents();
    
    const canvasLayerBtn = document.getElementById('canvasLayerBtn');
    this.updateCanvasLayerButton();
    
    canvasLayerBtn.addEventListener('click', () => {
      const layers = ['background', 'character', 'interaction'];
      const currentLayer = this.canvasEditor.getCurrentLayer();
      const currentIndex = layers.indexOf(currentLayer);
      const nextIndex = (currentIndex + 1) % layers.length;
      const nextLayer = layers[nextIndex];
      
      this.canvasEditor.setCurrentLayer(nextLayer);
      this.timelineManager.setSelectedLayer(nextLayer);
      this.updateCanvasLayerButton();
      
      const layerTypeMap = {
        'background': 'background',
        'character': 'characters',
        'interaction': 'interaction'
      };
      this.updateLayerVisuals(layerTypeMap[nextLayer]);
    });
  }
  
  updateLayerVisuals(layerType) {
    const timeline = document.getElementById('timeline');
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    
    timeline.className = '';
    canvasWrapper.className = 'canvas-wrapper';
    
    if (layerType === 'background') {
      timeline.classList.add('layer-background');
      canvasWrapper.classList.add('layer-background');
    } else if (layerType === 'characters') {
      timeline.classList.add('layer-characters');
      canvasWrapper.classList.add('layer-characters');
    } else if (layerType === 'interaction') {
      timeline.classList.add('layer-interaction');
      canvasWrapper.classList.add('layer-interaction');
    }
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
  
  updateCanvasLayerButton() {
    const canvasLayerBtn = document.getElementById('canvasLayerBtn');
    const currentLayer = this.canvasEditor.getCurrentLayer();
    
    let displayName = currentLayer;
    if (currentLayer === 'background') {
      displayName = 'BG';
    } else if (currentLayer === 'character') {
      displayName = 'Character Layer';
    } else if (currentLayer === 'interaction') {
      displayName = 'Interaction Layer';
    }
    
    canvasLayerBtn.textContent = `🗂️ ${displayName}`;
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
}

document.addEventListener('DOMContentLoaded', () => {
  new MirrorMationApp();
  
  const chatBubble = document.getElementById('chatBubble');
  const chatOverlay = document.getElementById('chatOverlay');
  const chatClose = document.querySelector('.chat-close');
  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  const chatMessages = document.querySelector('.chat-messages');

  chatBubble.addEventListener('click', () => {
    chatOverlay.classList.add('active');
    chatBubble.style.display = 'none';
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

  function sendMessage() {
    const text = chatInput.value.trim();
    if (text) {
      addMessage(text, 'user');
      chatInput.value = '';
      
      setTimeout(() => {
        addMessage('Thanks for your message! This is a demo AI agent. In a real implementation, this would connect to an AI service.', 'agent');
      }, 800);
    }
  }

  chatSend.addEventListener('click', sendMessage);
  
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });
});
