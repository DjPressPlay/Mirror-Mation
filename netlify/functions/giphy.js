/**
 * Giphy API Proxy Function
 * Proxies requests to Giphy API with API key from environment variables
 */

exports.handler = async (event) => {
  // Set CORS headers for all responses
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const giphyApiKey = process.env.GIPHY_API_KEY;

  if (!giphyApiKey) {
    console.error('GIPHY_API_KEY environment variable is not set');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Giphy API key not configured',
        message: 'Please set GIPHY_API_KEY environment variable in Netlify. Go to Site Settings > Environment Variables and add GIPHY_API_KEY with your Giphy API key from https://developers.giphy.com'
      })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const action = params.action || 'trending';

    let giphyUrl;
    const baseUrl = 'https://api.giphy.com/v1/gifs';

    // Build query parameters
    const queryParams = new URLSearchParams({
      api_key: giphyApiKey,
      limit: params.limit || '25',
      offset: params.offset || '0',
      rating: params.rating || 'pg-13'
    });

    switch (action) {
      case 'search':
        if (!params.q) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Search query (q) is required for search action' })
          };
        }
        queryParams.append('q', params.q);
        queryParams.append('lang', params.lang || 'en');
        giphyUrl = `${baseUrl}/search?${queryParams}`;
        break;

      case 'trending':
        giphyUrl = `${baseUrl}/trending?${queryParams}`;
        break;

      case 'get':
        if (!params.id) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'GIF ID is required for get action' })
          };
        }
        giphyUrl = `${baseUrl}/${params.id}?api_key=${giphyApiKey}`;
        break;

      case 'random':
        if (params.tag) {
          queryParams.append('tag', params.tag);
        }
        giphyUrl = `${baseUrl}/random?${queryParams}`;
        break;

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Unknown action: ${action}` })
        };
    }

    // Fetch from Giphy API using native fetch (available in Node 18+)
    const response = await fetch(giphyUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Giphy API error: ${response.status} - ${errorText}`);
      throw new Error(`Giphy API returned status ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('Giphy API Error:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch from Giphy',
        message: error.message
      })
    };
  }
};
