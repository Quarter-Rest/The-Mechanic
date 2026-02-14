const { createChatCompletionWithFallback, createChatCompletionWithFallbackResponse } = require('./groq');
const { getConfig } = require('../config');
const conversationContextStore = require('./conversationContextStore');
const { getToolDefinitions, getToolSystemPrompt, executeToolCall } = require('./discordMcpTools');

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
        requesterId: options.authorId || '',
    };
}

async function generateReplyWithTools(baseMessages, responderConfig, toolContext) {
    const modelMessages = [...baseMessages];
    const maxToolRounds = Math.max(0, Number(responderConfig.maxToolRounds) || 3);
    const maxToolCallsPerRound = Math.max(1, Number(responderConfig.maxToolCallsPerRound) || 4);
    const toolDefinitions = getToolDefinitions();

    let totalFallbacks = 0;
    let totalToolCalls = 0;
    let lastModel = responderConfig.models?.[0] || 'llama-3.3-70b-versatile';

    for (let round = 0; round <= maxToolRounds; round++) {
        const completion = await createChatCompletionWithFallbackResponse(modelMessages, {
            models: responderConfig.models,
            maxTokens: responderConfig.maxTokens,
            temperature: responderConfig.temperature,
            tools: toolDefinitions,
            toolChoice: 'auto',
        });

        totalFallbacks += completion.fallbackCount;
        lastModel = completion.model;

        const assistantMessage = completion.message || { role: 'assistant', content: '' };
        const toolCalls = Array.isArray(assistantMessage.tool_calls)
            ? assistantMessage.tool_calls
            : [];
        const normalizedToolCalls = toolCalls.map((toolCall, index) => ({
            ...toolCall,
            id: typeof toolCall?.id === 'string' && toolCall.id.trim()
                ? toolCall.id
                : `tool_call_${round}_${index}`,
        }));

        if (!normalizedToolCalls.length) {
            return {
                content: normalizeReplyText(assistantMessage.content),
                model: completion.model,
                fallbackCount: totalFallbacks,
                toolCallCount: totalToolCalls,
            };
        }

        if (round >= maxToolRounds) {
            throw new Error(`Model exceeded tool round limit (${maxToolRounds})`);
        }

        modelMessages.push({
            role: 'assistant',
            content: typeof assistantMessage.content === 'string' ? assistantMessage.content : '',
            tool_calls: normalizedToolCalls,
        });

        for (let index = 0; index < normalizedToolCalls.length; index++) {
            const toolCall = normalizedToolCalls[index];
            const toolCallId = toolCall.id;
            const toolName = toolCall?.function?.name || 'unknown_tool';

            let result;
            if (index >= maxToolCallsPerRound) {
                result = {
                    ok: false,
                    error: `tool_call_limit_exceeded:${maxToolCallsPerRound}`,
                };
            } else {
                result = await executeToolCall(toolCall, toolContext);
            }

            totalToolCalls++;
            modelMessages.push({
                role: 'tool',
                tool_call_id: toolCallId,
                name: toolName,
                content: JSON.stringify(result),
            });
        }
    }

    return {
        content: '',
        model: lastModel,
        fallbackCount: totalFallbacks,
        toolCallCount: totalToolCalls,
    };
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
    const enableTools = responderConfig.enableTools !== false;
    const toolContext = toToolContext(options);
    const canUseTools = enableTools && Boolean(toolContext.guild);
    const modelMessages = [
        { role: 'system', content: responderConfig.systemPrompt },
        ...(canUseTools ? [{ role: 'system', content: getToolSystemPrompt() }] : []),
        ...historyMessages,
    ];
    const startedAt = Date.now();

    try {
        const completion = canUseTools
            ? await generateReplyWithTools(modelMessages, responderConfig, toolContext)
            : await createChatCompletionWithFallback(modelMessages, {
                models: responderConfig.models,
                maxTokens: responderConfig.maxTokens,
                temperature: responderConfig.temperature,
            });

        const text = normalizeReplyText(completion.content);
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
        const toolCallCount = Number(completion.toolCallCount) || 0;
        console.log(
            `[Chat] channel=${channelId} trigger=${triggerReason} model=${completion.model} ` +
            `fallbacks=${completion.fallbackCount} tool_calls=${toolCallCount} latency_ms=${latencyMs}`
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
            `fallbacks=${Math.max(0, responderConfig.models.length - 1)} tool_calls=0 latency_ms=${latencyMs} error_type=${errorType} ` +
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
