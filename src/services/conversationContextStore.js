const contexts = new Map();

const MAX_TURNS_PER_CHANNEL = 24;
const MAX_CONTENT_CHARS_PER_TURN = 500;
const CHANNEL_TTL_MS = 6 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;

function toKey(guildId, channelId) {
    return `${guildId}:${channelId}`;
}

function normalizeText(content, maxLength = MAX_CONTENT_CHARS_PER_TURN) {
    if (typeof content !== 'string') {
        return '';
    }

    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '';
    }

    return normalized.slice(0, maxLength);
}

function safeField(value, maxLength = 120) {
    const normalized = normalizeText(String(value || ''), maxLength);
    return normalized.replace(/\]/g, '').trim();
}

function touchContext(context) {
    context.lastActiveAt = Date.now();
}

function trimTurns(context) {
    if (context.turns.length <= MAX_TURNS_PER_CHANNEL) {
        return;
    }

    context.turns.splice(0, context.turns.length - MAX_TURNS_PER_CHANNEL);
}

function getOrCreateContext(guildId, channelId) {
    const key = toKey(guildId, channelId);
    let context = contexts.get(key);

    if (!context) {
        context = {
            turns: [],
            lastActiveAt: Date.now(),
            inFlight: false,
        };
        contexts.set(key, context);
    }

    touchContext(context);
    return context;
}

function appendUserTurn(options) {
    const guildId = options.guildId;
    const channelId = options.channelId;
    const userId = String(options.userId || '');
    const username = normalizeText(options.username || 'User', 60) || 'User';
    const content = normalizeText(options.content);

    if (!content) {
        return false;
    }

    const context = getOrCreateContext(guildId, channelId);
    context.turns.push({
        role: 'user',
        userId,
        username,
        content,
        timestamp: Date.now(),
    });
    trimTurns(context);
    return true;
}

function appendAssistantTurn(options) {
    const guildId = options.guildId;
    const channelId = options.channelId;
    const content = normalizeText(options.content, 400);

    if (!content) {
        return false;
    }

    const context = getOrCreateContext(guildId, channelId);
    context.turns.push({
        role: 'assistant',
        userId: '',
        username: 'Mechanic',
        content,
        timestamp: Date.now(),
    });
    trimTurns(context);
    return true;
}

function getChatMessages(options) {
    const key = toKey(options.guildId, options.channelId);
    const context = contexts.get(key);
    if (!context) {
        return [];
    }

    touchContext(context);
    return context.turns.map(turn => {
        if (turn.role === 'assistant') {
            return {
                role: 'assistant',
                content: turn.content,
            };
        }

        const speaker = safeField(turn.username || 'User', 60) || 'User';
        const userId = safeField(turn.userId || 'unknown', 40) || 'unknown';
        return {
            role: 'user',
            content: `[user_name] ${speaker}\n[user_id] ${userId}\n[user_message]\n${turn.content}`,
        };
    });
}

function acquireChannelLock(options) {
    const context = getOrCreateContext(options.guildId, options.channelId);
    if (context.inFlight) {
        return false;
    }

    context.inFlight = true;
    touchContext(context);
    return true;
}

function releaseChannelLock(options) {
    const key = toKey(options.guildId, options.channelId);
    const context = contexts.get(key);
    if (!context) {
        return;
    }

    context.inFlight = false;
    touchContext(context);
}

function clearChannelContext(options) {
    return contexts.delete(toKey(options.guildId, options.channelId));
}

function sweepExpiredContexts() {
    const now = Date.now();
    let deleted = 0;

    for (const [key, context] of contexts.entries()) {
        if (now - context.lastActiveAt > CHANNEL_TTL_MS) {
            contexts.delete(key);
            deleted++;
        }
    }

    return deleted;
}

const sweepTimer = setInterval(() => {
    const deleted = sweepExpiredContexts();
    if (deleted > 0) {
        console.log(`[ContextStore] Swept ${deleted} expired channel context(s)`);
    }
}, SWEEP_INTERVAL_MS);

if (typeof sweepTimer.unref === 'function') {
    sweepTimer.unref();
}

module.exports = {
    MAX_TURNS_PER_CHANNEL,
    MAX_CONTENT_CHARS_PER_TURN,
    CHANNEL_TTL_MS,
    SWEEP_INTERVAL_MS,
    appendUserTurn,
    appendAssistantTurn,
    getChatMessages,
    acquireChannelLock,
    releaseChannelLock,
    sweepExpiredContexts,
    clearChannelContext,
};
