/**
 * Gemini API Module
 * Handles communication with Google Gemini API
 */
const GeminiApi = {
  MODEL: 'gemini-2.0-flash',
  API_URL: 'https://generativelanguage.googleapis.com/v1beta/models',

  /**
   * Generate prompt using Gemini API
   */
  async generatePrompt(apiKey, productImage, productName, hasPersonImage, ugcSettings, videoLength = 8) {
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${apiKey}`;

    // Resize image before sending
    const resizedImage = await ImageUtils.resizeImage(productImage);
    const base64Data = ImageUtils.getBase64Data(resizedImage);
    const mimeType = ImageUtils.getMimeType(resizedImage);

    // Build request body
    const requestBody = {
      system_instruction: {
        parts: [
          {
            text: SystemPrompt.getSystemPrompt()
          }
        ]
      },
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            },
            {
              text: SystemPrompt.buildUserMessage(productName, hasPersonImage, ugcSettings, videoLength)
            }
          ]
        }
      ],
      generationConfig: {
        temperature: SystemPrompt.getTemperature(),
        maxOutputTokens: 1024
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่สามารถสร้าง prompt ได้';
  },

  /**
   * Generate video prompt using Gemini API (text only, no image)
   */
  async generateVideoPrompt(apiKey, systemPrompt, userMessage) {
    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${apiKey}`;

    const requestBody = {
      system_instruction: {
        parts: [
          {
            text: systemPrompt
          }
        ]
      },
      contents: [
        {
          parts: [
            {
              text: userMessage
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'ไม่สามารถสร้าง prompt ได้';
  },

  /**
   * Generate text using Gemini API (simple text-only)
   */
  async generateText(prompt, apiKey) {
    if (!apiKey) {
      throw new Error('กรุณาตั้งค่า Gemini API Key ในหน้า Settings');
    }

    const url = `${this.API_URL}/${this.MODEL}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
};
