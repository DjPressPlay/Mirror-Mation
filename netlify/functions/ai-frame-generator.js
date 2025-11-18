exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { 
      prompt, 
      frameData, 
      layerType,
      frameIndex 
    } = JSON.parse(event.body);

    if (!prompt || !frameData || !layerType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields: prompt, frameData, layerType' 
        })
      };
    }

    const briaApiKey = process.env.BRIA_API_KEY;
    
    if (!briaApiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Bria AI API key not configured',
          message: 'Please set BRIA_API_KEY environment variable in Netlify'
        })
      };
    }

    const layerPromptContext = {
      background: 'scene background environment setting location',
      character: 'character person figure subject protagonist',
      interaction: 'effect interaction overlay element prop object'
    };

    const enhancedPrompt = `${layerPromptContext[layerType]} ${prompt}`;

    const briaResponse = await callBriaAPI({
      apiKey: briaApiKey,
      prompt: enhancedPrompt,
      sourceImage: frameData,
      layerType: layerType
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        generatedFrame: briaResponse.imageData,
        prompt: enhancedPrompt,
        layerType: layerType,
        frameIndex: frameIndex,
        metadata: {
          model: briaResponse.model || 'bria-ai',
          generationTime: briaResponse.generationTime || Date.now(),
          originalPrompt: prompt
        }
      })
    };

  } catch (error) {
    console.error('AI Frame Generation Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to generate frame',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};

async function callBriaAPI({ apiKey, prompt, sourceImage, layerType }) {
  const https = require('https');
  
  const briaEndpoint = 'api.bria.ai';
  const apiPath = '/v1/text-to-image';
  
  const requestBody = JSON.stringify({
    prompt: prompt,
    num_results: 1,
    sync: true
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: briaEndpoint,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_token': apiKey,
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 60000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const response = JSON.parse(data);
            
            const imageUrl = response.result?.[0]?.urls?.[0] || 
                           response.result?.[0]?.url ||
                           response.urls?.[0] ||
                           response.url;

            if (!imageUrl) {
              reject(new Error('No image URL in Bria AI response'));
              return;
            }

            fetchImageAsBase64(imageUrl)
              .then(base64Image => {
                resolve({
                  imageData: base64Image,
                  model: 'bria-ai',
                  generationTime: Date.now(),
                  rawResponse: response
                });
              })
              .catch(reject);

          } catch (parseError) {
            reject(new Error(`Failed to parse Bria API response: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Bria API returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request to Bria API failed: ${error.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request to Bria API timed out'));
    });

    req.write(requestBody);
    req.end();
  });
}

async function fetchImageAsBase64(imageUrl) {
  const https = require('https');
  const http = require('http');
  
  return new Promise((resolve, reject) => {
    const protocol = imageUrl.startsWith('https') ? https : http;
    
    protocol.get(imageUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchImageAsBase64(res.headers.location)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
        resolve(base64);
      });
    }).on('error', reject);
  });
}
