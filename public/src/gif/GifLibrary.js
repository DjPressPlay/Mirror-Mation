/**
 * GIF Library Module
 * Manages a collection of created GIFs with preview, organization, and export features
 */

export class GifLibrary {
  constructor() {
    this.gifs = [];
    this.categories = ['All', 'Reactions', 'Loops', 'Characters', 'Backgrounds', 'Custom'];
    this.selectedCategory = 'All';
    this.onGifSelect = null;
    this.onGifDelete = null;
    this.maxStorageSize = 50 * 1024 * 1024; // 50MB limit
    this.currentStorageSize = 0;

    this.loadFromStorage();
  }

  /**
   * Add a GIF to the library
   * @param {Object} gifData - GIF data object
   * @param {Blob} gifData.blob - The GIF blob
   * @param {string} gifData.url - Object URL for preview
   * @param {string} gifData.name - Display name
   * @param {string} gifData.category - Category for organization
   * @param {Array} gifData.tags - Tags for searching
   * @param {Object} gifData.metadata - Additional metadata (fps, frameCount, etc.)
   */
  addGif(gifData) {
    const gif = {
      id: this.generateId(),
      name: gifData.name || `GIF_${Date.now()}`,
      category: gifData.category || 'Custom',
      tags: gifData.tags || [],
      blob: gifData.blob,
      url: gifData.url,
      size: gifData.blob.size,
      frameCount: gifData.metadata?.frameCount || 0,
      fps: gifData.metadata?.fps || 12,
      duration: gifData.metadata?.duration || '0.00',
      width: gifData.metadata?.width || 800,
      height: gifData.metadata?.height || 500,
      createdAt: new Date().toISOString(),
      thumbnail: gifData.thumbnail || gifData.url,
      isFavorite: false
    };

    // Check storage limits
    if (this.currentStorageSize + gif.size > this.maxStorageSize) {
      throw new Error('Library storage limit reached. Please delete some GIFs to make space.');
    }

    this.gifs.unshift(gif);
    this.currentStorageSize += gif.size;
    this.saveToStorage();

    return gif;
  }

  /**
   * Remove a GIF from the library
   */
  removeGif(gifId) {
    const index = this.gifs.findIndex(g => g.id === gifId);
    if (index !== -1) {
      const gif = this.gifs[index];
      if (gif.url && gif.url.startsWith('blob:')) {
        URL.revokeObjectURL(gif.url);
      }
      this.currentStorageSize -= gif.size;
      this.gifs.splice(index, 1);
      this.saveToStorage();

      if (this.onGifDelete) {
        this.onGifDelete(gifId);
      }
    }
  }

  /**
   * Get GIFs filtered by category
   */
  getGifsByCategory(category = 'All') {
    if (category === 'All') {
      return this.gifs;
    }
    return this.gifs.filter(g => g.category === category);
  }

  /**
   * Search GIFs by name or tags
   */
  searchGifs(query) {
    if (!query) return this.gifs;

    const searchTerm = query.toLowerCase();
    return this.gifs.filter(gif => {
      return gif.name.toLowerCase().includes(searchTerm) ||
             gif.tags.some(tag => tag.toLowerCase().includes(searchTerm));
    });
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(gifId) {
    const gif = this.gifs.find(g => g.id === gifId);
    if (gif) {
      gif.isFavorite = !gif.isFavorite;
      this.saveToStorage();
    }
  }

  /**
   * Get favorite GIFs
   */
  getFavorites() {
    return this.gifs.filter(g => g.isFavorite);
  }

  /**
   * Update GIF metadata
   */
  updateGif(gifId, updates) {
    const gif = this.gifs.find(g => g.id === gifId);
    if (gif) {
      Object.assign(gif, updates);
      this.saveToStorage();
    }
  }

  /**
   * Export GIF pack as ZIP
   */
  async exportPack(gifIds, packName = 'gif-pack') {
    // Dynamic import of JSZip
    const JSZip = window.JSZip || await this.loadJSZip();
    const zip = new JSZip();

    const folder = zip.folder(packName);

    for (const gifId of gifIds) {
      const gif = this.gifs.find(g => g.id === gifId);
      if (gif && gif.blob) {
        folder.file(`${gif.name}.gif`, gif.blob);
      }
    }

    // Add metadata file
    const metadata = gifIds.map(id => {
      const gif = this.gifs.find(g => g.id === id);
      return gif ? {
        name: gif.name,
        category: gif.category,
        tags: gif.tags,
        frameCount: gif.frameCount,
        fps: gif.fps,
        duration: gif.duration
      } : null;
    }).filter(Boolean);

    folder.file('metadata.json', JSON.stringify(metadata, null, 2));

    const content = await zip.generateAsync({ type: 'blob' });
    this.downloadBlob(content, `${packName}.zip`);

    return { success: true, count: gifIds.length };
  }

  /**
   * Import GIF pack from ZIP
   */
  async importPack(zipFile) {
    const JSZip = window.JSZip || await this.loadJSZip();
    const zip = await JSZip.loadAsync(zipFile);

    let metadata = {};
    const metadataFile = zip.file(/metadata\.json$/i)[0];
    if (metadataFile) {
      const metaContent = await metadataFile.async('string');
      try {
        const metaArray = JSON.parse(metaContent);
        metaArray.forEach(m => {
          metadata[m.name] = m;
        });
      } catch (e) {
        console.warn('Could not parse metadata.json', e);
      }
    }

    const gifFiles = zip.file(/\.gif$/i);
    const imported = [];

    for (const file of gifFiles) {
      const blob = await file.async('blob');
      const name = file.name.replace(/\.gif$/i, '').split('/').pop();
      const meta = metadata[name] || {};

      const gif = this.addGif({
        blob,
        url: URL.createObjectURL(blob),
        name,
        category: meta.category || 'Custom',
        tags: meta.tags || [],
        metadata: {
          frameCount: meta.frameCount || 0,
          fps: meta.fps || 12,
          duration: meta.duration || '0.00'
        }
      });

      imported.push(gif);
    }

    return { success: true, imported };
  }

  /**
   * Load JSZip library dynamically
   */
  async loadJSZip() {
    if (window.JSZip) return window.JSZip;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('Failed to load JSZip'));
      document.head.appendChild(script);
    });
  }

  /**
   * Get storage usage info
   */
  getStorageInfo() {
    return {
      used: this.currentStorageSize,
      limit: this.maxStorageSize,
      percentage: Math.round((this.currentStorageSize / this.maxStorageSize) * 100),
      available: this.maxStorageSize - this.currentStorageSize,
      gifCount: this.gifs.length
    };
  }

  /**
   * Clear all GIFs from library
   */
  clearLibrary() {
    this.gifs.forEach(gif => {
      if (gif.url && gif.url.startsWith('blob:')) {
        URL.revokeObjectURL(gif.url);
      }
    });
    this.gifs = [];
    this.currentStorageSize = 0;
    this.saveToStorage();
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save library metadata to localStorage (blobs stored separately)
   */
  saveToStorage() {
    try {
      const metadata = this.gifs.map(gif => ({
        ...gif,
        blob: undefined, // Don't store blob in localStorage
        url: undefined   // URLs will be recreated
      }));
      localStorage.setItem('gifLibrary', JSON.stringify(metadata));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  /**
   * Load library from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem('gifLibrary');
      if (stored) {
        const metadata = JSON.parse(stored);
        this.gifs = metadata.map(m => ({
          ...m,
          blob: null,
          url: null
        }));
        this.currentStorageSize = this.gifs.reduce((sum, g) => sum + (g.size || 0), 0);
      }
    } catch (e) {
      console.warn('Could not load from localStorage:', e);
    }
  }

  /**
   * Download blob as file
   */
  downloadBlob(blob, filename) {
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
   * Create thumbnail from first frame
   */
  static async createThumbnail(gifUrl, width = 100, height = 100) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(null);
      img.src = gifUrl;
    });
  }
}
