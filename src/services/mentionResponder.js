const { getConfig } = require('../config');
const conversationContextStore = require('./conversationContextStore');
const styleContextStore = require('./styleContextStore');
const { renderPersonality } = require('./personalityRenderer');
const { generateAgentReply } = require('./agentRuntime');

const cooldowns = new Map();
let rateLimitedUntil = 0;

function getResponderConfig() {
    return getConfig().chat.responder;
}

function getPersonalityConfig() {
    return getConfig().chat.personality || {};
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

function normalizeReplyText(content) {
    if (typeof content !== 'string') {
        return '';
    }

    return content.replace(/\s+/g, ' ').trim();
}

function toToolContext(options) {
    return {
        guild: options.guild || null,
        channel: options.channel || null,
        message: options.message || null,
        requesterId: options.authorId || '',
        requesterMember: options.authorMember || null,
    };
}

async function generateMentionReply(options) {
    const responderConfig = getResponderConfig();
    const personalityConfig = getPersonalityConfig();
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
    const startedAt = Date.now();
    let agentLatencyMs = 0;
    let styleLatencyMs = 0;

    try {
        const toolContext = toToolContext(options);
        const agentStartedAt = Date.now();
        const runtimeResult = await generateAgentReply({
            historyMessages,
            responderConfig,
            toolContext,
        });
        agentLatencyMs = Date.now() - agentStartedAt;

        const rawDraft = normalizeReplyText(runtimeResult.rawDraft).slice(0, responderConfig.maxReplyChars);
        if (!rawDraft) {
            return responderConfig.fallbackReply;
        }

        conversationContextStore.appendAssistantTurn({
            guildId,
            channelId,
            content: rawDraft,
        });

        let finalReply = rawDraft;
        let styleApplied = false;
        let styleFailureReason = 'disabled';
        let driftReject = false;
        let styleModel = personalityConfig.model || 'llama-3.1-8b-instant';

        if (personalityConfig.enabled !== false) {
            const styleHistory = styleContextStore.getStyleHistory({ guildId, channelId });
            const styleStartedAt = Date.now();
            const rendered = await renderPersonality({
                rawDraft,
                styleHistory,
            });
            styleLatencyMs = Date.now() - styleStartedAt;

            styleApplied = rendered.styled;
            styleFailureReason = rendered.reason;
            driftReject = Boolean(rendered.driftReject);
            styleModel = rendered.model || styleModel;
            finalReply = normalizeReplyText(rendered.finalText || rawDraft).slice(0, responderConfig.maxReplyChars);
        }

        styleContextStore.appendAssistantStyledTurn({
            guildId,
            channelId,
            content: finalReply,
        });

        const totalLatencyMs = Date.now() - startedAt;
        const providerMeta = runtimeResult.providerMeta || {};
        const toolMeta = runtimeResult.toolMeta || {};
        console.log(
            `[Chat] channel=${channelId} trigger=${triggerReason} provider=${providerMeta.provider || 'unknown'} ` +
            `model=${providerMeta.model || 'unknown'} fallback_used=${Boolean(providerMeta.fallbackUsed)} ` +
            `fallbacks=${Number(providerMeta.fallbackCount) || 0} tool_calls=${Number(toolMeta.toolCallCount) || 0} ` +
            `agent_latency_ms=${agentLatencyMs} style_latency_ms=${styleLatencyMs} total_latency_ms=${totalLatencyMs} ` +
            `style_applied=${styleApplied} style_model=${styleModel} style_failure_reason=${styleFailureReason} drift_reject=${driftReject}`
        );

        return finalReply || responderConfig.fallbackReply;
    } catch (error) {
        const totalLatencyMs = Date.now() - startedAt;
        const errorType = classifyError(error);
        if (errorType === 'rate_limit') {
            rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + responderConfig.rateLimitBackoffMs);
        }
        console.error(
            `[Chat] channel=${channelId} trigger=${triggerReason} provider=none model=none ` +
            `fallback_used=false fallbacks=${Math.max(0, (responderConfig.models || []).length - 1)} tool_calls=0 ` +
            `agent_latency_ms=${agentLatencyMs} style_latency_ms=${styleLatencyMs} total_latency_ms=${totalLatencyMs} ` +
            `style_applied=false style_failure_reason=n/a drift_reject=false error_type=${errorType} error=${error.message}`
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
