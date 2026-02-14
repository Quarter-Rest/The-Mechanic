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
    const match = message.match(/OpenRouter API error (\d{3})/);
    if (!match) {
        return null;
    }
    return Number(match[1]);
}

function compactErrorMessage(error) {
    const message = String(error?.message || 'unknown error').replace(/\s+/g, ' ').trim();
    return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

function sanitizeModelList(models) {
    if (!Array.isArray(models)) {
        return [];
    }

    return models
        .filter(model => typeof model === 'string' && model.trim())
        .map(model => model.trim());
}

/**
 * Send a chat completion request to OpenRouter.
 * @param {Array<object>} messages
 * @param {object} [options]
 * @param {string} [options.model]
 * @param {number} [options.maxTokens]
 * @param {number} [options.temperature]
 * @param {Array<object>} [options.tools]
 * @param {string|object} [options.toolChoice]
 * @returns {Promise<{message: object, raw: object}>}
 */
async function createChatCompletionResponse(messages, options = {}) {
    const runtimeConfig = getConfig();
    const openrouterConfig = runtimeConfig.openrouter || {};
    const apiKey = openrouterConfig.apiKey;

    if (!apiKey) {
        throw new Error('OpenRouter API key not configured in secrets.json (openrouter.api_key) or OPENROUTER_API_KEY');
    }

    const model = options.model || 'openrouter/free';
    const maxTokens = options.maxTokens ?? 500;
    const temperature = options.temperature ?? 0.5;
    const attempts = Math.max(1, Number(options.attempts ?? openrouterConfig.attempts) || 1);
    const baseDelayMs = Math.max(100, Number(options.baseDelayMs ?? openrouterConfig.baseDelayMs) || 500);
    const retryOnRateLimit = Boolean(options.retryOnRateLimit ?? openrouterConfig.retryOnRateLimit);

    const requestModels = sanitizeModelList(options.requestModels);

    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const requestBody = {
                model,
                max_tokens: maxTokens,
                temperature,
                messages,
            };

            if (requestModels.length) {
                requestBody.models = requestModels;
            }

            if (Array.isArray(options.tools) && options.tools.length > 0) {
                requestBody.tools = options.tools;
            }

            if (options.toolChoice) {
                requestBody.tool_choice = options.toolChoice;
            }

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify(requestBody),
            });

            const responseText = await response.text();
            if (!response.ok) {
                const retryable = response.status === 429
                    ? retryOnRateLimit
                    : RETRYABLE_STATUS_CODES.has(response.status);
                throw createRetryableError(`OpenRouter API error ${response.status}: ${responseText}`, retryable);
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (error) {
                throw createRetryableError(`OpenRouter API returned invalid JSON: ${error.message}`, true);
            }

            const message = data.choices?.[0]?.message;
            if (!message || typeof message !== 'object') {
                throw createRetryableError('OpenRouter API returned empty message', true);
            }

            const content = typeof message.content === 'string'
                ? message.content.trim()
                : '';
            const toolCalls = Array.isArray(message.tool_calls)
                ? message.tool_calls
                : [];

            if (!content && toolCalls.length === 0) {
                throw createRetryableError('OpenRouter API returned empty content', true);
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
            console.warn(`[OpenRouter] Attempt ${attempt}/${attempts} failed (${compactErrorMessage(error)}). Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }

    throw lastError || new Error('OpenRouter request failed');
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
        throw createRetryableError('OpenRouter API returned empty content', true);
    }

    return content.trim();
}

/**
 * Try multiple OpenRouter models in order and return first successful response.
 * @param {Array<object>} messages
 * @param {object} [options]
 * @param {string[]} [options.models]
 * @returns {Promise<{message: object, model: string, fallbackCount: number, attemptedModels: string[]}>}
 */
async function createChatCompletionWithFallbackResponse(messages, options = {}) {
    const models = sanitizeModelList(options.models);

    if (!models.length) {
        const selectedModel = options.model || 'openrouter/free';
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

    try {
        const model = models[0];
        const response = await createChatCompletionResponse(messages, {
            ...singleModelOptions,
            model,
            requestModels: models,
        });

        return {
            message: response.message,
            model,
            fallbackCount: 0,
            attemptedModels: [...models],
        };
    } catch (combinedError) {
        const statusCode = parseStatusCode(combinedError);
        if (statusCode === 429 || statusCode >= 500) {
            console.warn(`[OpenRouter] Combined fallback request failed with status ${statusCode}, trying sequential fallback`);
        } else {
            console.warn(`[OpenRouter] Combined fallback request failed: ${compactErrorMessage(combinedError)}. Trying sequential fallback`);
        }
    }

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

            if (index < models.length - 1) {
                const statusCode = parseStatusCode(error);
                if (statusCode === 429 || statusCode >= 500) {
                    console.warn(`[OpenRouter] Falling back from ${model} due to status ${statusCode}`);
                } else {
                    console.warn(`[OpenRouter] Falling back from ${model}: ${compactErrorMessage(error)}`);
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
 * Try multiple models and return first successful plain-text completion.
 * @param {Array<object>} messages
 * @param {object} [options]
 * @returns {Promise<{content: string, model: string, fallbackCount: number, attemptedModels: string[]}>}
 */
async function createChatCompletionWithFallback(messages, options = {}) {
    const response = await createChatCompletionWithFallbackResponse(messages, options);
    const content = response?.message?.content;
    if (!content || typeof content !== 'string' || !content.trim()) {
        throw new Error('OpenRouter API returned empty content');
    }

    return {
        content: content.trim(),
        model: response.model,
        fallbackCount: response.fallbackCount,
        attemptedModels: response.attemptedModels,
    };
}

function hasApiKey() {
    return Boolean(getConfig().openrouter?.apiKey);
}

module.exports = {
    createChatCompletionResponse,
    createChatCompletion,
    createChatCompletionWithFallbackResponse,
    createChatCompletionWithFallback,
    hasApiKey,
};
