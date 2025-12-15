/**
 * GiphyService - Handles Giphy API integration for searching and fetching GIFs
 */
export class GiphyService {
  constructor() {
    // API key will be loaded from environment via backend proxy
    this.baseUrl = '/api/giphy';
    this.searchResults = [];
    this.trending = [];
    this.isLoading = false;

    // Callbacks
    this.onResultsCallback = null;
    this.onErrorCallback = null;
    this.onLoadingCallback = null;
  }

  /**
   * Set callback for when results are ready
   */
  setResultsCallback(callback) {
    this.onResultsCallback = callback;
  }

  /**
   * Set callback for errors
   */
  setErrorCallback(callback) {
    this.onErrorCallback = callback;
  }

  /**
   * Set callback for loading state changes
   */
  setLoadingCallback(callback) {
    this.onLoadingCallback = callback;
  }

  /**
   * Update loading state and notify
   */
  setLoading(loading) {
    this.isLoading = loading;
    if (this.onLoadingCallback) {
      this.onLoadingCallback(loading);
    }
  }

  /**
   * Search for GIFs by query
   * @param {string} query - Search query (max 50 characters)
   * @param {Object} options - Search options
   * @param {number} options.limit - Number of results (default: 25, max: 50)
   * @param {number} options.offset - Pagination offset (default: 0)
   * @param {string} options.rating - Content rating (g, pg, pg-13, r)
   * @param {string} options.lang - Language code (default: en)
   */
  async search(query, options = {}) {
    if (!query || query.trim().length === 0) {
      return this.getTrending(options);
    }

    const {
      limit = 30,
      offset = 0,
      rating = 'pg-13',
      lang = 'en'
    } = options;

    this.setLoading(true);

    try {
      const params = new URLSearchParams({
        action: 'search',
        q: query.slice(0, 50), // Max 50 characters
        limit: Math.min(limit, 50),
        offset: Math.min(offset, 4999),
        rating,
        lang
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Giphy API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      this.searchResults = this.parseResults(data.data || []);

      if (this.onResultsCallback) {
        this.onResultsCallback(this.searchResults, {
          query,
          total: data.pagination?.total_count || 0,
          offset: data.pagination?.offset || 0
        });
      }

      return this.searchResults;

    } catch (error) {
      console.error('Giphy search error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      return [];
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Get trending GIFs
   * @param {Object} options - Options
   * @param {number} options.limit - Number of results (default: 30)
   * @param {number} options.offset - Pagination offset (default: 0)
   * @param {string} options.rating - Content rating (g, pg, pg-13, r)
   */
  async getTrending(options = {}) {
    const {
      limit = 30,
      offset = 0,
      rating = 'pg-13'
    } = options;

    this.setLoading(true);

    try {
      const params = new URLSearchParams({
        action: 'trending',
        limit: Math.min(limit, 50),
        offset: Math.min(offset, 4999),
        rating
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Giphy API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      this.trending = this.parseResults(data.data || []);

      if (this.onResultsCallback) {
        this.onResultsCallback(this.trending, {
          query: null,
          total: data.pagination?.total_count || 0,
          offset: data.pagination?.offset || 0,
          isTrending: true
        });
      }

      return this.trending;

    } catch (error) {
      console.error('Giphy trending error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      return [];
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Parse Giphy API results into a normalized format
   * @param {Array} results - Raw API results
   */
  parseResults(results) {
    return results.map(gif => ({
      id: gif.id,
      title: gif.title || 'Untitled GIF',
      slug: gif.slug,
      // URLs at different sizes
      urls: {
        original: gif.images?.original?.url,
        fixed_width: gif.images?.fixed_width?.url,
        fixed_height: gif.images?.fixed_height?.url,
        preview: gif.images?.preview_gif?.url || gif.images?.fixed_width_small?.url,
        thumbnail: gif.images?.fixed_width_small_still?.url || gif.images?.downsized_still?.url
      },
      // Dimensions
      width: parseInt(gif.images?.original?.width) || 480,
      height: parseInt(gif.images?.original?.height) || 270,
      // Preview dimensions for smaller sizes
      preview_width: parseInt(gif.images?.fixed_width?.width) || 200,
      preview_height: parseInt(gif.images?.fixed_width?.height) || 113,
      // Metadata
      source: gif.source,
      rating: gif.rating,
      username: gif.username,
      // Useful for attribution
      url: gif.url,
      embed_url: gif.embed_url
    }));
  }

  /**
   * Get a specific GIF by ID
   * @param {string} id - Giphy GIF ID
   */
  async getById(id) {
    this.setLoading(true);

    try {
      const params = new URLSearchParams({
        action: 'get',
        id
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Giphy API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.data) {
        return this.parseResults([data.data])[0];
      }

      return null;

    } catch (error) {
      console.error('Giphy get by ID error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Get random GIF by tag
   * @param {string} tag - Tag to search for
   * @param {string} rating - Content rating
   */
  async getRandom(tag = '', rating = 'pg-13') {
    this.setLoading(true);

    try {
      const params = new URLSearchParams({
        action: 'random',
        tag,
        rating
      });

      const response = await fetch(`${this.baseUrl}?${params}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Giphy API error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.data) {
        return this.parseResults([data.data])[0];
      }

      return null;

    } catch (error) {
      console.error('Giphy random error:', error);
      if (this.onErrorCallback) {
        this.onErrorCallback(error);
      }
      return null;
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Load a GIF image and convert it to canvas/data URL for use in the editor
   * @param {Object} gif - Parsed GIF object from search results
   * @param {string} size - Size preference: 'original', 'fixed_width', 'fixed_height', 'preview'
   */
  async loadGifAsImage(gif, size = 'fixed_width') {
    return new Promise((resolve, reject) => {
      const url = gif.urls[size] || gif.urls.fixed_width || gif.urls.original;

      if (!url) {
        reject(new Error('No URL available for this GIF'));
        return;
      }

      // For GIFs, we'll fetch the first frame as an image
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        // Create canvas from image
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        resolve({
          image: img,
          canvas: canvas,
          dataUrl: canvas.toDataURL('image/png'),
          width: img.width,
          height: img.height,
          originalGif: gif
        });
      };

      img.onerror = () => {
        reject(new Error('Failed to load GIF image'));
      };

      img.src = url;
    });
  }

  /**
   * Extract frames from an animated GIF
   * Uses a simple approach - for full frame extraction, a library like gifuct-js would be needed
   * This method returns the GIF URL for direct use
   */
  getGifUrl(gif, size = 'fixed_width') {
    return gif.urls[size] || gif.urls.fixed_width || gif.urls.original;
  }

  /**
   * Get current search results
   */
  getResults() {
    return this.searchResults;
  }

  /**
   * Get trending results
   */
  getTrendingResults() {
    return this.trending;
  }

  /**
   * Clear search results
   */
  clearResults() {
    this.searchResults = [];
  }
}
