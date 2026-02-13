const { createChatCompletionWithFallback } = require('./groq');
const { getConfig } = require('../config');
const conversationContextStore = require('./conversationContextStore');

const cooldowns = new Map();
let rateLimitedUntil = 0;

function getResponderConfig() {
    return getConfig().chat.responder;
}

function getBusyReply() {
    return getResponderConfig().busyReply;
}

function getFallbackReply() {
    return getResponderConfig().fallbackReply;
}

function stripBotMention(content, botUserId) {
    if (typeof content !== 'string') {
        return '';
    }

    if (!botUserId) {
        return content.replace(/\s+/g, ' ').trim();
    }

    const mentionRegex = new RegExp(`<@!?${botUserId}>`, 'g');
    return content.replace(mentionRegex, '').replace(/\s+/g, ' ').trim();
}

function consumeCooldown(guildId, userId) {
    const cooldownMs = getResponderConfig().cooldownMs;
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const lastReply = cooldowns.get(key) || 0;
    if (now - lastReply < cooldownMs) {
        return false;
    }

    cooldowns.set(key, now);

    if (cooldowns.size > 5000) {
        for (const [entryKey, timestamp] of cooldowns.entries()) {
            if (now - timestamp > cooldownMs * 3) {
                cooldowns.delete(entryKey);
            }
        }
    }

    return true;
}

function classifyError(error) {
    const message = String(error?.message || '');
    if (!message) {
        return 'unknown';
    }

    if (message.includes('429')) {
        return 'rate_limit';
    }
    if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
        return 'provider';
    }
    if (message.includes('API key not configured')) {
        return 'config';
    }
    if (message.includes('All fallback models failed')) {
        return 'model_fallback_failed';
    }

    return 'generic';
}

async function generateMentionReply(options) {
    const responderConfig = getResponderConfig();
    if (Date.now() < rateLimitedUntil) {
        return responderConfig.busyReply;
    }

    const guildId = options.guildId;
    const channelId = options.channelId;
    const authorId = options.authorId;
    const authorDisplayName = options.authorDisplayName || 'User';
    const triggerReason = options.triggerReason || 'unknown';
    const cleanedMessage = stripBotMention(options.messageContent || '', options.botUserId);
    const userMessage = cleanedMessage || '[User mentioned you without additional text]';

    conversationContextStore.appendUserTurn({
        guildId,
        channelId,
        userId: authorId,
        username: authorDisplayName,
        content: userMessage,
    });

    const historyMessages = conversationContextStore.getChatMessages({ guildId, channelId });
    const modelMessages = [
        { role: 'system', content: responderConfig.systemPrompt },
        ...historyMessages,
    ];
    const startedAt = Date.now();

    try {
        const completion = await createChatCompletionWithFallback(modelMessages, {
            models: responderConfig.models,
            maxTokens: responderConfig.maxTokens,
            temperature: responderConfig.temperature,
        });

        const text = completion.content.replace(/\s+/g, ' ').trim();
        if (!text) {
            return responderConfig.fallbackReply;
        }

        const finalText = text.slice(0, responderConfig.maxReplyChars);
        conversationContextStore.appendAssistantTurn({
            guildId,
            channelId,
            content: finalText,
        });

        const latencyMs = Date.now() - startedAt;
        console.log(
            `[Chat] channel=${channelId} trigger=${triggerReason} model=${completion.model} ` +
            `fallbacks=${completion.fallbackCount} latency_ms=${latencyMs}`
        );
        return finalText;
    } catch (error) {
        const latencyMs = Date.now() - startedAt;
        const errorType = classifyError(error);
        if (errorType === 'rate_limit') {
            rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + responderConfig.rateLimitBackoffMs);
        }
        console.error(
            `[Chat] channel=${channelId} trigger=${triggerReason} model=none ` +
            `fallbacks=${Math.max(0, responderConfig.models.length - 1)} latency_ms=${latencyMs} error_type=${errorType} ` +
            `error=${error.message}`
        );
        return errorType === 'rate_limit' ? responderConfig.busyReply : responderConfig.fallbackReply;
    }
}

module.exports = {
    getBusyReply,
    getFallbackReply,
    consumeCooldown,
    generateMentionReply,
};
