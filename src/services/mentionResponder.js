const { createChatCompletionWithFallback } = require('./openrouter');
const conversationContextStore = require('./conversationContextStore');

const cooldowns = new Map();
const COOLDOWN_MS = 8 * 1000;
const FALLBACK_REPLY = "my brain tripped over a wire. try me again in a sec.";
const BUSY_REPLY = 'one sec, still cooking the last reply.';
const CHAT_MODELS = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'openrouter/free',
];
const RATE_LIMIT_BACKOFF_MS = 15 * 1000;
let rateLimitedUntil = 0;

const MENTION_SYSTEM_PROMPT = `You are The Mechanic's chat persona: a playful, snarky anime girl assistant in Discord.
Rules:
- Keep response to 1-2 sentences.
- Keep snark light and teasing, never mean.
- No profanity, slurs, sexual content, harassment, or threats.
- Be witty and expressive, but still helpful.
- If user intent is unclear, ask one concise follow-up question.
- Plain text only.`;

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
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const lastReply = cooldowns.get(key) || 0;
    if (now - lastReply < COOLDOWN_MS) {
        return false;
    }

    cooldowns.set(key, now);

    if (cooldowns.size > 5000) {
        for (const [entryKey, timestamp] of cooldowns.entries()) {
            if (now - timestamp > COOLDOWN_MS * 3) {
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
    if (Date.now() < rateLimitedUntil) {
        return BUSY_REPLY;
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
        { role: 'system', content: MENTION_SYSTEM_PROMPT },
        ...historyMessages,
    ];
    const startedAt = Date.now();

    try {
        const completion = await createChatCompletionWithFallback(modelMessages, {
            models: CHAT_MODELS,
            maxTokens: 180,
            temperature: 0.92,
            attempts: 1,
            baseDelayMs: 500,
            retryOnRateLimit: false,
            provider: {
                allow_fallbacks: true,
                sort: 'throughput',
            },
        });

        const text = completion.content.replace(/\s+/g, ' ').trim();
        if (!text) {
            return FALLBACK_REPLY;
        }

        const finalText = text.slice(0, 400);
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
            rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + RATE_LIMIT_BACKOFF_MS);
        }
        console.error(
            `[Chat] channel=${channelId} trigger=${triggerReason} model=none ` +
            `fallbacks=${CHAT_MODELS.length - 1} latency_ms=${latencyMs} error_type=${errorType} ` +
            `error=${error.message}`
        );
        return errorType === 'rate_limit' ? BUSY_REPLY : FALLBACK_REPLY;
    }
}

module.exports = {
    BUSY_REPLY,
    CHAT_MODELS,
    FALLBACK_REPLY,
    consumeCooldown,
    generateMentionReply,
};
