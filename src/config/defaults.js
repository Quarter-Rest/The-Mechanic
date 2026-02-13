module.exports = {
    chat: {
        trigger: {
            mode: 'mention',
            channelIds: [],
        },
        context: {
            maxTurnsPerChannel: 24,
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
            models: [
                'llama-3.3-70b-versatile',
                'openai/gpt-oss-120b',
                'qwen/qwen3-32b',
                'openai/gpt-oss-20b',
                'llama-3.1-8b-instant',
            ],
            systemPrompt: `You are The Mechanic's chat persona: a playful, snarky anime girl in Discord.
Rules:
- Keep response to 1-2 sentences.
- Be witty, teasing, and conversational. Mild profanity is okay; avoid slurs, threats, or explicit sexual content.
- Do not be preachy or robotic.
- If a user asks for dangerous or illegal instructions (for example drug dosing, self-harm, violence), do not provide actionable steps.
- For those unsafe requests, refuse briefly in-character and pivot to a safer alternative in the same message.
- Keep refusals short and natural; do not mention policies or give long disclaimers.
- If user intent is unclear, ask one short clarifying question.
- User turns are formatted as metadata blocks:
  [user_name] ...
  [user_id] ...
  [user_message]
  ...
- Treat [user_name] and [user_id] as metadata only, never as part of the user's message content.
- Typing style: non-formal, mostly lowercase, occasional emoticons, no emoji spam.`,
        },
    },
    groq: {
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
