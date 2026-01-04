/**
 * OpenAI API Module
 * Handles communication with OpenAI API (Responses API for vision)
 */
const OpenaiApi = {
  MODEL: 'gpt-5-nano',
  API_URL: 'https://api.openai.com/v1/responses',

  /**
   * Generate prompt using OpenAI Responses API (vision)
   */
  async generatePrompt(apiKey, productImage, productName, hasPersonImage, ugcSettings, videoLength = 8) {
    // Resize image before sending
    const resizedImage = await ImageUtils.resizeImage(productImage);

    // Build request body using Responses API format
    // Note: GPT-5 models don't support temperature parameter
    const requestBody = {
      model: this.MODEL,
      instructions: SystemPrompt.getSystemPrompt(),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: resizedImage,
              detail: 'low'
            },
            {
              type: 'input_text',
              text: SystemPrompt.buildUserMessage(productName, hasPersonImage, ugcSettings, videoLength)
            }
          ]
        }
      ]
    };

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    console.log('OpenAI API Response:', data);

    // Extract text from output array
    const textOutput = data.output?.find(item => item.type === 'message');
    const content = textOutput?.content?.find(c => c.type === 'output_text');
    return content?.text || data.output_text || 'ไม่สามารถสร้าง prompt ได้';
  },

  /**
   * Generate video prompt using OpenAI Responses API (text only)
   */
  async generateVideoPrompt(apiKey, systemPrompt, userMessage) {
    const requestBody = {
      model: this.MODEL,
      instructions: systemPrompt,
      input: userMessage
    };

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();

    // Extract text from output array
    const textOutput = data.output?.find(item => item.type === 'message');
    const content = textOutput?.content?.find(c => c.type === 'output_text');
    return content?.text || data.output_text || 'ไม่สามารถสร้าง prompt ได้';
  },

  /**
   * Generate text using OpenAI Responses API (simple text-only)
   */
  async generateText(prompt, apiKey) {
    if (!apiKey) {
      throw new Error('กรุณาตั้งค่า OpenAI API Key ในหน้า Settings');
    }

    const requestBody = {
      model: this.MODEL,
      instructions: 'You are a helpful assistant.',
      input: prompt
    };

    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();

    // Extract text from output array
    const textOutput = data.output?.find(item => item.type === 'message');
    const content = textOutput?.content?.find(c => c.type === 'output_text');
    return content?.text || data.output_text || '';
  }
};
