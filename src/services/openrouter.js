let openrouterKey = null;

try {
    const secrets = require('../../secrets.json');
    openrouterKey = secrets.openrouter?.api_key || null;
} catch (error) {
    console.warn('[OpenRouter] Could not load OpenRouter API key from secrets.json');
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
        throw new Error(`OpenRouter API error ${response.status}: ${responseText}`);
    }

    let data;
    try {
        data = JSON.parse(responseText);
    } catch (error) {
        throw new Error(`OpenRouter API returned invalid JSON: ${error.message}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
        throw new Error('OpenRouter API returned empty content');
    }

    return content.trim();
}

function hasApiKey() {
    return Boolean(openrouterKey);
}

module.exports = {
    createChatCompletion,
    hasApiKey,
};
