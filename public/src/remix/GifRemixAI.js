/**
 * GIF Remix AI Service
 *
 * Handles AI-powered regeneration of GIF frames using the source GIF
 * as a reference for motion, style, and loop timing.
 */

import { AIService } from '../ai/AIService.js';

export class GifRemixAI {
  constructor(aiService = null) {
    this.aiService = aiService || new AIService();
    this.isGenerating = false;
    this.aborted = false;

    // Generation settings
    this.defaultSettings = {
      motionIntensity: 0.5,    // 0 = less motion, 1 = more motion
      smoothness: 0.5,         // 0 = glitchy, 1 = smooth
      styleInfluence: 0.7,     // How much to match source style
      outputWidth: 800,
      outputHeight: 500
    };

    // Callbacks
    this.onProgress = null;
    this.onFrameComplete = null;
    this.onError = null;
    this.onComplete = null;
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks) {
    if (callbacks.onProgress) this.onProgress = callbacks.onProgress;
    if (callbacks.onFrameComplete) this.onFrameComplete = callbacks.onFrameComplete;
    if (callbacks.onError) this.onError = callbacks.onError;
    if (callbacks.onComplete) this.onComplete = callbacks.onComplete;
  }

  /**
   * Generate remixed frames based on source GIF analysis
   * @param {Object} options - Generation options
   */
  async generateRemix(options) {
    const {
      sourceFrames,           // Array of source frame data URLs
      keyFrames,              // Array of key frame indices
      settings = {},          // Motion, smoothness, style settings
      basePrompt = '',        // Custom prompt from user
      frameCount = null       // Number of frames to generate (default: match source)
    } = options;

    if (this.isGenerating) {
      throw new Error('Already generating a remix');
    }

    if (!sourceFrames || sourceFrames.length === 0) {
      throw new Error('No source frames provided');
    }

    this.isGenerating = true;
    this.aborted = false;

    const mergedSettings = { ...this.defaultSettings, ...settings };
    const outputFrameCount = frameCount || sourceFrames.length;
    const generatedFrames = [];

    try {
      this.notifyProgress('starting', `Starting remix generation: ${outputFrameCount} frames`, 0);

      // Build prompts for each frame
      const prompts = this.buildFramePrompts(
        outputFrameCount,
        sourceFrames,
        keyFrames,
        mergedSettings,
        basePrompt
      );

      // Generate frames
      for (let i = 0; i < outputFrameCount; i++) {
        if (this.aborted) {
          throw new Error('Generation aborted');
        }

        this.notifyProgress(
          'generating',
          `Generating frame ${i + 1} of ${outputFrameCount}...`,
          (i / outputFrameCount) * 100
        );

        // Get reference frame from source
        const sourceIndex = Math.floor((i / outputFrameCount) * sourceFrames.length);
        const referenceFrame = sourceFrames[sourceIndex];

        // Generate the frame
        const generatedFrame = await this.generateSingleFrame({
          prompt: prompts[i],
          referenceFrame,
          frameIndex: i,
          totalFrames: outputFrameCount,
          settings: mergedSettings
        });

        generatedFrames.push(generatedFrame);

        // Notify frame complete
        if (this.onFrameComplete) {
          this.onFrameComplete({
            frame: generatedFrame,
            index: i,
            total: outputFrameCount
          });
        }
      }

      // Apply smoothing if needed
      let finalFrames = generatedFrames;
      if (mergedSettings.smoothness > 0.7) {
        this.notifyProgress('smoothing', 'Applying smooth transitions...', 95);
        finalFrames = await this.applySmoothing(generatedFrames, mergedSettings.smoothness);
      }

      this.notifyProgress('complete', 'Remix complete!', 100);

      if (this.onComplete) {
        this.onComplete({
          frames: finalFrames,
          frameCount: finalFrames.length,
          settings: mergedSettings
        });
      }

      return {
        success: true,
        frames: finalFrames,
        frameCount: finalFrames.length
      };

    } catch (error) {
      console.error('Remix generation error:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Generate a single remixed frame
   * @param {Object} options - Frame generation options
   */
  async generateSingleFrame(options) {
    const {
      prompt,
      referenceFrame,
      frameIndex,
      totalFrames,
      settings
    } = options;

    try {
      // Call AI service
      const result = await this.aiService.generateFrame({
        prompt: prompt,
        frameData: referenceFrame,
        layerType: 'interaction',
        frameIndex: frameIndex,
        // Use reference frame as style conditioning
        styleReference: referenceFrame,
        conditioningStrength: settings.styleInfluence
      });

      return result.generatedFrame || referenceFrame;

    } catch (error) {
      console.warn(`Failed to generate frame ${frameIndex}:`, error);
      // Return processed reference frame as fallback
      return await this.processReferenceFrame(referenceFrame, settings);
    }
  }

  /**
   * Process a reference frame with effects (fallback when AI fails)
   * @param {string} frameData - Frame data URL
   * @param {Object} settings - Effect settings
   */
  async processReferenceFrame(frameData, settings) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = settings.outputWidth || img.width;
        canvas.height = settings.outputHeight || img.height;
        const ctx = canvas.getContext('2d');

        // Draw the image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Apply effects based on settings
        if (settings.smoothness < 0.3) {
          // Glitchy effect
          this.applyGlitchEffect(ctx, canvas.width, canvas.height, 1 - settings.smoothness);
        }

        if (settings.motionIntensity > 0.7) {
          // Motion blur effect
          this.applyMotionBlur(ctx, canvas.width, canvas.height, settings.motionIntensity);
        }

        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load frame'));
      img.src = frameData;
    });
  }

  /**
   * Build prompts for each frame
   */
  buildFramePrompts(frameCount, sourceFrames, keyFrames, settings, basePrompt) {
    const prompts = [];

    for (let i = 0; i < frameCount; i++) {
      let prompt = basePrompt || 'Create a stylized animation frame';

      // Position in animation
      const progress = i / frameCount;

      // Add motion modifiers
      if (settings.motionIntensity < 0.3) {
        prompt += ', subtle movement, calm and gentle';
      } else if (settings.motionIntensity > 0.7) {
        prompt += ', dynamic movement, energetic and lively';
      }

      // Add style modifiers
      if (settings.smoothness < 0.3) {
        prompt += ', glitchy digital effect, visual artifacts, datamosh style';
      } else if (settings.smoothness > 0.7) {
        prompt += ', smooth and fluid, polished animation';
      }

      // Add temporal context
      if (progress < 0.1) {
        prompt += ', beginning of loop, establishing scene';
      } else if (progress > 0.9) {
        prompt += ', end of loop, returning to start';
      } else if (progress > 0.45 && progress < 0.55) {
        prompt += ', peak action moment';
      }

      prompts.push(prompt);
    }

    return prompts;
  }

  /**
   * Apply glitch effect to canvas
   */
  applyGlitchEffect(ctx, width, height, intensity) {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Random horizontal shifts
    const numGlitches = Math.floor(intensity * 10);
    for (let g = 0; g < numGlitches; g++) {
      const y = Math.floor(Math.random() * height);
      const sliceHeight = Math.floor(Math.random() * 20) + 5;
      const shift = Math.floor((Math.random() - 0.5) * 50 * intensity);

      for (let sy = y; sy < Math.min(y + sliceHeight, height); sy++) {
        for (let x = 0; x < width; x++) {
          const sourceX = (x + shift + width) % width;
          const sourceIndex = (sy * width + sourceX) * 4;
          const destIndex = (sy * width + x) * 4;

          // Occasional color channel separation
          if (Math.random() < intensity * 0.3) {
            data[destIndex] = data[sourceIndex];  // Red only
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Apply motion blur effect
   */
  applyMotionBlur(ctx, width, height, intensity) {
    // Simple horizontal motion blur using multiple draws
    const blurAmount = Math.floor(intensity * 5);

    // Store original
    const originalData = ctx.getImageData(0, 0, width, height);

    // Clear and redraw with blur
    ctx.clearRect(0, 0, width, height);

    for (let i = -blurAmount; i <= blurAmount; i++) {
      const alpha = 1 / ((Math.abs(i) + 1) * 2);
      ctx.globalAlpha = alpha;

      // Create temp canvas with original data
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(originalData, 0, 0);

      ctx.drawImage(tempCanvas, i, 0);
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Apply smoothing between frames
   * @param {Array} frames - Array of frame data URLs
   * @param {number} smoothness - Smoothness level (0-1)
   */
  async applySmoothing(frames, smoothness) {
    if (frames.length < 3) return frames;

    const smoothedFrames = [];

    for (let i = 0; i < frames.length; i++) {
      if (smoothness > 0.8 && i > 0 && i < frames.length - 1) {
        // Blend with neighbors for extra smoothness
        const blendedFrame = await this.blendFrames(
          frames[i - 1],
          frames[i],
          frames[i + 1],
          0.25, 0.5, 0.25
        );
        smoothedFrames.push(blendedFrame);
      } else {
        smoothedFrames.push(frames[i]);
      }
    }

    return smoothedFrames;
  }

  /**
   * Blend three frames together
   */
  async blendFrames(frame1, frame2, frame3, weight1, weight2, weight3) {
    return new Promise((resolve, reject) => {
      const images = [];
      let loaded = 0;

      const onLoad = () => {
        loaded++;
        if (loaded === 3) {
          const canvas = document.createElement('canvas');
          canvas.width = images[0].width;
          canvas.height = images[0].height;
          const ctx = canvas.getContext('2d');

          ctx.globalAlpha = weight1;
          ctx.drawImage(images[0], 0, 0);
          ctx.globalAlpha = weight2;
          ctx.drawImage(images[1], 0, 0);
          ctx.globalAlpha = weight3;
          ctx.drawImage(images[2], 0, 0);

          ctx.globalAlpha = 1;
          resolve(canvas.toDataURL('image/png'));
        }
      };

      [frame1, frame2, frame3].forEach((frame, index) => {
        const img = new Image();
        img.onload = onLoad;
        img.onerror = () => reject(new Error('Failed to blend frames'));
        img.src = frame;
        images[index] = img;
      });
    });
  }

  /**
   * Generate interpolated frames between keyframes
   * @param {Array} keyFrames - Key frames to interpolate between
   * @param {number} framesPerSegment - Frames between each keyframe
   */
  async interpolateKeyFrames(keyFrames, framesPerSegment = 3) {
    if (keyFrames.length < 2) return keyFrames;

    const interpolated = [];

    for (let i = 0; i < keyFrames.length - 1; i++) {
      interpolated.push(keyFrames[i]);

      // Add interpolated frames
      for (let j = 1; j <= framesPerSegment; j++) {
        const factor = j / (framesPerSegment + 1);
        const blendedFrame = await this.aiService._blendFrames(
          keyFrames[i],
          keyFrames[i + 1],
          factor,
          {}
        );
        interpolated.push(blendedFrame);
      }
    }

    interpolated.push(keyFrames[keyFrames.length - 1]);

    return interpolated;
  }

  /**
   * Abort current generation
   */
  abort() {
    this.aborted = true;
    this.aiService.cancelGeneration();
  }

  /**
   * Check if currently generating
   */
  isGeneratingNow() {
    return this.isGenerating;
  }

  /**
   * Notify progress callback
   */
  notifyProgress(phase, message, percent) {
    if (this.onProgress) {
      this.onProgress({ phase, message, percent });
    }
  }
}

/**
 * Style presets for GIF remixing
 */
export const RemixStylePresets = {
  vaporwave: {
    name: 'Vaporwave',
    prompt: 'vaporwave aesthetic, neon pink and blue, retro computer graphics, glitch art, digital dreamscape',
    settings: { smoothness: 0.3, styleInfluence: 0.9 }
  },
  cartoon: {
    name: 'Cartoon',
    prompt: 'cartoon style, bold outlines, vibrant flat colors, animated look, expressive',
    settings: { smoothness: 0.8, styleInfluence: 0.7 }
  },
  anime: {
    name: 'Anime',
    prompt: 'anime style, cel shading, Japanese animation, dramatic lighting, expressive eyes',
    settings: { smoothness: 0.8, styleInfluence: 0.8 }
  },
  pixel: {
    name: 'Pixel Art',
    prompt: 'pixel art style, 16-bit graphics, retro game aesthetic, limited color palette',
    settings: { smoothness: 0.2, styleInfluence: 0.9 }
  },
  glitch: {
    name: 'Glitch Art',
    prompt: 'glitch art, digital corruption, datamosh, RGB split, visual artifacts, cyberpunk',
    settings: { smoothness: 0.1, styleInfluence: 0.6, motionIntensity: 0.8 }
  },
  dreamy: {
    name: 'Dreamy',
    prompt: 'dreamy soft focus, ethereal glow, pastel colors, gentle blur, fantasy atmosphere',
    settings: { smoothness: 0.9, styleInfluence: 0.7, motionIntensity: 0.3 }
  },
  neon: {
    name: 'Neon',
    prompt: 'neon glow, bright luminous colors, dark background, cyberpunk city, LED lights',
    settings: { smoothness: 0.6, styleInfluence: 0.8, motionIntensity: 0.6 }
  },
  sketch: {
    name: 'Sketch',
    prompt: 'pencil sketch style, hand drawn lines, rough edges, artistic, monochrome with hints of color',
    settings: { smoothness: 0.5, styleInfluence: 0.8 }
  }
};
