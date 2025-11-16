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

  startDrawing(x, y) {
    this.isDrawing = true;
    this.startX = x;
    this.startY = y;

    if (this.currentTool === 'brush' || this.currentTool === 'eraser') {
      this.paintCtx.beginPath();
      this.paintCtx.moveTo(x, y);
    }
  }

  draw(x, y) {
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
      this.paintCtx.clearRect(0, 0, this.paintCanvas.width, this.paintCanvas.height);
      this.paintCtx.drawImage(img, 0, 0);
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
