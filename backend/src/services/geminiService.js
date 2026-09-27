const path = require('path');

// Dynamically attempt to load official SDK from local node_modules or parent
let GoogleGenerativeAI = null;
try {
  const genAiPkg = require('@google/generative-ai');
  GoogleGenerativeAI = genAiPkg.GoogleGenerativeAI || genAiPkg.default || genAiPkg;
} catch (e1) {
  try {
    const parentPkg = require(path.join(__dirname, '../../../node_modules/@google/generative-ai'));
    GoogleGenerativeAI = parentPkg.GoogleGenerativeAI || parentPkg.default || parentPkg;
  } catch (e2) {
    console.warn('[GeminiService] @google/generative-ai SDK not found in standard paths. Will use resilient REST transport.');
  }
}

const SYSTEM_PROMPT = `You are BSC Enterprise AI Assistant — an intelligent, helpful internal assistant for BSC Textiles staff across all three flagship stores: Belagavi, Davanagere, and Shivamogga.
Your capabilities:
1. HR & Staff: Employee directory, attendance policies, candidate hiring pipeline, offer letters, joining schedules.
2. Store Operations: Daily MCheck checklists, section allocations, visual merchandising, cash settlement, sourcing diverts.
3. Wedding CRM: Wedding customer registrations, bridal follow-ups, calling desk queues, consultation scheduling.
4. Customer Experience: CSAT feedback scores, store ratings, customer requests.

Guidelines:
- Be concise, professional, courteous, and accurate.
- Keep standard responses under 180 words unless the user requests detailed instructions or analysis.
- If you don't have access to live database records for a specific employee or customer ID, politely guide the user to the corresponding module in the BSC ERP/CRM.`;

const SUPPORTED_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-pro'
];

class GeminiService {
  /**
   * Retrieve active API key dynamically from environment
   */
  getApiKey() {
    return (process.env.GEMINI_API_KEY || '').trim();
  }

  /**
   * Retrieve active model name
   */
  getModel() {
    return (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  }

  /**
   * Diagnostic health check for the Gemini integration
   */
  async checkHealth() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return {
        configured: false,
        status: 'MISSING_API_KEY',
        message: 'GEMINI_API_KEY is not configured in backend/.env'
      };
    }

    const maskedKey = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '****';
    const model = this.getModel();

    try {
      const result = await this.callRestApi('Health check probe. Reply with "OK".', [], model, 10000);
      return {
        configured: true,
        status: 'READY',
        model,
        keyFormat: apiKey.startsWith('AQ.') ? 'Authorization Key (AQ.)' : 'Standard Key',
        maskedKey,
        probeResponse: result
      };
    } catch (err) {
      return {
        configured: true,
        status: 'ERROR',
        model,
        keyFormat: apiKey.startsWith('AQ.') ? 'Authorization Key (AQ.)' : 'Standard Key',
        maskedKey,
        error: err.message,
        details: err.details || null
      };
    }
  }

  /**
   * Primary entry point: generate a contextual AI response
   */
  async generateResponse(userMessage, contextMessages = []) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      const err = new Error('Gemini API key is not configured. Please add GEMINI_API_KEY to your environment or backend/.env file.');
      err.code = 'CONFIG_MISSING';
      err.status = 500;
      throw err;
    }

    const trimmedMsg = String(userMessage || '').trim();
    if (!trimmedMsg) {
      const err = new Error('User message cannot be empty.');
      err.code = 'INVALID_INPUT';
      err.status = 400;
      throw err;
    }

    if (trimmedMsg.length > 4000) {
      const err = new Error('Message is too long. Please limit your prompt to 4000 characters.');
      err.code = 'INPUT_TOO_LONG';
      err.status = 400;
      throw err;
    }

    const primaryModel = this.getModel();
    const candidateModels = [primaryModel, ...SUPPORTED_MODELS.filter(m => m !== primaryModel)];

    let lastError = null;
    for (const model of candidateModels) {
      try {
        // Try SDK first if available
        if (GoogleGenerativeAI) {
          try {
            return await this.callSdk(trimmedMsg, contextMessages, model, apiKey);
          } catch (sdkErr) {
            // If SDK error was auth failure or invalid key, don't retry same model on REST
            if (sdkErr.code === 'AUTH_ERROR') throw sdkErr;
            // Otherwise attempt REST transport
            return await this.callRestApi(trimmedMsg, contextMessages, model, 30000);
          }
        } else {
          return await this.callRestApi(trimmedMsg, contextMessages, model, 30000);
        }
      } catch (err) {
        lastError = err;
        // If authentication error or API key service blocked, fallback to other models will not help
        if (err.code === 'AUTH_ERROR' || err.code === 'SERVICE_BLOCKED') {
          throw err;
        }
        console.warn(`[GeminiService] Model ${model} failed: ${err.message}. Trying next fallback model...`);
      }
    }

    throw lastError || new Error('Failed to generate AI response from Gemini.');
  }

  /**
   * SDK-based implementation
   */
  async callSdk(userMessage, contextMessages, modelName, apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT
      });

      const history = [];
      for (const msg of contextMessages) {
        if (!msg || !msg.message_text) continue;
        history.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: String(msg.message_text).trim() }]
        });
      }

      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      });

      const result = await chat.sendMessage(userMessage);
      const response = await result.response;
      const text = response.text();

      if (text && text.trim()) {
        return text.trim();
      }
      throw new Error('Gemini returned an empty response.');
    } catch (err) {
      this.handleApiError(err);
    }
  }

  /**
   * Resilient direct REST implementation with AbortController timeout & dual header/query support
   */
  async callRestApi(userMessage, contextMessages, modelName, timeoutMs = 30000) {
    const apiKey = this.getApiKey();
    const contents = [];

    // System instruction is prepended as conversation primer
    contents.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT }] });
    contents.push({
      role: 'model',
      parts: [{ text: 'Understood. I am the BSC Enterprise AI Assistant. How may I assist you with store operations, CRM, HR, or customer inquiries today?' }]
    });

    for (const msg of contextMessages) {
      if (!msg || !msg.message_text) continue;
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: String(msg.message_text).trim() }]
      });
    }

    // Add current user prompt
    contents.push({ role: 'user', parts: [{ text: userMessage }] });

    const payload = {
      contents,
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }
      ]
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Use both header and query key for maximum gateway compatibility
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.handleRestError(response.status, errorData);
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];

      if (candidate?.finishReason === 'SAFETY') {
        const err = new Error('The AI response was filtered by Google content safety policies.');
        err.code = 'SAFETY_FILTER';
        throw err;
      }

      const text = candidate?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }

      throw new Error('Gemini received the request but generated no text response.');
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`Gemini request timed out after ${timeoutMs / 1000}s.`);
        timeoutErr.code = 'TIMEOUT';
        timeoutErr.status = 504;
        throw timeoutErr;
      }
      throw err;
    }
  }

  /**
   * Translate Google REST errors into actionable business diagnostics
   */
  handleRestError(status, errorData) {
    const errObj = errorData?.error || {};
    const message = errObj.message || 'Unknown error occurred while contacting Google Gemini.';
    const reason = errObj.details?.[0]?.reason || errObj.status || '';

    console.error(`[Gemini REST Error ${status}] Reason: ${reason} | Message: ${message}`);

    const err = new Error();
    err.status = status;
    err.details = errObj;

    if (status === 401 || status === 403 || reason === 'ACCESS_TOKEN_TYPE_UNSUPPORTED' || reason === 'API_KEY_SERVICE_BLOCKED') {
      err.code = reason === 'API_KEY_SERVICE_BLOCKED' ? 'SERVICE_BLOCKED' : 'AUTH_ERROR';
      err.message = reason === 'API_KEY_SERVICE_BLOCKED'
        ? 'Google Gemini API key has API restrictions or Generative Language API is disabled for this project (API_KEY_SERVICE_BLOCKED). Please enable Generative Language API in Google Cloud / AI Studio.'
        : 'Google Gemini API Authentication Failed. Please verify your GEMINI_API_KEY in backend/.env.';
    } else if (status === 429) {
      err.code = 'RATE_LIMIT';
      err.message = 'Gemini API rate limit exceeded. Please wait a moment before sending another message.';
    } else if (status === 404) {
      err.code = 'MODEL_NOT_FOUND';
      err.message = 'The configured Gemini model was not found or is deprecated.';
    } else {
      err.code = 'API_ERROR';
      err.message = message || 'Google Gemini service encountered an error.';
    }

    throw err;
  }

  /**
   * Translate SDK errors
   */
  handleApiError(err) {
    const msg = err.message || '';
    if (msg.includes('401') || msg.includes('API_KEY_SERVICE_BLOCKED') || msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED')) {
      const customErr = new Error('Google Gemini API authentication failed. Please verify that your GEMINI_API_KEY is active and Generative Language API is enabled.');
      customErr.code = 'AUTH_ERROR';
      customErr.status = 401;
      throw customErr;
    }
    if (msg.includes('429')) {
      const customErr = new Error('Gemini quota or rate limit exceeded. Please retry in a few moments.');
      customErr.code = 'RATE_LIMIT';
      customErr.status = 429;
      throw customErr;
    }
    throw err;
  }
}

module.exports = new GeminiService();
