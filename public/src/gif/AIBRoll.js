/**
 * AI B-Roll Module
 * AI-powered image placement and GIF enhancement features
 */

export class AIBRoll {
  constructor(aiService) {
    this.aiService = aiService;
    this.presets = this.getPresets();
  }

  /**
   * Get AI enhancement presets
   */
  getPresets() {
    return {
      // Loop enhancement presets
      loops: {
        bounce: {
          name: 'Bounce Loop',
          description: 'Frames play forward then backward',
          type: 'bounce'
        },
        seamless: {
          name: 'Seamless Loop',
          description: 'Cross-fade first and last frames',
          type: 'seamless'
        },
        fade: {
          name: 'Fade Loop',
          description: 'Fade out then fade in',
          type: 'fade'
        },
        pingpong: {
          name: 'Ping Pong',
          description: 'Alternate forward and backward',
          type: 'pingpong'
        }
      },
      // Style presets for AI generation
      styles: {
        cartoon: {
          name: 'Cartoon Style',
          prompt: 'cartoon style, bold outlines, vibrant colors, animated look',
          strength: 0.7
        },
        anime: {
          name: 'Anime Style',
          prompt: 'anime style, cel shading, japanese animation, expressive',
          strength: 0.7
        },
        pixel: {
          name: 'Pixel Art',
          prompt: 'pixel art style, retro game aesthetic, 16-bit colors',
          strength: 0.8
        },
        watercolor: {
          name: 'Watercolor',
          prompt: 'watercolor painting style, soft edges, flowing colors',
          strength: 0.6
        },
        neon: {
          name: 'Neon Glow',
          prompt: 'neon glow effect, cyberpunk, bright glowing outlines',
          strength: 0.7
        },
        sketch: {
          name: 'Pencil Sketch',
          prompt: 'pencil sketch style, hand drawn, artistic lines',
          strength: 0.65
        }
      },
      // B-Roll category presets
      broll: {
        reactions: {
          name: 'Reactions',
          suggestions: [
            { emoji: '😂', prompt: 'laughing character, comedy reaction' },
            { emoji: '😱', prompt: 'shocked character, surprised face' },
            { emoji: '🤔', prompt: 'thinking character, curious expression' },
            { emoji: '😍', prompt: 'love struck character, heart eyes' },
            { emoji: '🙄', prompt: 'eye roll, annoyed expression' },
            { emoji: '👏', prompt: 'applauding, clapping hands' },
            { emoji: '😎', prompt: 'cool character, sunglasses, confident' },
            { emoji: '🤯', prompt: 'mind blown, explosive reaction' }
          ]
        },
        transitions: {
          name: 'Transitions',
          suggestions: [
            { emoji: '✨', prompt: 'sparkle transition, magical particles' },
            { emoji: '💥', prompt: 'explosion transition, impact effect' },
            { emoji: '🌊', prompt: 'wave transition, water effect' },
            { emoji: '🔥', prompt: 'fire transition, flames effect' },
            { emoji: '⚡', prompt: 'lightning transition, electric effect' },
            { emoji: '🌀', prompt: 'spiral transition, vortex effect' }
          ]
        },
        backgrounds: {
          name: 'Backgrounds',
          suggestions: [
            { emoji: '🏙️', prompt: 'city skyline, urban background' },
            { emoji: '🌲', prompt: 'forest scene, nature background' },
            { emoji: '🌌', prompt: 'space background, stars and galaxies' },
            { emoji: '🏖️', prompt: 'beach scene, tropical background' },
            { emoji: '🏔️', prompt: 'mountain landscape, scenic view' },
            { emoji: '🎪', prompt: 'carnival background, festive scene' }
          ]
        },
        effects: {
          name: 'Effects',
          suggestions: [
            { emoji: '🎉', prompt: 'confetti effect, celebration particles' },
            { emoji: '💫', prompt: 'star burst, sparkle effect' },
            { emoji: '🌈', prompt: 'rainbow effect, colorful arc' },
            { emoji: '❄️', prompt: 'snow falling, winter particles' },
            { emoji: '🍂', prompt: 'falling leaves, autumn effect' },
            { emoji: '💨', prompt: 'speed lines, motion blur' }
          ]
        }
      }
    };
  }

  /**
   * Apply loop enhancement to frames
   * @param {Array} frames - Array of frame data
   * @param {string} loopType - Type of loop enhancement
   */
  applyLoopEnhancement(frames, loopType = 'bounce') {
    if (!frames || frames.length === 0) return frames;

    switch (loopType) {
      case 'bounce':
        // Forward + Reverse (without duplicating first/last)
        return [...frames, ...frames.slice(1, -1).reverse()];

      case 'pingpong':
        // Forward + Reverse including endpoints
        return [...frames, ...frames.slice().reverse()];

      case 'seamless':
        // Already handled in GifEncoder
        return frames;

      case 'fade':
        // Would need canvas operations - return as-is for now
        return frames;

      default:
        return frames;
    }
  }

  /**
   * Generate AI B-Roll suggestion based on content
   * @param {string} frameData - Current frame data URL
   * @param {string} category - B-Roll category
   */
  async suggestBRoll(frameData, category = 'reactions') {
    const preset = this.presets.broll[category];
    if (!preset) return null;

    // Return suggestions from the preset
    return {
      category: preset.name,
      suggestions: preset.suggestions.map(s => ({
        ...s,
        id: `${category}_${s.emoji}`
      }))
    };
  }

  /**
   * Generate AI-enhanced frame with style
   * @param {Object} options - Generation options
   */
  async generateStyledFrame(options) {
    const {
      sourceFrame,
      stylePreset,
      layerType = 'interaction',
      customPrompt = ''
    } = options;

    const style = this.presets.styles[stylePreset];
    if (!style && !customPrompt) {
      throw new Error('No style preset or custom prompt provided');
    }

    const prompt = customPrompt || style.prompt;

    // Use AIService if available
    if (this.aiService) {
      try {
        const result = await this.aiService.generateFrame({
          prompt: prompt,
          frameData: sourceFrame,
          layerType: layerType,
          styleReference: sourceFrame,
          strength: style?.strength || 0.7
        });
        return result;
      } catch (error) {
        console.warn('AI generation failed, returning original frame:', error);
        return { generatedFrame: sourceFrame };
      }
    }

    return { generatedFrame: sourceFrame };
  }

  /**
   * Generate B-Roll frame from suggestion
   * @param {Object} suggestion - B-Roll suggestion object
   * @param {number} width - Frame width
   * @param {number} height - Frame height
   */
  async generateBRollFrame(suggestion, width = 800, height = 500) {
    if (this.aiService) {
      try {
        const result = await this.aiService.generateFrame({
          prompt: suggestion.prompt,
          layerType: 'interaction',
          width,
          height
        });
        return result;
      } catch (error) {
        console.warn('B-Roll generation failed:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Auto-enhance GIF frames with AI
   * @param {Array} frames - Array of frame data
   * @param {string} enhancementType - Type of enhancement
   */
  async autoEnhanceFrames(frames, enhancementType = 'sharpen') {
    // For now, return frames as-is since AI enhancement would require
    // significant API calls. This is a placeholder for future implementation.
    return frames;
  }

  /**
   * Get recommended loop type based on frame analysis
   * @param {Array} frames - Array of frame data
   */
  analyzeForLoopType(frames) {
    if (!frames || frames.length === 0) {
      return { recommended: 'bounce', reason: 'No frames to analyze' };
    }

    if (frames.length <= 4) {
      return {
        recommended: 'bounce',
        reason: 'Few frames work best with bounce loop'
      };
    }

    if (frames.length <= 10) {
      return {
        recommended: 'pingpong',
        reason: 'Medium length animations look smooth with ping pong'
      };
    }

    return {
      recommended: 'seamless',
      reason: 'Longer animations benefit from seamless cross-fade'
    };
  }

  /**
   * Get all available style presets
   */
  getStylePresets() {
    return Object.entries(this.presets.styles).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  /**
   * Get all loop presets
   */
  getLoopPresets() {
    return Object.entries(this.presets.loops).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }

  /**
   * Get B-Roll categories
   */
  getBRollCategories() {
    return Object.entries(this.presets.broll).map(([key, value]) => ({
      id: key,
      ...value
    }));
  }
}
