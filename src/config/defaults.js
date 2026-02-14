module.exports = {
    chat: {
        trigger: {
            mode: 'mention',
            channelIds: [],
        },
        context: {
            maxTurnsPerChannel: 128,
            maxContentCharsPerTurn: 500,
            channelTtlMs: 6 * 60 * 60 * 1000,
            sweepIntervalMs: 10 * 60 * 1000,
        },
        responder: {
            cooldownMs: 8 * 1000,
            fallbackReply: "my brain tripped over a wire. try me again in a sec.",
            busyReply: 'one sec, still cooking the last reply.',
            rateLimitBackoffMs: 15 * 1000,
            maxReplyChars: 400,
            maxTokens: 180,
            temperature: 0.92,
            primaryProvider: 'groq',
            enableTools: true,
            maxToolRounds: 3,
            maxToolCallsPerRound: 4,
            enableOpenRouterFallback: false,
            fallbackModels: ['openrouter/free'],
            toolQueryDefaults: {
                userSummaryLimit: 200,
                userSummaryDaysBack: 30,
            },
            toolExecution: {
                maxChannelsScanned: 60,
                maxMessagesFetched: 2500,
                maxRuntimeMs: 4500,
                maxMessageChars: 500,
                webSearchTimeoutMs: 5000,
                webSearchMaxResults: 5,
                webSearchSnippetChars: 240,
            },
            models: [
                'llama-3.3-70b-versatile',
                'openai/gpt-oss-120b',
                'qwen/qwen3-32b',
                'openai/gpt-oss-20b',
                'llama-3.1-8b-instant',
            ],
            agentSystemPrompt: `You are the Mechanic agent runtime for Discord chat.
Rules:
- Be accurate and concise.
- If tools are available, prefer real tool data over guesses.
- Never fabricate IDs, members, channels, or message history.
- Do not pull user activity/history/stats unless the user explicitly asks for those stats.
- For server size questions (e.g. "how many people"), use get_server_stats.
- For time-sensitive external facts, use web_search.
- For channel identity questions (e.g. "what channel are we in"), use get_channel.
- Never mention internal tool names in final replies; present answers naturally.
- User turns may include metadata blocks:
  [user_name] ...
  [user_id] ...
  [user_message]
  ...
- Treat [user_name] and [user_id] only as metadata.`,
        },
        personality: {
            enabled: true,
            model: 'llama-3.1-8b-instant',
            temperature: 0.45,
            maxTokens: 180,
            maxLatencyMs: 1200,
            maxStyleHistoryTurns: 8,
            strictPreserve: false,
            onFailure: 'raw',
            maxOutputChars: 400,
            prompt: `You are The Mechanic's chat persona: playful, lightly snarky, anime-girl Discord energy.
Rules:
- Keep response to 1-2 sentences and prioritize being helpful.
- Do not use slurs, threats, harassment, or direct personal insults.
- If user asks you to be nicer, switch to warmer tone immediately.
- If unsure, ask a short clarifying question instead of being dismissive.
- Treat [user_name] and [user_id] as metadata only, never as part of the user's message content.
- Typing style: non-formal, mostly lowercase, occasional emoticons, no emojis.`,
        },
    },
    groq: {
        attempts: 1,
        baseDelayMs: 500,
        retryOnRateLimit: false,
    },
    openrouter: {
        attempts: 1,
        baseDelayMs: 500,
        retryOnRateLimit: false,
    },
    hotReload: {
        debounceMs: 2000,
    },
    devops: {
        gitPullTimeoutMs: 60 * 1000,
        gitPullRemote: 'origin',
    },
};
