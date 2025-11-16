export class CanvasEditor {
  constructor(overlayElement, paintCanvasElement) {
    this.overlay = overlayElement;
    this.paintCanvas = paintCanvasElement;
    this.paintCtx = this.paintCanvas.getContext('2d');
    this.isActive = false;
    this.currentLayer = 'background';
    
    this.currentTool = 'brush';
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
    
    this.imageObject = null;
    this.imageX = 0;
    this.imageY = 0;
    this.imageW = 0;
    this.imageH = 0;
    this.draggingImage = false;
    this.imageDragStartX = 0;
    this.imageDragStartY = 0;
    this.resizingImage = false;
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

  drawImageWithBounds() {
    if (!this.imageObject) return;
    
    this.paintCtx.drawImage(
      this.imageObject,
      this.imageX,
      this.imageY,
      this.imageW,
      this.imageH
    );
    
    this.paintCtx.setLineDash([5, 5]);
    this.paintCtx.strokeStyle = '#000000';
    this.paintCtx.lineWidth = 1;
    this.paintCtx.strokeRect(this.imageX, this.imageY, this.imageW, this.imageH);
    this.paintCtx.setLineDash([]);
    
    this.drawResizeHandles();
  }
  
  drawResizeHandles() {
    if (!this.imageObject) return;
    
    const handles = this.getResizeHandles();
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
  
  getResizeHandles() {
    return {
      topLeft: { x: this.imageX, y: this.imageY },
      topRight: { x: this.imageX + this.imageW, y: this.imageY },
      bottomLeft: { x: this.imageX, y: this.imageY + this.imageH },
      bottomRight: { x: this.imageX + this.imageW, y: this.imageY + this.imageH }
    };
  }
  
  getResizeHandleAtPoint(x, y) {
    if (!this.imageObject) return null;
    
    const handles = this.getResizeHandles();
    const threshold = this.resizeHandleSize;
    
    for (let [corner, pos] of Object.entries(handles)) {
      const dx = x - pos.x;
      const dy = y - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= threshold) {
        return corner;
      }
    }
    
    return null;
  }

  isPointInImage(x, y) {
    return (
      x >= this.imageX &&
      x <= this.imageX + this.imageW &&
      y >= this.imageY &&
      y <= this.imageY + this.imageH
    );
  }

  startDrawing(x, y) {
    if (this.imageObject) {
      const resizeHandle = this.getResizeHandleAtPoint(x, y);
      if (resizeHandle) {
        this.resizingImage = true;
        this.resizeCorner = resizeHandle;
        this.resizeStartX = x;
        this.resizeStartY = y;
        this.resizeStartW = this.imageW;
        this.resizeStartH = this.imageH;
        this.resizeStartImageX = this.imageX;
        this.resizeStartImageY = this.imageY;
        return;
      }
      
      if (this.isPointInImage(x, y)) {
        this.draggingImage = true;
        this.imageDragStartX = x - this.imageX;
        this.imageDragStartY = y - this.imageY;
        return;
      }
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
    if (this.resizingImage) {
      const deltaX = x - this.resizeStartX;
      const deltaY = y - this.resizeStartY;
      
      if (this.resizeCorner === 'topLeft') {
        this.imageX = this.resizeStartImageX + deltaX;
        this.imageY = this.resizeStartImageY + deltaY;
        this.imageW = this.resizeStartW - deltaX;
        this.imageH = this.resizeStartH - deltaY;
      } else if (this.resizeCorner === 'topRight') {
        this.imageY = this.resizeStartImageY + deltaY;
        this.imageW = this.resizeStartW + deltaX;
        this.imageH = this.resizeStartH - deltaY;
      } else if (this.resizeCorner === 'bottomLeft') {
        this.imageX = this.resizeStartImageX + deltaX;
        this.imageW = this.resizeStartW - deltaX;
        this.imageH = this.resizeStartH + deltaY;
      } else if (this.resizeCorner === 'bottomRight') {
        this.imageW = this.resizeStartW + deltaX;
        this.imageH = this.resizeStartH + deltaY;
      }
      
      this.imageW = Math.max(20, this.imageW);
      this.imageH = Math.max(20, this.imageH);
      
      const savedHistory = this.canvasHistory[this.historyStep];
      if (savedHistory) {
        const img = new Image();
        img.onload = () => {
          this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
          this.paintCtx.drawImage(img, 0, 0);
          this.drawImageWithBounds();
        };
        img.src = savedHistory;
      } else {
        this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
        this.drawImageWithBounds();
      }
      return;
    }
    
    if (this.draggingImage) {
      this.imageX = x - this.imageDragStartX;
      this.imageY = y - this.imageDragStartY;
      
      const savedHistory = this.canvasHistory[this.historyStep];
      if (savedHistory) {
        const img = new Image();
        img.onload = () => {
          this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
          this.paintCtx.drawImage(img, 0, 0);
          this.drawImageWithBounds();
        };
        img.src = savedHistory;
      } else {
        this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
        this.drawImageWithBounds();
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
    if (this.resizingImage) {
      this.resizingImage = false;
      this.resizeCorner = null;
      
      this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.paintCtx.setLineDash([]);
      if (this.imageObject) {
        this.paintCtx.drawImage(
          this.imageObject,
          this.imageX,
          this.imageY,
          this.imageW,
          this.imageH
        );
      }
      
      this.saveCanvasState();
      return;
    }
    
    if (this.draggingImage) {
      this.draggingImage = false;
      
      this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.paintCtx.setLineDash([]);
      if (this.imageObject) {
        this.paintCtx.drawImage(
          this.imageObject,
          this.imageX,
          this.imageY,
          this.imageW,
          this.imageH
        );
      }
      
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
      
      this.imageW = imgW * scale;
      this.imageH = imgH * scale;
      this.imageX = (canvasW - this.imageW) / 2;
      this.imageY = (canvasH - this.imageH) / 2;
      this.imageObject = img;
      
      this.paintCtx.clearRect(0, 0, canvasW, canvasH);
      this.paintCtx.drawImage(
        this.imageObject,
        this.imageX,
        this.imageY,
        this.imageW,
        this.imageH
      );
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
