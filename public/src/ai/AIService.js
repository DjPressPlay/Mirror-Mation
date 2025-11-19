export class AIService {
  constructor() {
    this.apiEndpoint = '/api/ai-frame-generator';
    this.isProcessing = false;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  async generateFrame(options) {
    const {
      prompt,
      frameData,
      layerType,
      frameIndex,
      
      maskData,
      maskInvert,
      conditioningImage,
      conditioningType,
      conditioningStrength,
      
      preserveRegions,
      styleReference,
      depthMap,
      
      useLatentSpace,
      latentBlend
    } = options;

    if (this.isProcessing) {
      throw new Error('AI generation already in progress');
    }

    if (!prompt || !frameData || !layerType) {
      throw new Error('Missing required parameters for AI generation');
    }

    this.isProcessing = true;

    if (this.onProgress) {
      this.onProgress({ 
        status: 'starting', 
        message: 'Sending request to AI...' 
      });
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          frameData,
          layerType,
          frameIndex,
          maskData,
          maskInvert,
          conditioningImage,
          conditioningType,
          conditioningStrength,
          preserveRegions,
          styleReference,
          depthMap,
          useLatentSpace,
          latentBlend
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 
          errorData.error || 
          `AI generation failed with status ${response.status}`
        );
      }

      if (this.onProgress) {
        this.onProgress({ 
          status: 'processing', 
          message: 'AI is generating your frame...' 
        });
      }

      const result = await response.json();

      if (!result.success || !result.generatedFrame) {
        throw new Error(result.message || 'Failed to generate frame');
      }

      if (this.onProgress) {
        this.onProgress({ 
          status: 'complete', 
          message: 'Frame generated successfully!' 
        });
      }

      if (this.onComplete) {
        this.onComplete(result);
      }

      return result;

    } catch (error) {
      console.error('AI Service Error:', error);
      
      if (this.onError) {
        this.onError(error);
      }
      
      throw error;
      
    } finally {
      this.isProcessing = false;
    }
  }

  async branchFrame(options) {
    const {
      prompt,
      sourceFrameData,
      layerType,
      frameIndex,
      sectionIndex,
      maskData,
      maskInvert,
      preserveElements,
      styleReference,
      conditioningStrength
    } = options;

    try {
      const generateOptions = {
        prompt: `${prompt}`,
        frameData: sourceFrameData,
        layerType: layerType,
        frameIndex: frameIndex
      };

      if (maskData) {
        generateOptions.maskData = maskData;
        generateOptions.maskInvert = maskInvert !== undefined ? maskInvert : false;
      }

      if (preserveElements && !maskData) {
        const autoMask = await this.generateMask(sourceFrameData, layerType, {
          autoDetect: true,
          threshold: 0.5
        });
        generateOptions.maskData = autoMask.maskData;
        generateOptions.maskInvert = true;
      }

      if (styleReference) {
        generateOptions.styleReference = styleReference;
        generateOptions.conditioningStrength = conditioningStrength || 0.8;
      }

      const result = await this.generateFrame(generateOptions);

      return {
        ...result,
        branchMetadata: {
          originalFrameIndex: frameIndex,
          sectionIndex: sectionIndex,
          branchPrompt: prompt,
          timestamp: Date.now(),
          hasMask: !!maskData,
          preservedElements: preserveElements,
          hasStyleReference: !!styleReference
        }
      };

    } catch (error) {
      console.error('Branch Frame Error:', error);
      throw error;
    }
  }

  cancelGeneration() {
    this.isProcessing = false;
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing
    };
  }

  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  setCompleteCallback(callback) {
    this.onComplete = callback;
  }

  setErrorCallback(callback) {
    this.onError = callback;
  }

  clearCallbacks() {
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  async generateMask(frameData, targetLayer, options = {}) {
    const {
      threshold = 0.5,
      featherRadius = 2,
      autoDetect = true
    } = options;

    if (!frameData) {
      throw new Error('Frame data is required for mask generation');
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const maskData = new Uint8ClampedArray(imageData.data.length);
          
          for (let i = 0; i < imageData.data.length; i += 4) {
            const r = imageData.data[i];
            const g = imageData.data[i + 1];
            const b = imageData.data[i + 2];
            const a = imageData.data[i + 3];
            
            const brightness = (r + g + b) / 3;
            const alpha = a / 255;
            
            if (autoDetect) {
              const maskValue = (brightness > threshold * 255 && alpha > 0.5) ? 255 : 0;
              maskData[i] = maskValue;
              maskData[i + 1] = maskValue;
              maskData[i + 2] = maskValue;
              maskData[i + 3] = 255;
            } else {
              maskData[i] = 255;
              maskData[i + 1] = 255;
              maskData[i + 2] = 255;
              maskData[i + 3] = alpha * 255;
            }
          }
          
          const maskImageData = new ImageData(maskData, canvas.width, canvas.height);
          ctx.putImageData(maskImageData, 0, 0);
          
          const maskBase64 = canvas.toDataURL('image/png');
          resolve({
            maskData: maskBase64,
            width: canvas.width,
            height: canvas.height,
            targetLayer
          });
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load frame data for mask generation'));
      img.src = frameData;
    });
  }

  async applyMultipleConditions(conditions) {
    if (!Array.isArray(conditions) || conditions.length === 0) {
      throw new Error('Conditions must be a non-empty array');
    }

    const processedConditions = [];

    for (const condition of conditions) {
      const {
        type,
        image,
        strength = 1.0,
        startStep = 0,
        endStep = 1.0
      } = condition;

      if (!type || !image) {
        throw new Error('Each condition must have a type and image');
      }

      processedConditions.push({
        type,
        image,
        strength: Math.max(0, Math.min(1, strength)),
        startStep: Math.max(0, Math.min(1, startStep)),
        endStep: Math.max(0, Math.min(1, endStep))
      });
    }

    return processedConditions;
  }

  async interpolateFrames(startFrame, endFrame, steps = 5, options = {}) {
    const {
      method = 'linear',
      useLatentSpace = true,
      preserveMask = null
    } = options;

    if (!startFrame || !endFrame) {
      throw new Error('Both start and end frames are required for interpolation');
    }

    if (steps < 2) {
      throw new Error('Interpolation requires at least 2 steps');
    }

    const interpolatedFrames = [];

    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const blendFactor = method === 'ease' 
        ? t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        : t;

      if (this.onProgress) {
        this.onProgress({
          status: 'interpolating',
          message: `Interpolating frame ${i + 1} of ${steps}`,
          progress: (i / steps) * 100
        });
      }

      const frame = await this._blendFrames(startFrame, endFrame, blendFactor, {
        useLatentSpace,
        preserveMask
      });

      interpolatedFrames.push(frame);
    }

    return interpolatedFrames;
  }

  async _blendFrames(frame1, frame2, factor, options) {
    return new Promise((resolve, reject) => {
      const img1 = new Image();
      const img2 = new Image();
      let loaded = 0;

      const onLoad = () => {
        loaded++;
        if (loaded === 2) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img1.width;
            canvas.height = img1.height;
            const ctx = canvas.getContext('2d');

            ctx.globalAlpha = 1 - factor;
            ctx.drawImage(img1, 0, 0);
            ctx.globalAlpha = factor;
            ctx.drawImage(img2, 0, 0);

            if (options.preserveMask) {
              const maskImg = new Image();
              maskImg.onload = () => {
                ctx.globalCompositeOperation = 'destination-in';
                ctx.globalAlpha = 1;
                ctx.drawImage(maskImg, 0, 0);
                resolve(canvas.toDataURL('image/png'));
              };
              maskImg.src = options.preserveMask;
            } else {
              resolve(canvas.toDataURL('image/png'));
            }
          } catch (error) {
            reject(error);
          }
        }
      };

      img1.onload = onLoad;
      img2.onload = onLoad;
      img1.onerror = img2.onerror = () => reject(new Error('Failed to load frames for blending'));

      img1.src = frame1;
      img2.src = frame2;
    });
  }
}
