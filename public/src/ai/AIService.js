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
      frameIndex
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
          frameIndex
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
      sectionIndex
    } = options;

    try {
      const result = await this.generateFrame({
        prompt: `${prompt}`,
        frameData: sourceFrameData,
        layerType: layerType,
        frameIndex: frameIndex
      });

      return {
        ...result,
        branchMetadata: {
          originalFrameIndex: frameIndex,
          sectionIndex: sectionIndex,
          branchPrompt: prompt,
          timestamp: Date.now()
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
}
