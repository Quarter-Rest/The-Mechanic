const { getConfig } = require('../config');

const contexts = new Map();
let sweepTimer = null;

function getPersonalityConfig() {
    return getConfig().chat.personality || {};
}

function getContextConfig() {
    return getConfig().chat.context || {};
}

function toKey(guildId, channelId) {
    return `${guildId}:${channelId}`;
}

function normalizeText(content, maxLength) {
    if (typeof content !== 'string') {
        return '';
    }

    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '';
    }

    return normalized.slice(0, maxLength);
}

function touchContext(context) {
    context.lastActiveAt = Date.now();
}

function getOrCreateContext(guildId, channelId) {
    const key = toKey(guildId, channelId);
    let context = contexts.get(key);
    if (!context) {
        context = {
            turns: [],
            lastActiveAt: Date.now(),
        };
        contexts.set(key, context);
    }

    touchContext(context);
    return context;
}

function trimTurns(context) {
    const maxTurns = Math.max(1, Number(getPersonalityConfig().maxStyleHistoryTurns) || 8);
    if (context.turns.length <= maxTurns) {
        return;
    }

    context.turns.splice(0, context.turns.length - maxTurns);
}

function appendAssistantStyledTurn(options) {
    const guildId = options.guildId;
    const channelId = options.channelId;
    const fallbackMaxChars = Number(getConfig().chat?.responder?.maxReplyChars) || 400;
    const maxChars = Math.max(80, Number(getPersonalityConfig().maxOutputChars) || fallbackMaxChars);
    const content = normalizeText(options.content, maxChars);

    if (!content) {
        return false;
    }

    const context = getOrCreateContext(guildId, channelId);
    context.turns.push({
        role: 'assistant',
        content,
        timestamp: Date.now(),
    });
    trimTurns(context);
    return true;
}

function getStyleHistory(options) {
    const key = toKey(options.guildId, options.channelId);
    const context = contexts.get(key);
    if (!context) {
        return [];
    }

    touchContext(context);
    return context.turns.map(turn => turn.content);
}

function clearChannelContext(options) {
    return contexts.delete(toKey(options.guildId, options.channelId));
}

function sweepExpiredContexts() {
    const contextConfig = getContextConfig();
    const channelTtlMs = Math.max(60 * 1000, Number(contextConfig.channelTtlMs) || (6 * 60 * 60 * 1000));
    const now = Date.now();
    let deleted = 0;

    for (const [key, context] of contexts.entries()) {
        if (now - context.lastActiveAt > channelTtlMs) {
            contexts.delete(key);
            deleted++;
        }
    }

    return deleted;
}

function startSweepTimer() {
    const contextConfig = getContextConfig();
    const sweepIntervalMs = Math.max(30 * 1000, Number(contextConfig.sweepIntervalMs) || (10 * 60 * 1000));

    if (sweepTimer) {
        clearInterval(sweepTimer);
    }

    sweepTimer = setInterval(() => {
        const deleted = sweepExpiredContexts();
        if (deleted > 0) {
            console.log(`[StyleContextStore] Swept ${deleted} expired channel context(s)`);
        }
    }, sweepIntervalMs);

    if (typeof sweepTimer.unref === 'function') {
        sweepTimer.unref();
    }
}

function reconfigure() {
    startSweepTimer();
}

startSweepTimer();

module.exports = {
    appendAssistantStyledTurn,
    getStyleHistory,
    clearChannelContext,
    sweepExpiredContexts,
    reconfigure,
};
