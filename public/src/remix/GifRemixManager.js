/**
 * GIF Remix Manager - Dual Timeline Architecture
 *
 * Manages two parallel timelines:
 * 1. Source Timeline (Reference) - The original Giphy GIF, read-only
 * 2. Generated Timeline (Output) - AI-generated remixed frames, editable/exportable
 */

export class GifRemixManager {
  constructor() {
    // Source timeline (reference)
    this.sourceTimeline = {
      gif: null,
      frames: [],
      metadata: {
        width: 0,
        height: 0,
        frameCount: 0,
        duration: 0,
        loopTiming: []
      },
      analysis: {
        motionRhythm: 'medium',
        style: 'unknown',
        colorPalette: [],
        keyFrames: []
      }
    };

    // Generated timeline (output)
    this.generatedTimeline = {
      frames: [],
      metadata: {
        width: 800,
        height: 500,
        frameCount: 0,
        fps: 12
      },
      settings: {
        motionIntensity: 0.5,    // 0 = less motion, 1 = more motion
        smoothness: 0.5,         // 0 = glitchy, 1 = smooth
        speed: 1.0,              // Playback speed multiplier
        styleInfluence: 0.7,     // How much to match source style
        loopType: 'seamless'     // bounce, pingpong, seamless, fade
      }
    };

    // State management
    this.isProcessing = false;
    this.currentStep = null;

    // Callbacks
    this.onSourceLoaded = null;
    this.onFrameGenerated = null;
    this.onProgressUpdate = null;
    this.onError = null;
    this.onComplete = null;
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks) {
    if (callbacks.onSourceLoaded) this.onSourceLoaded = callbacks.onSourceLoaded;
    if (callbacks.onFrameGenerated) this.onFrameGenerated = callbacks.onFrameGenerated;
    if (callbacks.onProgressUpdate) this.onProgressUpdate = callbacks.onProgressUpdate;
    if (callbacks.onError) this.onError = callbacks.onError;
    if (callbacks.onComplete) this.onComplete = callbacks.onComplete;
  }

  /**
   * Load a source GIF from Giphy
   * @param {Object} giphyGif - Parsed GIF object from GiphyService
   */
  async loadSourceGif(giphyGif) {
    this.updateProgress('loading', 'Loading source GIF...');

    try {
      this.sourceTimeline.gif = giphyGif;

      // Store metadata
      this.sourceTimeline.metadata.width = giphyGif.width || 480;
      this.sourceTimeline.metadata.height = giphyGif.height || 270;

      // Get the GIF URL for frame extraction
      const gifUrl = giphyGif.urls?.original || giphyGif.urls?.fixed_width;

      if (!gifUrl) {
        throw new Error('No valid GIF URL found');
      }

      // Extract frames using GifFrameExtractor (imported separately)
      this.updateProgress('extracting', 'Extracting frames from GIF...');

      if (this.onSourceLoaded) {
        this.onSourceLoaded({
          gif: giphyGif,
          url: gifUrl,
          metadata: this.sourceTimeline.metadata
        });
      }

      return {
        success: true,
        gif: giphyGif,
        metadata: this.sourceTimeline.metadata
      };

    } catch (error) {
      console.error('Failed to load source GIF:', error);
      if (this.onError) {
        this.onError({ type: 'load', message: error.message });
      }
      throw error;
    }
  }

  /**
   * Set extracted frames from the source GIF
   * @param {Array} frames - Array of frame data (canvas or data URLs)
   * @param {Object} frameInfo - Frame timing and metadata
   */
  setSourceFrames(frames, frameInfo = {}) {
    this.sourceTimeline.frames = frames;
    this.sourceTimeline.metadata.frameCount = frames.length;

    if (frameInfo.delays) {
      this.sourceTimeline.metadata.loopTiming = frameInfo.delays;
      // Calculate total duration
      const totalMs = frameInfo.delays.reduce((sum, delay) => sum + delay, 0);
      this.sourceTimeline.metadata.duration = totalMs / 1000;
    }

    // Analyze the source GIF
    this.analyzeSourceGif();
  }

  /**
   * Analyze the source GIF for motion, style, and key frames
   */
  analyzeSourceGif() {
    const frames = this.sourceTimeline.frames;
    if (frames.length === 0) return;

    // Identify key frames (first, middle, last for simple analysis)
    const keyFrameIndices = [
      0,
      Math.floor(frames.length / 4),
      Math.floor(frames.length / 2),
      Math.floor(3 * frames.length / 4),
      frames.length - 1
    ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

    this.sourceTimeline.analysis.keyFrames = keyFrameIndices.map(i => ({
      index: i,
      frame: frames[i]
    }));

    // Estimate motion intensity based on frame count and timing
    const avgDelay = this.sourceTimeline.metadata.loopTiming.length > 0
      ? this.sourceTimeline.metadata.loopTiming.reduce((a, b) => a + b, 0) / this.sourceTimeline.metadata.loopTiming.length
      : 100;

    if (avgDelay < 50) {
      this.sourceTimeline.analysis.motionRhythm = 'fast';
    } else if (avgDelay > 150) {
      this.sourceTimeline.analysis.motionRhythm = 'slow';
    } else {
      this.sourceTimeline.analysis.motionRhythm = 'medium';
    }

    this.updateProgress('analyzed', `Source analyzed: ${frames.length} frames, ${this.sourceTimeline.analysis.motionRhythm} motion`);
  }

  /**
   * Get key frames from source for AI conditioning
   * @param {number} count - Number of key frames to return (default: 3)
   */
  getKeyFrames(count = 3) {
    const keyFrames = this.sourceTimeline.analysis.keyFrames;
    if (keyFrames.length <= count) return keyFrames;

    // Select evenly distributed key frames
    const step = Math.floor(keyFrames.length / count);
    return keyFrames.filter((_, i) => i % step === 0).slice(0, count);
  }

  /**
   * Update generation settings
   * @param {Object} settings - New settings to apply
   */
  updateSettings(settings) {
    this.generatedTimeline.settings = {
      ...this.generatedTimeline.settings,
      ...settings
    };
  }

  /**
   * Get current settings
   */
  getSettings() {
    return { ...this.generatedTimeline.settings };
  }

  /**
   * Add a generated frame to the output timeline
   * @param {string} frameData - Frame data URL
   * @param {number} index - Optional index (appends if not specified)
   */
  addGeneratedFrame(frameData, index = -1) {
    if (index >= 0 && index < this.generatedTimeline.frames.length) {
      this.generatedTimeline.frames[index] = frameData;
    } else {
      this.generatedTimeline.frames.push(frameData);
    }

    this.generatedTimeline.metadata.frameCount = this.generatedTimeline.frames.length;

    if (this.onFrameGenerated) {
      this.onFrameGenerated({
        frame: frameData,
        index: index >= 0 ? index : this.generatedTimeline.frames.length - 1,
        total: this.generatedTimeline.frames.length
      });
    }
  }

  /**
   * Clear generated frames
   */
  clearGeneratedFrames() {
    this.generatedTimeline.frames = [];
    this.generatedTimeline.metadata.frameCount = 0;
  }

  /**
   * Get source timeline data
   */
  getSourceTimeline() {
    return {
      ...this.sourceTimeline,
      frames: this.sourceTimeline.frames.length // Don't return actual frame data
    };
  }

  /**
   * Get generated timeline data
   */
  getGeneratedTimeline() {
    return {
      ...this.generatedTimeline,
      frames: this.generatedTimeline.frames.length // Don't return actual frame data
    };
  }

  /**
   * Get all generated frames for export
   */
  getGeneratedFrames() {
    return [...this.generatedTimeline.frames];
  }

  /**
   * Get all source frames
   */
  getSourceFrames() {
    return [...this.sourceTimeline.frames];
  }

  /**
   * Get a specific source frame
   * @param {number} index - Frame index
   */
  getSourceFrame(index) {
    if (index >= 0 && index < this.sourceTimeline.frames.length) {
      return this.sourceTimeline.frames[index];
    }
    return null;
  }

  /**
   * Get a specific generated frame
   * @param {number} index - Frame index
   */
  getGeneratedFrame(index) {
    if (index >= 0 && index < this.generatedTimeline.frames.length) {
      return this.generatedTimeline.frames[index];
    }
    return null;
  }

  /**
   * Generate AI prompt based on source analysis and settings
   * @param {Object} options - Generation options
   */
  buildRemixPrompt(options = {}) {
    const settings = this.generatedTimeline.settings;
    const analysis = this.sourceTimeline.analysis;
    const { customPrompt = '', frameIndex = 0 } = options;

    // Base prompt
    let prompt = customPrompt || 'Create a stylized animation frame';

    // Add motion modifier
    if (settings.motionIntensity < 0.3) {
      prompt += ', subtle movement, calm animation';
    } else if (settings.motionIntensity > 0.7) {
      prompt += ', dynamic movement, energetic animation';
    }

    // Add style modifier
    if (settings.smoothness < 0.3) {
      prompt += ', glitchy effect, digital artifacts, distorted';
    } else if (settings.smoothness > 0.7) {
      prompt += ', smooth transitions, fluid motion, polished';
    }

    // Add source influence
    if (settings.styleInfluence > 0.5) {
      prompt += ', maintaining similar visual style and color palette';
    }

    return prompt;
  }

  /**
   * Calculate output frame timing based on settings
   */
  calculateOutputTiming() {
    const settings = this.generatedTimeline.settings;
    const sourceDelays = this.sourceTimeline.metadata.loopTiming;

    if (sourceDelays.length === 0) {
      // Default timing if no source
      return Array(this.generatedTimeline.frames.length).fill(1000 / settings.fps);
    }

    // Adjust timing based on speed setting
    return sourceDelays.map(delay => Math.max(20, delay / settings.speed));
  }

  /**
   * Update progress and notify
   */
  updateProgress(step, message) {
    this.currentStep = step;
    if (this.onProgressUpdate) {
      this.onProgressUpdate({ step, message });
    }
  }

  /**
   * Reset the remix manager
   */
  reset() {
    this.sourceTimeline = {
      gif: null,
      frames: [],
      metadata: {
        width: 0,
        height: 0,
        frameCount: 0,
        duration: 0,
        loopTiming: []
      },
      analysis: {
        motionRhythm: 'medium',
        style: 'unknown',
        colorPalette: [],
        keyFrames: []
      }
    };

    this.generatedTimeline = {
      frames: [],
      metadata: {
        width: 800,
        height: 500,
        frameCount: 0,
        fps: 12
      },
      settings: {
        motionIntensity: 0.5,
        smoothness: 0.5,
        speed: 1.0,
        styleInfluence: 0.7,
        loopType: 'seamless'
      }
    };

    this.isProcessing = false;
    this.currentStep = null;
  }

  /**
   * Get remix state for serialization
   */
  getState() {
    return {
      hasSource: this.sourceTimeline.frames.length > 0,
      sourceMetadata: this.sourceTimeline.metadata,
      sourceAnalysis: this.sourceTimeline.analysis,
      generatedCount: this.generatedTimeline.frames.length,
      generatedMetadata: this.generatedTimeline.metadata,
      settings: this.generatedTimeline.settings,
      isProcessing: this.isProcessing,
      currentStep: this.currentStep
    };
  }
}
