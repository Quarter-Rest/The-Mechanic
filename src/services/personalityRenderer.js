const { createChatCompletion } = require('./groq');
const { getConfig } = require('../config');

function normalizeText(content) {
    if (typeof content !== 'string') {
        return '';
    }

    return content.replace(/\s+/g, ' ').trim();
}

function withTimeout(promise, timeoutMs) {
    let timeoutHandle = null;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error('STYLE_TIMEOUT')), timeoutMs);
        }),
    ]).finally(() => {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    });
}

function buildRewriteMessages(options) {
    const rawDraft = options.rawDraft;
    const personalityPrompt = options.personalityPrompt;

    const systemPrompt = [
        'You are a style renderer for a Discord bot.',
        'Rewrite text for tone and personality.',
        'Keep it concise and output only the rewritten message.',
        'Do not include explanations, analysis, or extra formatting.',
    ].join(' ');

    return [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `Personality style to apply: ${personalityPrompt}` },
        { role: 'user', content: `Rewrite this draft with the configured style:\n${rawDraft}` },
    ];
}

/**
 * Render personality rewrite with no drift checks.
 * @param {object} options
 * @param {string} options.rawDraft
 * @param {string[]} options.styleHistory
 * @returns {Promise<{finalText: string, styled: boolean, reason: string, driftReject: boolean, latencyMs: number, model: string}>}
 */
async function renderPersonality(options) {
    const runtimeConfig = getConfig();
    const personalityConfig = runtimeConfig.chat?.personality || {};
    const responderConfig = runtimeConfig.chat?.responder || {};
    const rawDraft = normalizeText(options.rawDraft || '');

    if (!rawDraft) {
        return {
            finalText: '',
            styled: false,
            reason: 'empty_raw',
            driftReject: false,
            latencyMs: 0,
            model: personalityConfig.model || 'llama-3.1-8b-instant',
        };
    }

    if (personalityConfig.enabled === false) {
        return {
            finalText: rawDraft,
            styled: false,
            reason: 'disabled',
            driftReject: false,
            latencyMs: 0,
            model: personalityConfig.model || 'llama-3.1-8b-instant',
        };
    }

    const personalityPrompt = normalizeText(
        personalityConfig.prompt ||
        responderConfig.personalityPrompt ||
        responderConfig.systemPrompt ||
        'playful, snarky, lowercase discord tone'
    );
    const startedAt = Date.now();
    const timeoutMs = Math.max(200, Number(personalityConfig.maxLatencyMs) || 1200);
    const model = personalityConfig.model || 'llama-3.1-8b-instant';
    const maxOutputChars = Math.max(
        80,
        Number(personalityConfig.maxOutputChars) || Number(responderConfig.maxReplyChars) || 400
    );

    const styleMessages = buildRewriteMessages({
        rawDraft,
        personalityPrompt,
    });

    try {
        const styledText = await withTimeout(
            createChatCompletion(styleMessages, {
                model,
                maxTokens: Math.max(40, Number(personalityConfig.maxTokens) || Number(responderConfig.maxTokens) || 180),
                temperature: Number.isFinite(Number(personalityConfig.temperature))
                    ? Number(personalityConfig.temperature)
                    : 0.5,
            }),
            timeoutMs
        );

        const normalizedStyled = normalizeText(styledText).slice(0, maxOutputChars);
        if (!normalizedStyled) {
            return {
                finalText: rawDraft,
                styled: false,
                reason: 'empty_style_output',
                driftReject: false,
                latencyMs: Date.now() - startedAt,
                model,
            };
        }

        return {
            finalText: normalizedStyled,
            styled: true,
            reason: 'ok',
            driftReject: false,
            latencyMs: Date.now() - startedAt,
            model,
        };
    } catch (error) {
        const reason = String(error?.message || '').includes('STYLE_TIMEOUT')
            ? 'timeout'
            : 'provider_error';

        return {
            finalText: rawDraft,
            styled: false,
            reason,
            driftReject: false,
            latencyMs: Date.now() - startedAt,
            model,
        };
    }
}

module.exports = {
    renderPersonality,
};
