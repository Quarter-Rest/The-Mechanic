const { getConfig } = require('../config');

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createRetryableError(message, retryable) {
    const error = new Error(message);
    error.retryable = retryable;
    return error;
}

function parseStatusCode(error) {
    const message = String(error?.message || '');
    const match = message.match(/Groq API error (\d{3})/);
    if (!match) {
        return null;
    }
    return Number(match[1]);
}

function compactErrorMessage(error) {
    const message = String(error?.message || 'unknown error').replace(/\s+/g, ' ').trim();
    if (message.includes('tool_use_failed')) {
        return 'Groq API tool_use_failed (model generated invalid tool call)';
    }
    return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

/**
 * Send a chat completion request to Groq (OpenAI-compatible API).
 * @param {Array<object>} messages
 * @param {object} [options]
 * @param {string} [options.model]
 * @param {number} [options.maxTokens]
 * @param {number} [options.temperature]
 * @param {Array<object>} [options.tools]
 * @param {string|object} [options.toolChoice]
 * @param {boolean} [options.parallelToolCalls]
 * @returns {Promise<{message: object, raw: object}>}
 */
async function createChatCompletionResponse(messages, options = {}) {
    const runtimeConfig = getConfig();
    const groqConfig = runtimeConfig.groq || {};
    const groqKey = groqConfig.apiKey;

    if (!groqKey) {
        throw new Error('Groq API key not configured in secrets.json (groq.api_key) or GROQ_API_KEY');
    }

    const model = options.model || 'llama-3.3-70b-versatile';
    const maxTokens = options.maxTokens ?? 500;
    const temperature = options.temperature ?? 0.7;
    const attempts = Math.max(1, Number(options.attempts ?? groqConfig.attempts) || 1);
    const baseDelayMs = Math.max(100, Number(options.baseDelayMs ?? groqConfig.baseDelayMs) || 500);
    const retryOnRateLimit = Boolean(options.retryOnRateLimit ?? groqConfig.retryOnRateLimit);

    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const body = {
                model,
                messages,
                max_tokens: maxTokens,
                temperature,
            };

            if (Array.isArray(options.tools) && options.tools.length > 0) {
                body.tools = options.tools;
            }

            if (options.toolChoice) {
                body.tool_choice = options.toolChoice;
            }

            if (typeof options.parallelToolCalls === 'boolean') {
                body.parallel_tool_calls = options.parallelToolCalls;
            }

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${groqKey}`,
                },
                body: JSON.stringify(body),
            });

            const responseText = await response.text();
            if (!response.ok) {
                const retryable = response.status === 429
                    ? retryOnRateLimit
                    : RETRYABLE_STATUS_CODES.has(response.status);
                throw createRetryableError(`Groq API error ${response.status}: ${responseText}`, retryable);
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (error) {
                throw createRetryableError(`Groq API returned invalid JSON: ${error.message}`, true);
            }

            const message = data.choices?.[0]?.message;
            if (!message || typeof message !== 'object') {
                throw createRetryableError('Groq API returned empty message', true);
            }

            const content = typeof message.content === 'string'
                ? message.content.trim()
                : '';
            const toolCalls = Array.isArray(message.tool_calls)
                ? message.tool_calls
                : [];

            if (!content && toolCalls.length === 0) {
                throw createRetryableError('Groq API returned empty content', true);
            }

            return {
                message: {
                    role: 'assistant',
                    content,
                    tool_calls: toolCalls,
                },
                raw: data,
            };
        } catch (error) {
            lastError = error;
            const retryable = error?.retryable !== false;

            if (!retryable || attempt >= attempts) {
                throw error;
            }

            const delay = baseDelayMs * attempt;
            console.warn(`[Groq] Attempt ${attempt}/${attempts} failed (${compactErrorMessage(error)}). Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }

    throw lastError || new Error('Groq request failed');
}

/**
 * Send a chat completion request and return plain assistant text.
 * @param {Array<object>} messages
 * @param {object} [options]
 * @returns {Promise<string>}
 */
async function createChatCompletion(messages, options = {}) {
    const response = await createChatCompletionResponse(messages, options);
    const content = response?.message?.content;
    if (!content || typeof content !== 'string' || !content.trim()) {
        throw createRetryableError('Groq API returned empty content', true);
    }

    return content.trim();
}

/**
 * Try multiple Groq models in order and return the first successful completion.
 * @param {Array<object>} messages
 * @param {object} [options]
 * @param {string[]} [options.models]
 * @returns {Promise<{message: object, model: string, fallbackCount: number, attemptedModels: string[]}>}
 */
async function createChatCompletionWithFallbackResponse(messages, options = {}) {
    const models = Array.isArray(options.models)
        ? options.models.filter(model => typeof model === 'string' && model.trim())
        : [];

    if (!models.length) {
        const selectedModel = options.model || 'llama-3.3-70b-versatile';
        const response = await createChatCompletionResponse(messages, options);
        return {
            message: response.message,
            model: selectedModel,
            fallbackCount: 0,
            attemptedModels: [selectedModel],
        };
    }

    const singleModelOptions = { ...options };
    delete singleModelOptions.models;

    const attemptedModels = [];
    const failures = [];

    for (let index = 0; index < models.length; index++) {
        const model = models[index];
        attemptedModels.push(model);

        try {
            const response = await createChatCompletionResponse(messages, {
                ...singleModelOptions,
                model,
            });

            return {
                message: response.message,
                model,
                fallbackCount: index,
                attemptedModels: [...attemptedModels],
            };
        } catch (error) {
            failures.push({ model, error });

            if (String(error?.message || '').includes('API key not configured')) {
                throw error;
            }

            const statusCode = parseStatusCode(error);
            if (index < models.length - 1) {
                if (statusCode === 429 || statusCode >= 500) {
                    console.warn(`[Groq] Falling back from ${model} due to status ${statusCode}`);
                } else {
                    console.warn(`[Groq] Falling back from ${model}: ${compactErrorMessage(error)}`);
                }
                continue;
            }

            const summary = failures
                .map(entry => `${entry.model}: ${compactErrorMessage(entry.error)}`)
                .join(' | ');
            throw new Error(`All fallback models failed. ${summary}`);
        }
    }

    throw new Error('All fallback models failed');
}

/**
 * Try multiple Groq models in order and return the first successful plain-text completion.
 * @param {Array<object>} messages
 * @param {object} [options]
 * @returns {Promise<{content: string, model: string, fallbackCount: number, attemptedModels: string[]}>}
 */
async function createChatCompletionWithFallback(messages, options = {}) {
    const response = await createChatCompletionWithFallbackResponse(messages, options);
    const content = response?.message?.content;
    if (!content || typeof content !== 'string' || !content.trim()) {
        throw new Error('Groq API returned empty content');
    }

    return {
        content: content.trim(),
        model: response.model,
        fallbackCount: response.fallbackCount,
        attemptedModels: response.attemptedModels,
    };
}

function hasApiKey() {
    return Boolean(getConfig().groq?.apiKey);
}

module.exports = {
    createChatCompletionResponse,
    createChatCompletion,
    createChatCompletionWithFallbackResponse,
    createChatCompletionWithFallback,
    hasApiKey,
};
