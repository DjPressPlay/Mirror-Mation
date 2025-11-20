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
      frameIndex,
      briaFunction,
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
      layerType: layerType,
      briaFunction: briaFunction,
      maskData: maskData,
      maskInvert: maskInvert,
      conditioningImage: conditioningImage,
      conditioningType: conditioningType,
      conditioningStrength: conditioningStrength,
      preserveRegions: preserveRegions,
      styleReference: styleReference,
      depthMap: depthMap,
      useLatentSpace: useLatentSpace,
      latentBlend: latentBlend
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
          originalPrompt: prompt,
          hasMask: !!maskData,
          hasConditioning: !!(conditioningImage || depthMap || styleReference),
          conditioningType: conditioningType,
          usedLatentSpace: useLatentSpace
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

async function callBriaAPI({ 
  apiKey, 
  prompt, 
  sourceImage, 
  layerType,
  briaFunction,
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
}) {
  const https = require('https');
  
  const briaEndpoint = 'engine.prod.bria-api.com';
  
  const endpointMap = {
    'generative-fill': '/v2/image/edit/gen_fill',
    'erase-elements': '/v2/image/edit/eraser',
    'erase-foreground': '/v2/image/edit/erase_foreground',
    'replace-background': '/v2/image/edit/replace_background',
    'remove-background': '/v2/image/edit/remove_background',
    'blur-background': '/v2/image/edit/blur_background',
    'expand': '/v2/image/edit/expand',
    'upscale': '/v2/image/edit/enhance',
    'enhance': '/v2/image/edit/enhance',
    'crop-foreground': '/v2/image/edit/crop_foreground',
    'delayer': '/v2/image/edit/delayer',
    'generate-masks': '/v2/image/edit/generate_masks'
  };
  
  const apiPath = endpointMap[briaFunction] || '/v2/image/generate';
  
  const requestPayload = buildRequestPayload({
    briaFunction,
    prompt,
    sourceImage,
    maskData,
    maskInvert,
    conditioningImage,
    conditioningType,
    conditioningStrength,
    styleReference,
    preserveRegions
  });


  const requestBody = JSON.stringify(requestPayload);

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
      timeout: 90000
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
            
            if (response.request_id && response.status_url) {
              pollAsyncRequest(response.status_url, apiKey)
                .then(result => {
                  const imageUrl = result.result?.[0]?.urls?.[0] || 
                                 result.result?.[0]?.url ||
                                 result.result?.url ||
                                 result.urls?.[0] ||
                                 result.url;

                  if (!imageUrl) {
                    reject(new Error('No image URL in Bria AI response'));
                    return;
                  }

                  fetchImageAsBase64(imageUrl)
                    .then(base64Image => {
                      resolve({
                        imageData: base64Image,
                        model: 'bria-ai-v2',
                        generationTime: Date.now(),
                        rawResponse: result
                      });
                    })
                    .catch(reject);
                })
                .catch(reject);
            } else {
              const imageUrl = response.result?.[0]?.urls?.[0] || 
                             response.result?.[0]?.url ||
                             response.result?.url ||
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
                    model: 'bria-ai-v2',
                    generationTime: Date.now(),
                    rawResponse: response
                  });
                })
                .catch(reject);
            }

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
      reject(new Error(`Request to Bria API timed out after 90 seconds (endpoint: ${apiPath})`));
    });

    req.write(requestBody);
    req.end();
  });
}

function buildRequestPayload({
  briaFunction,
  prompt,
  sourceImage,
  maskData,
  maskInvert,
  conditioningImage,
  conditioningType,
  conditioningStrength,
  styleReference,
  preserveRegions
}) {
  const payload = {
    sync: false
  };

  if (briaFunction === 'generative-fill') {
    payload.image = sourceImage;
    payload.prompt = prompt;
    payload.num_results = 1;
    if (maskData) {
      payload.mask = maskData;
    }
  } else if (briaFunction === 'erase-elements' || briaFunction === 'erase-foreground') {
    payload.image = sourceImage;
    payload.num_results = 1;
    if (maskData) {
      payload.mask = maskData;
    }
  } else if (briaFunction === 'replace-background') {
    payload.image = sourceImage;
    payload.prompt = prompt;
    payload.mode = 'high_control';
    payload.num_results = 1;
  } else if (briaFunction === 'remove-background') {
    payload.image = sourceImage;
    payload.num_results = 1;
  } else if (briaFunction === 'blur-background') {
    payload.image = sourceImage;
    payload.blur_strength = conditioningStrength || 0.8;
    payload.num_results = 1;
  } else if (briaFunction === 'expand') {
    payload.image = sourceImage;
    payload.prompt = prompt;
    payload.num_results = 1;
    if (preserveRegions) {
      payload.preserve_regions = preserveRegions;
    }
  } else if (briaFunction === 'enhance' || briaFunction === 'upscale') {
    payload.image = sourceImage;
    payload.num_results = 1;
  } else if (briaFunction === 'crop-foreground') {
    payload.image = sourceImage;
    payload.num_results = 1;
  } else if (briaFunction === 'delayer') {
    payload.image = sourceImage;
    payload.num_results = 1;
  } else if (briaFunction === 'generate-masks') {
    payload.image = sourceImage;
    payload.num_results = 1;
  } else {
    payload.prompt = prompt;
    payload.model_version = 'FIBO';
    payload.aspect_ratio = '1:1';
    payload.steps_num = 40;
    payload.num_results = 1;
    
    if (sourceImage) {
      payload.image = sourceImage;
    }
  }

  if (styleReference) {
    payload.style_reference = styleReference;
  }

  return payload;
}

async function pollAsyncRequest(statusUrl, apiKey) {
  const https = require('https');
  const maxAttempts = 90;
  const pollInterval = 2000;
  let attempt = 0;
  
  while (attempt < maxAttempts) {
    attempt++;
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    
    const result = await new Promise((resolve, reject) => {
      https.get(statusUrl, {
        headers: { 'api_token': apiKey }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    if (result.status === 'completed' || result.status === 'success') {
      return result;
    } else if (result.status === 'failed' || result.status === 'error') {
      const errorMessage = result.error || result.message || 'Unknown error';
      throw new Error(`Bria API request failed: ${errorMessage}`);
    } else if (result.status === 'pending' || result.status === 'processing' || result.status === 'queued') {
      continue;
    } else {
      throw new Error(`Unexpected Bria API status: ${result.status}`);
    }
  }
  
  throw new Error(`Bria API request timed out after ${maxAttempts * pollInterval / 1000} seconds`);
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
