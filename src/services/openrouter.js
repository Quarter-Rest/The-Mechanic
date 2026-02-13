let openrouterKey = null;

try {
    const secrets = require('../../secrets.json');
    openrouterKey = secrets.openrouter?.api_key || null;
} catch (error) {
    console.warn('[OpenRouter] Could not load OpenRouter API key from secrets.json');
}

const RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function createRetryableError(message, retryable) {
    const error = new Error(message);
    error.retryable = retryable;
    return error;
}

/**
 * Send a chat completion request to OpenRouter.
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [options]
 * @param {string} [options.model]
 * @param {number} [options.maxTokens]
 * @param {number} [options.temperature]
 * @returns {Promise<string>}
 */
async function createChatCompletion(messages, options = {}) {
    if (!openrouterKey) {
        throw new Error('OpenRouter API key not configured in secrets.json');
    }

    const model = options.model || 'openrouter/free';
    const maxTokens = options.maxTokens ?? 500;
    const temperature = options.temperature ?? 0.5;
    const attempts = Math.max(1, Number(options.attempts) || 3);
    const baseDelayMs = Math.max(100, Number(options.baseDelayMs) || 600);

    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openrouterKey}`
                },
                body: JSON.stringify({
                    model,
                    max_tokens: maxTokens,
                    temperature,
                    messages
                })
            });

            const responseText = await response.text();

            if (!response.ok) {
                const retryable = RETRYABLE_STATUS_CODES.has(response.status);
                throw createRetryableError(`OpenRouter API error ${response.status}: ${responseText}`, retryable);
            }

            let data;
            try {
                data = JSON.parse(responseText);
            } catch (error) {
                throw createRetryableError(`OpenRouter API returned invalid JSON: ${error.message}`, true);
            }

            const content = data.choices?.[0]?.message?.content;
            if (!content || typeof content !== 'string' || !content.trim()) {
                throw createRetryableError('OpenRouter API returned empty content', true);
            }

            return content.trim();
        } catch (error) {
            lastError = error;
            const retryable = error?.retryable !== false;

            if (!retryable || attempt >= attempts) {
                throw error;
            }

            const delay = baseDelayMs * attempt;
            console.warn(`[OpenRouter] Attempt ${attempt}/${attempts} failed (${error.message}). Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }

    throw lastError || new Error('OpenRouter request failed');
}

function hasApiKey() {
    return Boolean(openrouterKey);
}

module.exports = {
    createChatCompletion,
    hasApiKey,
};
