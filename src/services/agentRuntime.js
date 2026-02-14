const { createChatCompletionWithFallbackResponse: createGroqResponse } = require('./groq');
const {
    createChatCompletionWithFallbackResponse: createOpenRouterResponse,
    hasApiKey: hasOpenRouterApiKey,
} = require('./openrouter');
const { getToolDefinitions, getToolSystemPrompt, executeToolCall } = require('./discordMcpTools');

function compactErrorMessage(error) {
    const message = String(error?.message || 'unknown error').replace(/\s+/g, ' ').trim();
    return message.length > 220 ? `${message.slice(0, 217)}...` : message;
}

function normalizeAssistantContent(content) {
    if (typeof content !== 'string') {
        return '';
    }

    return content.replace(/\s+/g, ' ').trim();
}

function extractUserMessageFromMetadataBlock(content) {
    const text = normalizeAssistantContent(content);
    const marker = '[user_message]';
    const markerIndex = text.indexOf(marker);
    if (markerIndex === -1) {
        return text;
    }

    return text.slice(markerIndex + marker.length).trim();
}

function getLatestUserText(options, historyMessages) {
    const direct = normalizeAssistantContent(options.latestUserMessage || '');
    if (direct) {
        return direct;
    }

    for (let index = historyMessages.length - 1; index >= 0; index--) {
        const entry = historyMessages[index];
        if (entry?.role !== 'user') {
            continue;
        }
        const extracted = extractUserMessageFromMetadataBlock(entry.content);
        if (extracted) {
            return extracted;
        }
    }

    return '';
}

function getLatestAssistantText(historyMessages) {
    for (let index = historyMessages.length - 1; index >= 0; index--) {
        const entry = historyMessages[index];
        if (entry?.role !== 'assistant') {
            continue;
        }

        const text = normalizeAssistantContent(entry.content || '');
        if (text) {
            return text;
        }
    }

    return '';
}

function isShortAffirmation(text) {
    if (!text) {
        return false;
    }

    const normalized = text.toLowerCase().replace(/[.!?]+/g, '').trim();
    const affirmations = new Set([
        'yes',
        'yeah',
        'yep',
        'yup',
        'sure',
        'ok',
        'okay',
        'kk',
        'do that',
        'go ahead',
        'please do',
        'well yeah',
        'do it',
    ]);

    return affirmations.has(normalized);
}

function isDataActionProposal(text) {
    if (!text) {
        return false;
    }

    const lowered = text.toLowerCase();
    const proposalPatterns = [
        /\b(want me to|should i|do you want me to|if you want|let me know)\b/,
        /\b(i can (check|look up|fetch|find|get|pull))\b/,
        /\b(check|look up|fetch|get|search)\b.*\b(user|member|profile|stats?|messages?|history|channel|server|count)\b/,
        /\b(get_[a-z_]+|web_search)\b/,
    ];

    return proposalPatterns.some(pattern => pattern.test(lowered));
}

function shouldEnableToolsForTurn(options, historyMessages) {
    const responderConfig = options.responderConfig || {};
    if (responderConfig.forceToolsForAllTurns === true) {
        return { enabled: true, reason: 'force_enabled' };
    }

    const latestUserText = getLatestUserText(options, historyMessages).toLowerCase();
    if (!latestUserText) {
        return { enabled: false, reason: 'no_user_text' };
    }

    const explicitDataIntentPatterns = [
        /\b(summary|summarize|describe|profile|personality|activity|stats?)\b/,
        /\b(tell me about|about\s+<@!?[\d]{17,20}>|about\s+\w+)\b/,
        /\b(messages?|history|recent|search|lookup|look up|find|fetch)\b/,
        /\b(web|google|online|internet|news|latest|current|today|update)\b/,
        /\b(list channels?|channel id|channel info|what channel|which channel|this channel|where are we)\b/,
        /\b(member count|server count|how many people|how many members|how many users)\b/,
        /\b(member|members|users|who is|who's|when did|what did)\b/,
    ];

    const hasEntityReference =
        /<@!?\d{17,20}>/.test(latestUserText) ||
        /<#\d{17,20}>/.test(latestUserText) ||
        /\b\d{17,20}\b/.test(latestUserText);
    const hasEntityDataKeyword = /\b(info|details|profile|messages?|activity|stats?|history|summary|describe|who)\b/.test(latestUserText);

    const hasDataIntent =
        explicitDataIntentPatterns.some(pattern => pattern.test(latestUserText)) ||
        (hasEntityReference && hasEntityDataKeyword);

    if (hasDataIntent) {
        return { enabled: true, reason: 'intent_match' };
    }

    const lastAssistantText = getLatestAssistantText(historyMessages);
    if (isShortAffirmation(latestUserText) && isDataActionProposal(lastAssistantText)) {
        return { enabled: true, reason: 'followup_affirmation' };
    }

    return hasDataIntent
        ? { enabled: true, reason: 'intent_match' }
        : { enabled: false, reason: 'small_talk_or_general_chat' };
}

function normalizeToolCalls(toolCalls, round) {
    if (!Array.isArray(toolCalls)) {
        return [];
    }

    return toolCalls.map((toolCall, index) => ({
        ...toolCall,
        id: typeof toolCall?.id === 'string' && toolCall.id.trim()
            ? toolCall.id
            : `tool_call_${round}_${index}`,
    }));
}

function shouldFallbackToOpenRouter(error, responderConfig) {
    if (responderConfig.enableOpenRouterFallback !== true) {
        return false;
    }

    const message = String(error?.message || '');
    if (!message) {
        return false;
    }

    return (
        message.includes('429') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504') ||
        /timeout|timed out|network|fetch failed|econn|socket hang up/i.test(message)
    );
}

async function runProviderCompletion(provider, modelMessages, responderConfig, toolDefinitions) {
    const hasTools = Array.isArray(toolDefinitions) && toolDefinitions.length > 0;

    if (provider === 'openrouter') {
        return createOpenRouterResponse(modelMessages, {
            models: Array.isArray(responderConfig.fallbackModels) && responderConfig.fallbackModels.length
                ? responderConfig.fallbackModels
                : ['openrouter/free'],
            maxTokens: responderConfig.maxTokens,
            temperature: responderConfig.temperature,
            ...(hasTools ? { tools: toolDefinitions, toolChoice: 'auto' } : {}),
        });
    }

    return createGroqResponse(modelMessages, {
        models: responderConfig.models,
        maxTokens: responderConfig.maxTokens,
        temperature: responderConfig.temperature,
        ...(hasTools ? { tools: toolDefinitions, toolChoice: 'auto' } : {}),
    });
}

/**
 * Generate a raw factual reply from the agent runtime.
 * @param {object} options
 * @param {Array<object>} options.historyMessages
 * @param {object} options.responderConfig
 * @param {object} options.toolContext
 * @returns {Promise<{rawDraft: string, providerMeta: object, toolMeta: object}>}
 */
async function generateAgentReply(options) {
    const historyMessages = Array.isArray(options.historyMessages)
        ? options.historyMessages
        : [];
    const responderConfig = options.responderConfig || {};
    const toolContext = options.toolContext || {};
    const toolPolicy = shouldEnableToolsForTurn(options, historyMessages);
    const canUseTools = responderConfig.enableTools !== false && Boolean(toolContext.guild) && toolPolicy.enabled;
    const maxToolRounds = Math.max(0, Number(responderConfig.maxToolRounds) || 3);
    const maxToolCallsPerRound = Math.max(1, Number(responderConfig.maxToolCallsPerRound) || 4);
    const toolDefinitions = canUseTools ? getToolDefinitions() : [];
    const baseSystemPrompt = normalizeAssistantContent(
        responderConfig.agentSystemPrompt || responderConfig.systemPrompt || ''
    );

    const modelMessages = [
        ...(baseSystemPrompt ? [{ role: 'system', content: baseSystemPrompt }] : []),
        ...(canUseTools ? [{ role: 'system', content: getToolSystemPrompt() }] : []),
        ...historyMessages,
    ];

    let activeProvider = responderConfig.primaryProvider === 'openrouter' ? 'openrouter' : 'groq';
    let fallbackUsed = false;
    let totalToolCalls = 0;
    let totalFallbacks = 0;
    let roundsUsed = 0;
    let lastModel = null;
    let fallbackAttempts = 0;

    for (let round = 0; round <= maxToolRounds; round++) {
        roundsUsed = round + 1;
        let completion;

        try {
            completion = await runProviderCompletion(activeProvider, modelMessages, responderConfig, toolDefinitions);
        } catch (error) {
            if (
                activeProvider === 'groq' &&
                shouldFallbackToOpenRouter(error, responderConfig) &&
                hasOpenRouterApiKey()
            ) {
                fallbackUsed = true;
                fallbackAttempts++;
                activeProvider = 'openrouter';
                console.warn(`[AgentRuntime] Falling back to OpenRouter: ${compactErrorMessage(error)}`);
                round--;
                continue;
            }

            throw error;
        }

        totalFallbacks += Number(completion?.fallbackCount) || 0;
        lastModel = completion?.model || lastModel;

        const assistantMessage = completion?.message || { role: 'assistant', content: '' };
        const toolCalls = normalizeToolCalls(assistantMessage.tool_calls, round);

        if (!canUseTools || toolCalls.length === 0) {
            return {
                rawDraft: normalizeAssistantContent(assistantMessage.content),
                providerMeta: {
                    provider: activeProvider,
                    model: lastModel || 'unknown',
                    fallbackUsed,
                    fallbackAttempts,
                    fallbackCount: totalFallbacks,
                },
                toolMeta: {
                    toolCallCount: totalToolCalls,
                    roundsUsed,
                    toolsEnabled: canUseTools,
                    toolPolicyReason: toolPolicy.reason,
                },
            };
        }

        if (round >= maxToolRounds) {
            throw new Error(`Model exceeded tool round limit (${maxToolRounds})`);
        }

        modelMessages.push({
            role: 'assistant',
            content: normalizeAssistantContent(assistantMessage.content),
            tool_calls: toolCalls,
        });

        for (let index = 0; index < toolCalls.length; index++) {
            const toolCall = toolCalls[index];
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

    throw new Error('Agent runtime exhausted tool rounds without final response');
}

module.exports = {
    generateAgentReply,
};
