export class CanvasEditor {
  constructor(overlayElement, paintCanvasElement) {
    this.overlay = overlayElement;
    this.paintCanvas = paintCanvasElement;
    this.paintCtx = this.paintCanvas.getContext('2d');
    this.isActive = false;
    this.currentLayer = 'background';
    
    this.currentTool = 'select';
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.canvasHistory = [];
    this.historyStep = -1;
    
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    
    this.brushSize = 3;
    this.brushColor = '#000000';
    
    this.images = [];
    this.draggingImageId = null;
    this.imageDragStartX = 0;
    this.imageDragStartY = 0;
    this.resizingImageId = null;
    this.resizeCorner = null;
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.resizeStartW = 0;
    this.resizeStartH = 0;
    this.resizeStartImageX = 0;
    this.resizeStartImageY = 0;
    this.resizeHandleSize = 8;
    
    this.onFrameComplete = null;
    
    this.init();
  }

  init() {
    this.saveCanvasState();
  }

  show() {
    this.overlay.classList.add('active');
    this.isActive = true;
  }

  hide() {
    this.overlay.classList.remove('active');
    this.isActive = false;
  }

  toggle() {
    if (this.isActive) {
      this.hide();
    } else {
      this.show();
    }
  }

  setCurrentLayer(layerName) {
    this.currentLayer = layerName;
  }

  getCurrentLayer() {
    return this.currentLayer;
  }

  setTool(toolName) {
    this.currentTool = toolName;
  }

  setBrushSize(size) {
    this.brushSize = size;
  }

  setBrushColor(color) {
    this.brushColor = color;
  }

  saveCanvasState() {
    this.historyStep++;
    if (this.historyStep < this.canvasHistory.length) {
      this.canvasHistory.length = this.historyStep;
    }
    this.canvasHistory.push(this.paintCanvas.toDataURL());
  }

  undo() {
    if (this.historyStep > 0) {
      this.historyStep--;
      const img = new Image();
      img.src = this.canvasHistory[this.historyStep];
      img.onload = () => {
        this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
        this.paintCtx.drawImage(img, 0, 0);
      };
    }
  }

  clear() {
    this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
    this.saveCanvasState();
  }

  updateCanvasTransform(zoomWrapperElement) {
    if (!zoomWrapperElement) return;
    zoomWrapperElement.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  zoomIn(zoomWrapperElement) {
    this.zoom = Math.min(this.zoom + 0.2, 3);
    this.updateCanvasTransform(zoomWrapperElement);
  }

  zoomOut(zoomWrapperElement) {
    this.zoom = Math.max(this.zoom - 0.2, 0.5);
    this.updateCanvasTransform(zoomWrapperElement);
  }

  panUp(step = 50, zoomWrapperElement) {
    this.panY += step;
    this.updateCanvasTransform(zoomWrapperElement);
  }

  panDown(step = 50, zoomWrapperElement) {
    this.panY -= step;
    this.updateCanvasTransform(zoomWrapperElement);
  }

  panLeft(step = 50, zoomWrapperElement) {
    this.panX += step;
    this.updateCanvasTransform(zoomWrapperElement);
  }

  panRight(step = 50, zoomWrapperElement) {
    this.panX -= step;
    this.updateCanvasTransform(zoomWrapperElement);
  }

  resetView(zoomWrapperElement) {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateCanvasTransform(zoomWrapperElement);
  }

  drawAllImages() {
    this.images.forEach(img => {
      this.paintCtx.drawImage(
        img.imageObject,
        img.x,
        img.y,
        img.w,
        img.h
      );
    });
  }
  
  drawImageWithBounds(imageId) {
    const img = this.images.find(i => i.id === imageId);
    if (!img) return;
    
    this.paintCtx.drawImage(
      img.imageObject,
      img.x,
      img.y,
      img.w,
      img.h
    );
    
    this.paintCtx.setLineDash([5, 5]);
    this.paintCtx.strokeStyle = '#000000';
    this.paintCtx.lineWidth = 1;
    this.paintCtx.strokeRect(img.x, img.y, img.w, img.h);
    this.paintCtx.setLineDash([]);
    
    this.drawResizeHandles(imageId);
  }
  
  drawResizeHandles(imageId) {
    const img = this.images.find(i => i.id === imageId);
    if (!img) return;
    
    const handles = this.getResizeHandles(imageId);
    this.paintCtx.fillStyle = '#0066ff';
    this.paintCtx.strokeStyle = '#ffffff';
    this.paintCtx.lineWidth = 1;
    
    Object.values(handles).forEach(handle => {
      this.paintCtx.fillRect(
        handle.x - this.resizeHandleSize / 2,
        handle.y - this.resizeHandleSize / 2,
        this.resizeHandleSize,
        this.resizeHandleSize
      );
      this.paintCtx.strokeRect(
        handle.x - this.resizeHandleSize / 2,
        handle.y - this.resizeHandleSize / 2,
        this.resizeHandleSize,
        this.resizeHandleSize
      );
    });
  }
  
  getResizeHandles(imageId) {
    const img = this.images.find(i => i.id === imageId);
    if (!img) return {};
    
    return {
      topLeft: { x: img.x, y: img.y },
      topRight: { x: img.x + img.w, y: img.y },
      bottomLeft: { x: img.x, y: img.y + img.h },
      bottomRight: { x: img.x + img.w, y: img.y + img.h }
    };
  }
  
  getResizeHandleAtPoint(x, y) {
    for (let i = this.images.length - 1; i >= 0; i--) {
      const img = this.images[i];
      const handles = this.getResizeHandles(img.id);
      const threshold = this.resizeHandleSize;
      
      for (let [corner, pos] of Object.entries(handles)) {
        const dx = x - pos.x;
        const dy = y - pos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= threshold) {
          return { imageId: img.id, corner };
        }
      }
    }
    
    return null;
  }

  getImageAtPoint(x, y) {
    for (let i = this.images.length - 1; i >= 0; i--) {
      const img = this.images[i];
      if (
        x >= img.x &&
        x <= img.x + img.w &&
        y >= img.y &&
        y <= img.y + img.h
      ) {
        return img.id;
      }
    }
    return null;
  }

  startDrawing(x, y) {
    const resizeHandle = this.getResizeHandleAtPoint(x, y);
    if (resizeHandle) {
      const img = this.images.find(i => i.id === resizeHandle.imageId);
      if (img) {
        this.resizingImageId = resizeHandle.imageId;
        this.resizeCorner = resizeHandle.corner;
        this.resizeStartX = x;
        this.resizeStartY = y;
        this.resizeStartW = img.w;
        this.resizeStartH = img.h;
        this.resizeStartImageX = img.x;
        this.resizeStartImageY = img.y;
        return;
      }
    }
    
    const imageId = this.getImageAtPoint(x, y);
    if (imageId) {
      const img = this.images.find(i => i.id === imageId);
      if (img) {
        this.draggingImageId = imageId;
        this.imageDragStartX = x - img.x;
        this.imageDragStartY = y - img.y;
        return;
      }
    }
    
    if (this.currentTool === 'select') {
      return;
    }
    
    this.isDrawing = true;
    this.startX = x;
    this.startY = y;

    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      this.paintCtx.beginPath();
      this.paintCtx.moveTo(x, y);
    }
  }

  draw(x, y) {
    if (this.resizingImageId) {
      const img = this.images.find(i => i.id === this.resizingImageId);
      if (img) {
        const deltaX = x - this.resizeStartX;
        const deltaY = y - this.resizeStartY;
        
        if (this.resizeCorner === 'topLeft') {
          img.x = this.resizeStartImageX + deltaX;
          img.y = this.resizeStartImageY + deltaY;
          img.w = this.resizeStartW - deltaX;
          img.h = this.resizeStartH - deltaY;
        } else if (this.resizeCorner === 'topRight') {
          img.y = this.resizeStartImageY + deltaY;
          img.w = this.resizeStartW + deltaX;
          img.h = this.resizeStartH - deltaY;
        } else if (this.resizeCorner === 'bottomLeft') {
          img.x = this.resizeStartImageX + deltaX;
          img.w = this.resizeStartW - deltaX;
          img.h = this.resizeStartH + deltaY;
        } else if (this.resizeCorner === 'bottomRight') {
          img.w = this.resizeStartW + deltaX;
          img.h = this.resizeStartH + deltaY;
        }
        
        img.w = Math.max(20, img.w);
        img.h = Math.max(20, img.h);
        
        const savedHistory = this.canvasHistory[this.historyStep];
        if (savedHistory) {
          const histImg = new Image();
          histImg.onload = () => {
            this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
            this.paintCtx.drawImage(histImg, 0, 0);
            this.drawAllImages();
            this.drawImageWithBounds(this.resizingImageId);
          };
          histImg.src = savedHistory;
        } else {
          this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
          this.drawAllImages();
          this.drawImageWithBounds(this.resizingImageId);
        }
      }
      return;
    }
    
    if (this.draggingImageId) {
      const img = this.images.find(i => i.id === this.draggingImageId);
      if (img) {
        img.x = x - this.imageDragStartX;
        img.y = y - this.imageDragStartY;
        
        const savedHistory = this.canvasHistory[this.historyStep];
        if (savedHistory) {
          const histImg = new Image();
          histImg.onload = () => {
            this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
            this.paintCtx.drawImage(histImg, 0, 0);
            this.drawAllImages();
            this.drawImageWithBounds(this.draggingImageId);
          };
          histImg.src = savedHistory;
        } else {
          this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
          this.drawAllImages();
          this.drawImageWithBounds(this.draggingImageId);
        }
      }
      return;
    }
    
    if (!this.isDrawing) return;

    if (this.currentTool === 'brush') {
      this.paintCtx.strokeStyle = this.brushColor;
      this.paintCtx.lineWidth = this.brushSize;
      this.paintCtx.lineCap = 'round';
      this.paintCtx.lineJoin = 'round';
      this.paintCtx.lineTo(x, y);
      this.paintCtx.stroke();
    } else if (this.currentTool === 'eraser') {
      this.paintCtx.strokeStyle = '#ffffff';
      this.paintCtx.lineWidth = this.brushSize;
      this.paintCtx.lineCap = 'round';
      this.paintCtx.lineJoin = 'round';
      this.paintCtx.lineTo(x, y);
      this.paintCtx.stroke();
    }
  }

  endDrawing(x, y) {
    if (this.resizingImageId) {
      this.resizingImageId = null;
      this.resizeCorner = null;
      
      this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.paintCtx.setLineDash([]);
      this.drawAllImages();
      
      this.saveCanvasState();
      return;
    }
    
    if (this.draggingImageId) {
      this.draggingImageId = null;
      
      this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.paintCtx.setLineDash([]);
      this.drawAllImages();
      
      this.saveCanvasState();
      return;
    }
    
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentTool === 'line') {
      this.paintCtx.strokeStyle = this.brushColor;
      this.paintCtx.lineWidth = this.brushSize;
      this.paintCtx.lineCap = 'round';
      this.paintCtx.beginPath();
      this.paintCtx.moveTo(this.startX, this.startY);
      this.paintCtx.lineTo(x, y);
      this.paintCtx.stroke();
    } else if (this.currentTool === 'rect') {
      this.paintCtx.strokeStyle = this.brushColor;
      this.paintCtx.lineWidth = this.brushSize;
      this.paintCtx.strokeRect(this.startX, this.startY, x - this.startX, y - this.startY);
    } else if (this.currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(x - this.startX, 2) + Math.pow(y - this.startY, 2));
      this.paintCtx.strokeStyle = this.brushColor;
      this.paintCtx.lineWidth = this.brushSize;
      this.paintCtx.beginPath();
      this.paintCtx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
      this.paintCtx.stroke();
    }

    this.saveCanvasState();
  }

  getCanvasData() {
    return this.paintCanvas.toDataURL('image/png');
  }

  loadImage(imageData) {
    const img = new Image();
    img.onload = () => {
      const canvasW = this.paintCanvas.width;
      const canvasH = this.paintCanvas.height;
      const imgW = img.width;
      const imgH = img.height;
      
      const scaleX = canvasW / imgW;
      const scaleY = canvasH / imgH;
      const scale = Math.min(scaleX, scaleY, 1);
      
      const w = imgW * scale;
      const h = imgH * scale;
      const x = (canvasW - w) / 2;
      const y = (canvasH - h) / 2;
      
      const imageId = Date.now() + Math.random();
      
      this.images.push({
        id: imageId,
        imageObject: img,
        x: x,
        y: y,
        w: w,
        h: h
      });
      
      this.paintCtx.clearRect(0, 0, canvasW, canvasH);
      this.drawAllImages();
      this.saveCanvasState();
    };
    img.src = imageData;
  }

  importImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.loadImage(e.target.result);
        resolve(e.target.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  addFrameToTimeline() {
    const frameData = this.getCanvasData();
    if (this.onFrameComplete) {
      this.onFrameComplete(this.currentLayer, frameData);
    }
    return frameData;
  }
}
