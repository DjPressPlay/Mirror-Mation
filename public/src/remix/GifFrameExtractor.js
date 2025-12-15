/**
 * GIF Frame Extractor
 *
 * Extracts individual frames from animated GIFs for analysis and processing.
 * Uses the gifuct-js approach for parsing GIF binary data.
 */

export class GifFrameExtractor {
  constructor() {
    this.frames = [];
    this.delays = [];
    this.width = 0;
    this.height = 0;
    this.isProcessing = false;

    // Callbacks
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks) {
    if (callbacks.onProgress) this.onProgress = callbacks.onProgress;
    if (callbacks.onComplete) this.onComplete = callbacks.onComplete;
    if (callbacks.onError) this.onError = callbacks.onError;
  }

  /**
   * Extract frames from a GIF URL
   * @param {string} url - URL of the GIF to extract frames from
   */
  async extractFromUrl(url) {
    if (this.isProcessing) {
      throw new Error('Already extracting frames');
    }

    this.isProcessing = true;
    this.frames = [];
    this.delays = [];

    try {
      this.notifyProgress('fetching', 'Fetching GIF data...');

      // Fetch the GIF as binary data
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch GIF: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      this.notifyProgress('parsing', 'Parsing GIF frames...');

      // Parse the GIF
      const result = await this.parseGif(arrayBuffer);

      if (this.onComplete) {
        this.onComplete(result);
      }

      return result;

    } catch (error) {
      console.error('Frame extraction error:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Parse GIF binary data and extract frames
   * Uses canvas to render each frame
   * @param {ArrayBuffer} buffer - GIF binary data
   */
  async parseGif(buffer) {
    const gif = this.parseGifBinary(new Uint8Array(buffer));

    if (!gif) {
      throw new Error('Failed to parse GIF data');
    }

    this.width = gif.width;
    this.height = gif.height;

    // Create canvas for compositing
    const canvas = document.createElement('canvas');
    canvas.width = gif.width;
    canvas.height = gif.height;
    const ctx = canvas.getContext('2d');

    // Previous frame data for disposal methods
    let previousImageData = null;

    for (let i = 0; i < gif.frames.length; i++) {
      const frame = gif.frames[i];

      this.notifyProgress('extracting', `Extracting frame ${i + 1} of ${gif.frames.length}...`);

      // Handle disposal method
      if (frame.disposalMethod === 2) {
        // Restore to background color
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else if (frame.disposalMethod === 3 && previousImageData) {
        // Restore to previous
        ctx.putImageData(previousImageData, 0, 0);
      }

      // Store previous image data if needed
      if (gif.frames[i + 1]?.disposalMethod === 3) {
        previousImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }

      // Draw the frame
      if (frame.imageData) {
        ctx.putImageData(frame.imageData, frame.left || 0, frame.top || 0);
      }

      // Store the frame
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = canvas.width;
      frameCanvas.height = canvas.height;
      const frameCtx = frameCanvas.getContext('2d');
      frameCtx.drawImage(canvas, 0, 0);

      this.frames.push(frameCanvas.toDataURL('image/png'));
      this.delays.push(frame.delay || 100);

      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    return {
      frames: this.frames,
      delays: this.delays,
      width: this.width,
      height: this.height,
      frameCount: this.frames.length,
      duration: this.delays.reduce((sum, d) => sum + d, 0) / 1000
    };
  }

  /**
   * Parse GIF binary format
   * Simplified implementation - extracts basic frame data
   * @param {Uint8Array} data - Raw GIF bytes
   */
  parseGifBinary(data) {
    // Check for GIF signature
    const signature = String.fromCharCode(data[0], data[1], data[2]);
    if (signature !== 'GIF') {
      throw new Error('Not a valid GIF file');
    }

    const version = String.fromCharCode(data[3], data[4], data[5]);
    if (version !== '89a' && version !== '87a') {
      throw new Error(`Unsupported GIF version: ${version}`);
    }

    // Logical screen descriptor
    const width = data[6] | (data[7] << 8);
    const height = data[8] | (data[9] << 8);
    const packed = data[10];
    const hasGlobalColorTable = (packed & 0x80) !== 0;
    const colorResolution = ((packed & 0x70) >> 4) + 1;
    const globalColorTableSize = 2 << (packed & 0x07);
    const bgColorIndex = data[11];

    let offset = 13;

    // Global color table
    let globalColorTable = null;
    if (hasGlobalColorTable) {
      globalColorTable = [];
      for (let i = 0; i < globalColorTableSize; i++) {
        globalColorTable.push([data[offset++], data[offset++], data[offset++]]);
      }
    }

    const frames = [];
    let currentFrame = null;
    let graphicControlExt = null;

    // Parse blocks
    while (offset < data.length) {
      const blockType = data[offset++];

      if (blockType === 0x21) {
        // Extension block
        const extType = data[offset++];

        if (extType === 0xF9) {
          // Graphic Control Extension
          const blockSize = data[offset++];
          const packedByte = data[offset];
          const disposalMethod = (packedByte & 0x1C) >> 2;
          const hasTransparency = (packedByte & 0x01) !== 0;
          const delay = (data[offset + 1] | (data[offset + 2] << 8)) * 10; // Convert to ms
          const transparentColorIndex = data[offset + 3];

          graphicControlExt = {
            disposalMethod,
            hasTransparency,
            delay: delay || 100, // Default to 100ms if 0
            transparentColorIndex
          };

          offset += blockSize + 1; // +1 for terminator
        } else {
          // Skip other extensions
          while (data[offset] !== 0) {
            offset += data[offset] + 1;
          }
          offset++; // Block terminator
        }
      } else if (blockType === 0x2C) {
        // Image descriptor
        const left = data[offset] | (data[offset + 1] << 8);
        const top = data[offset + 2] | (data[offset + 3] << 8);
        const frameWidth = data[offset + 4] | (data[offset + 5] << 8);
        const frameHeight = data[offset + 6] | (data[offset + 7] << 8);
        const framePacked = data[offset + 8];
        const hasLocalColorTable = (framePacked & 0x80) !== 0;
        const isInterlaced = (framePacked & 0x40) !== 0;
        const localColorTableSize = 2 << (framePacked & 0x07);

        offset += 9;

        // Local color table
        let localColorTable = null;
        if (hasLocalColorTable) {
          localColorTable = [];
          for (let i = 0; i < localColorTableSize; i++) {
            localColorTable.push([data[offset++], data[offset++], data[offset++]]);
          }
        }

        const colorTable = localColorTable || globalColorTable;

        // LZW minimum code size
        const minCodeSize = data[offset++];

        // Read compressed data
        const compressedData = [];
        while (data[offset] !== 0) {
          const subBlockSize = data[offset++];
          for (let i = 0; i < subBlockSize; i++) {
            compressedData.push(data[offset++]);
          }
        }
        offset++; // Block terminator

        // Decompress LZW data
        const pixelData = this.decompressLZW(compressedData, minCodeSize, frameWidth * frameHeight);

        // Create ImageData
        const imageData = new ImageData(frameWidth, frameHeight);
        const transparentIndex = graphicControlExt?.hasTransparency
          ? graphicControlExt.transparentColorIndex
          : -1;

        // Handle interlaced images
        const rowOrder = isInterlaced
          ? this.getInterlaceRowOrder(frameHeight)
          : Array.from({ length: frameHeight }, (_, i) => i);

        for (let y = 0; y < frameHeight; y++) {
          const targetY = rowOrder[y];
          for (let x = 0; x < frameWidth; x++) {
            const pixelIndex = y * frameWidth + x;
            const colorIndex = pixelData[pixelIndex];
            const destIndex = (targetY * frameWidth + x) * 4;

            if (colorIndex === transparentIndex) {
              imageData.data[destIndex] = 0;
              imageData.data[destIndex + 1] = 0;
              imageData.data[destIndex + 2] = 0;
              imageData.data[destIndex + 3] = 0;
            } else if (colorTable && colorTable[colorIndex]) {
              const color = colorTable[colorIndex];
              imageData.data[destIndex] = color[0];
              imageData.data[destIndex + 1] = color[1];
              imageData.data[destIndex + 2] = color[2];
              imageData.data[destIndex + 3] = 255;
            }
          }
        }

        frames.push({
          left,
          top,
          width: frameWidth,
          height: frameHeight,
          imageData,
          delay: graphicControlExt?.delay || 100,
          disposalMethod: graphicControlExt?.disposalMethod || 0,
          hasTransparency: graphicControlExt?.hasTransparency || false
        });

        graphicControlExt = null;
      } else if (blockType === 0x3B) {
        // Trailer - end of GIF
        break;
      } else {
        // Unknown block, try to skip
        if (offset < data.length) {
          offset++;
        }
      }
    }

    return {
      width,
      height,
      frames,
      globalColorTable,
      bgColorIndex
    };
  }

  /**
   * LZW decompression for GIF
   */
  decompressLZW(compressedData, minCodeSize, pixelCount) {
    const clearCode = 1 << minCodeSize;
    const endCode = clearCode + 1;

    let codeSize = minCodeSize + 1;
    let nextCode = endCode + 1;
    let maxCode = 1 << codeSize;

    // Initialize dictionary
    const dictionary = {};
    for (let i = 0; i < clearCode; i++) {
      dictionary[i] = [i];
    }

    const output = [];
    let bitBuffer = 0;
    let bitCount = 0;
    let dataIndex = 0;

    const readCode = () => {
      while (bitCount < codeSize && dataIndex < compressedData.length) {
        bitBuffer |= compressedData[dataIndex++] << bitCount;
        bitCount += 8;
      }
      const code = bitBuffer & ((1 << codeSize) - 1);
      bitBuffer >>= codeSize;
      bitCount -= codeSize;
      return code;
    };

    let prevCode = null;

    while (output.length < pixelCount && dataIndex < compressedData.length) {
      const code = readCode();

      if (code === clearCode) {
        // Reset dictionary
        codeSize = minCodeSize + 1;
        maxCode = 1 << codeSize;
        nextCode = endCode + 1;
        for (const key in dictionary) {
          if (parseInt(key) > clearCode) {
            delete dictionary[key];
          }
        }
        prevCode = null;
        continue;
      }

      if (code === endCode) {
        break;
      }

      let sequence;
      if (dictionary[code] !== undefined) {
        sequence = dictionary[code];
      } else if (code === nextCode && prevCode !== null) {
        sequence = [...dictionary[prevCode], dictionary[prevCode][0]];
      } else {
        // Invalid code
        break;
      }

      output.push(...sequence);

      if (prevCode !== null && nextCode < 4096) {
        dictionary[nextCode++] = [...dictionary[prevCode], sequence[0]];

        if (nextCode >= maxCode && codeSize < 12) {
          codeSize++;
          maxCode = 1 << codeSize;
        }
      }

      prevCode = code;
    }

    return output;
  }

  /**
   * Get row order for interlaced GIFs
   */
  getInterlaceRowOrder(height) {
    const rowOrder = new Array(height);
    let row = 0;

    // Pass 1: Every 8th row, starting with row 0
    for (let y = 0; y < height; y += 8) {
      rowOrder[row++] = y;
    }
    // Pass 2: Every 8th row, starting with row 4
    for (let y = 4; y < height; y += 8) {
      rowOrder[row++] = y;
    }
    // Pass 3: Every 4th row, starting with row 2
    for (let y = 2; y < height; y += 4) {
      rowOrder[row++] = y;
    }
    // Pass 4: Every 2nd row, starting with row 1
    for (let y = 1; y < height; y += 2) {
      rowOrder[row++] = y;
    }

    return rowOrder;
  }

  /**
   * Extract frames from a File object
   * @param {File} file - GIF file
   */
  async extractFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          this.isProcessing = true;
          const result = await this.parseGif(e.target.result);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.isProcessing = false;
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Extract key frames only (for faster preview)
   * @param {string} url - GIF URL
   * @param {number} maxFrames - Maximum number of frames to extract
   */
  async extractKeyFrames(url, maxFrames = 5) {
    const result = await this.extractFromUrl(url);

    if (result.frames.length <= maxFrames) {
      return result;
    }

    // Select evenly distributed frames
    const step = Math.floor(result.frames.length / maxFrames);
    const keyFrames = [];
    const keyDelays = [];

    for (let i = 0; i < maxFrames; i++) {
      const index = Math.min(i * step, result.frames.length - 1);
      keyFrames.push(result.frames[index]);
      keyDelays.push(result.delays[index]);
    }

    return {
      frames: keyFrames,
      delays: keyDelays,
      width: result.width,
      height: result.height,
      frameCount: keyFrames.length,
      duration: keyDelays.reduce((sum, d) => sum + d, 0) / 1000,
      isKeyFramesOnly: true,
      totalFrames: result.frames.length
    };
  }

  /**
   * Notify progress callback
   */
  notifyProgress(phase, message) {
    if (this.onProgress) {
      this.onProgress({ phase, message });
    }
  }

  /**
   * Get current frames
   */
  getFrames() {
    return [...this.frames];
  }

  /**
   * Get delays
   */
  getDelays() {
    return [...this.delays];
  }

  /**
   * Clear extracted data
   */
  clear() {
    this.frames = [];
    this.delays = [];
    this.width = 0;
    this.height = 0;
  }
}
