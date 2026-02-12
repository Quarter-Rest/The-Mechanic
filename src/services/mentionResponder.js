const { createChatCompletion } = require('./openrouter');

const cooldowns = new Map();
const COOLDOWN_MS = 20 * 1000;
const FALLBACK_REPLY = "yo, i'm here. hit me again in a sec.";

const MENTION_SYSTEM_PROMPT = `You are a Discord bot with a clean chill vibe.
Rules:
- Keep response to 1-2 sentences.
- No profanity, slurs, insults, or edgy language.
- Sound relaxed and friendly, not robotic.
- If the user asks for something unclear, ask one concise follow-up question.
- Plain text only.`;

function parseStoredList(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
    }
    if (typeof value !== 'string') {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed
            .filter(item => typeof item === 'string' && item.trim())
            .map(item => item.trim());
    } catch {
        return [];
    }
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
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const lastReply = cooldowns.get(key) || 0;
    if (now - lastReply < COOLDOWN_MS) {
        return false;
    }

    cooldowns.set(key, now);

    // Lightweight cleanup to avoid unbounded map growth.
    if (cooldowns.size > 5000) {
        for (const [entryKey, timestamp] of cooldowns.entries()) {
            if (now - timestamp > COOLDOWN_MS * 3) {
                cooldowns.delete(entryKey);
            }
        }
    }

    return true;
}

async function generateMentionReply(options) {
    const profile = options.profile || {};
    const botUserId = options.botUserId;
    const cleanedMessage = stripBotMention(options.messageContent || '', botUserId);
    const doList = parseStoredList(profile.do_list);
    const dontList = parseStoredList(profile.dont_list);

    const userPrompt = [
        'User profile context:',
        `tone_summary: ${profile.tone_summary || '(none)'}`,
        `personality_summary: ${profile.personality_summary || '(none)'}`,
        `interests_summary: ${profile.interests_summary || '(none)'}`,
        `social_summary: ${profile.social_summary || '(none)'}`,
        `do_list: ${doList.length ? doList.join(' | ') : '(none)'}`,
        `dont_list: ${dontList.length ? dontList.join(' | ') : '(none)'}`,
        '',
        `User message: ${cleanedMessage || '(user only mentioned bot without text)'}`,
        '',
        'Generate a direct reply to the user now.',
    ].join('\n');

    try {
        const completion = await createChatCompletion(
            [
                { role: 'system', content: MENTION_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            {
                model: 'openrouter/free',
                maxTokens: 180,
                temperature: 0.8,
            }
        );

        const text = completion.replace(/\s+/g, ' ').trim();
        if (!text) {
            return FALLBACK_REPLY;
        }

        return text.slice(0, 400);
    } catch (error) {
        console.error('[MentionResponder] Failed to generate mention reply:', error.message);
        return FALLBACK_REPLY;
    }
}

module.exports = {
    FALLBACK_REPLY,
    consumeCooldown,
    generateMentionReply,
};
