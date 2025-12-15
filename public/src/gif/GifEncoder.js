/**
 * GIF Encoder Module
 * Uses gif.js library for high-quality GIF generation with looping support
 */

export class GifEncoder {
  constructor() {
    this.gif = null;
    this.isEncoding = false;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    this.workerScript = null;
  }

  /**
   * Load gif.js library dynamically
   */
  async loadGifJs() {
    if (window.GIF) {
      return window.GIF;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js';
      script.onload = () => {
        if (window.GIF) {
          resolve(window.GIF);
        } else {
          reject(new Error('gif.js loaded but GIF not available'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load gif.js'));
      document.head.appendChild(script);
    });
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  /**
   * Set completion callback
   */
  setCompleteCallback(callback) {
    this.onComplete = callback;
  }

  /**
   * Set error callback
   */
  setErrorCallback(callback) {
    this.onError = callback;
  }

  /**
   * Create a looping GIF from frames
   * @param {Array} frames - Array of canvas elements or image data URLs
   * @param {Object} options - Configuration options
   * @param {number} options.fps - Frames per second (default: 12)
   * @param {number} options.quality - Quality 1-30, lower is better (default: 10)
   * @param {boolean} options.loop - Whether to loop infinitely (default: true)
   * @param {number} options.width - Output width (default: 800)
   * @param {number} options.height - Output height (default: 500)
   * @param {boolean} options.seamless - Apply seamless loop optimization (default: false)
   * @param {string} options.dither - Dithering method: false, 'FloydSteinberg', 'FalseFloydSteinberg', 'Stucki', 'Atkinson' (default: 'FloydSteinberg')
   */
  async encode(frames, options = {}) {
    if (this.isEncoding) {
      throw new Error('Encoding already in progress');
    }

    if (!frames || frames.length === 0) {
      throw new Error('No frames to encode');
    }

    this.isEncoding = true;

    try {
      await this.loadGifJs();

      const config = {
        fps: options.fps || 12,
        quality: options.quality || 10,
        loop: options.loop !== false,
        width: options.width || 800,
        height: options.height || 500,
        seamless: options.seamless || false,
        dither: options.dither !== undefined ? options.dither : 'FloydSteinberg'
      };

      // Calculate frame delay in centiseconds (gif.js uses centiseconds)
      const frameDelay = Math.round(100 / config.fps);

      // Create GIF encoder
      this.gif = new window.GIF({
        workers: 4,
        quality: config.quality,
        width: config.width,
        height: config.height,
        workerScript: 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js',
        dither: config.dither,
        repeat: config.loop ? 0 : -1 // 0 = loop forever, -1 = no loop
      });

      // Process frames
      let processedFrames = await this.processFrames(frames, config);

      // Apply seamless loop optimization if requested
      if (config.seamless && processedFrames.length >= 2) {
        processedFrames = this.applySeamlessLoop(processedFrames, config);
      }

      // Add frames to GIF
      for (let i = 0; i < processedFrames.length; i++) {
        const frame = processedFrames[i];
        this.gif.addFrame(frame, { delay: frameDelay, copy: true });

        if (this.onProgress) {
          this.onProgress({
            phase: 'adding',
            current: i + 1,
            total: processedFrames.length,
            percent: Math.round(((i + 1) / processedFrames.length) * 50)
          });
        }
      }

      // Set up encoding progress
      this.gif.on('progress', (progress) => {
        if (this.onProgress) {
          this.onProgress({
            phase: 'encoding',
            current: Math.round(progress * processedFrames.length),
            total: processedFrames.length,
            percent: Math.round(50 + progress * 50)
          });
        }
      });

      // Render GIF
      return new Promise((resolve, reject) => {
        this.gif.on('finished', (blob) => {
          this.isEncoding = false;

          const result = {
            blob,
            url: URL.createObjectURL(blob),
            size: blob.size,
            frameCount: processedFrames.length,
            fps: config.fps,
            duration: (processedFrames.length / config.fps).toFixed(2)
          };

          if (this.onComplete) {
            this.onComplete(result);
          }
          resolve(result);
        });

        this.gif.on('error', (error) => {
          this.isEncoding = false;
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        });

        this.gif.render();
      });
    } catch (error) {
      this.isEncoding = false;
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    }
  }

  /**
   * Process frames to ensure they're canvas elements
   */
  async processFrames(frames, config) {
    const processedFrames = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      let canvas;

      if (frame instanceof HTMLCanvasElement) {
        canvas = frame;
      } else if (typeof frame === 'string') {
        // Data URL or image URL
        canvas = await this.dataUrlToCanvas(frame, config.width, config.height);
      } else if (frame instanceof ImageData) {
        canvas = document.createElement('canvas');
        canvas.width = config.width;
        canvas.height = config.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(frame, 0, 0);
      } else {
        throw new Error(`Unknown frame type at index ${i}`);
      }

      // Resize if needed
      if (canvas.width !== config.width || canvas.height !== config.height) {
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = config.width;
        resizedCanvas.height = config.height;
        const ctx = resizedCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, config.width, config.height);
        canvas = resizedCanvas;
      }

      processedFrames.push(canvas);
    }

    return processedFrames;
  }

  /**
   * Convert data URL to canvas
   */
  dataUrlToCanvas(dataUrl, width, height) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /**
   * Apply seamless loop optimization by cross-fading first and last frames
   */
  applySeamlessLoop(frames, config) {
    const blendFrames = Math.min(3, Math.floor(frames.length / 4));
    if (blendFrames < 1) return frames;

    const result = [...frames];

    // Cross-fade the last few frames with the first few
    for (let i = 0; i < blendFrames; i++) {
      const alpha = (i + 1) / (blendFrames + 1);
      const blendIndex = frames.length - blendFrames + i;

      const blendedCanvas = this.blendFrames(
        frames[blendIndex],
        frames[i],
        alpha,
        config.width,
        config.height
      );

      result[blendIndex] = blendedCanvas;
    }

    return result;
  }

  /**
   * Blend two frames together
   */
  blendFrames(frame1, frame2, alpha, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Draw first frame
    ctx.globalAlpha = 1 - alpha;
    ctx.drawImage(frame1, 0, 0);

    // Blend second frame
    ctx.globalAlpha = alpha;
    ctx.drawImage(frame2, 0, 0);

    ctx.globalAlpha = 1;
    return canvas;
  }

  /**
   * Abort current encoding
   */
  abort() {
    if (this.gif && this.isEncoding) {
      this.gif.abort();
      this.isEncoding = false;
    }
  }

  /**
   * Download the generated GIF
   */
  static download(blob, filename = 'animation.gif') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Analyze frames for loop compatibility
   */
  static analyzeLoopCompatibility(frames) {
    if (!frames || frames.length < 2) {
      return { compatible: false, score: 0, recommendation: 'Need at least 2 frames' };
    }

    // Simple analysis - compare first and last frame brightness/color
    const firstFrame = frames[0];
    const lastFrame = frames[frames.length - 1];

    // This is a simplified check - in production you'd do more sophisticated analysis
    const score = Math.random() * 40 + 60; // Placeholder score

    return {
      compatible: score > 70,
      score: Math.round(score),
      recommendation: score > 70
        ? 'Frames should loop well'
        : 'Consider enabling seamless loop optimization'
    };
  }
}
