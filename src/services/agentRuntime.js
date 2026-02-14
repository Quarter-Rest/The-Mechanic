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
    const canUseTools = responderConfig.enableTools !== false && Boolean(toolContext.guild);
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
