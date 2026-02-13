const { createChatCompletion } = require('./openrouter');
const userProfileStore = require('./userProfileStore');

const semanticLocks = new Set();

const ANALYZER_SYSTEM_PROMPT = `You analyze Discord user behavior and output STRICT JSON only.
Return exactly one object with this shape:
{
  "tone_summary": string,
  "personality_summary": string,
  "interests_summary": string,
  "social_summary": string,
  "do_list": string[],
  "dont_list": string[]
}

Rules:
- No markdown, no code fences, no extra keys.
- Keep each summary concise and practical.
- do_list and dont_list should each contain 3 to 6 short guidance items.
- Avoid profanity or insults.
- Base output only on supplied data.`;

function asText(value, maxLength = 500) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, maxLength);
}

function normalizeList(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, 6);
}

function parseJsonObject(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        return null;
    }

    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');

    try {
        return JSON.parse(cleaned);
    } catch {
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            return null;
        }
        const candidate = cleaned.slice(firstBrace, lastBrace + 1);
        try {
            return JSON.parse(candidate);
        } catch {
            return null;
        }
    }
}

function parseStoredList(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return normalizeList(value);
    }
    if (typeof value !== 'string') {
        return [];
    }
    try {
        const parsed = JSON.parse(value);
        return normalizeList(parsed);
    } catch {
        return [];
    }
}

function formatSamples(selfSamples, socialSamples) {
    const selfText = selfSamples.length
        ? selfSamples.map((sample, index) => `${index + 1}. ${sample.content}`).join('\n')
        : '(none)';
    const socialText = socialSamples.length
        ? socialSamples.map((sample, index) => `${index + 1}. from ${sample.actor_user_id}: ${sample.content}`).join('\n')
        : '(none)';

    return { selfText, socialText };
}

function toSemanticPayload(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return null;
    }

    const payload = {
        tone_summary: asText(parsed.tone_summary),
        personality_summary: asText(parsed.personality_summary),
        interests_summary: asText(parsed.interests_summary),
        social_summary: asText(parsed.social_summary),
        do_list: normalizeList(parsed.do_list),
        dont_list: normalizeList(parsed.dont_list),
    };

    if (!payload.tone_summary || !payload.personality_summary || !payload.interests_summary || !payload.social_summary) {
        return null;
    }

    return payload;
}

async function refreshUserProfile(options) {
    const guildId = options.guildId;
    const userId = options.userId;
    const force = Boolean(options.force);
    const lockKey = `${guildId}:${userId}`;

    if (semanticLocks.has(lockKey)) {
        return { updated: false, reason: 'locked' };
    }

    semanticLocks.add(lockKey);
    try {
        if (!force) {
            const shouldRefresh = await userProfileStore.shouldRefreshSemantic(guildId, userId, 12, 15);
            if (!shouldRefresh) {
                return { updated: false, reason: 'threshold' };
            }
        }

        const profile = await userProfileStore.getProfile(guildId, userId);
        const { selfSamples, socialSamples } = await userProfileStore.getRecentSamples(guildId, userId, {
            selfLimit: 20,
            socialLimit: 12,
        });

        if (!selfSamples.length && !socialSamples.length) {
            return { updated: false, reason: 'no_samples' };
        }

        const existingDoList = parseStoredList(profile?.do_list);
        const existingDontList = parseStoredList(profile?.dont_list);
        const sampleText = formatSamples(selfSamples, socialSamples);

        const userPrompt = [
            `Guild ID: ${guildId}`,
            `User ID: ${userId}`,
            '',
            'Existing profile:',
            `tone_summary: ${profile?.tone_summary || '(none)'}`,
            `personality_summary: ${profile?.personality_summary || '(none)'}`,
            `interests_summary: ${profile?.interests_summary || '(none)'}`,
            `social_summary: ${profile?.social_summary || '(none)'}`,
            `do_list: ${existingDoList.length ? existingDoList.join(' | ') : '(none)'}`,
            `dont_list: ${existingDontList.length ? existingDontList.join(' | ') : '(none)'}`,
            '',
            'Recent self messages:',
            sampleText.selfText,
            '',
            'Recent social interactions directed to user:',
            sampleText.socialText,
            '',
            'Return strict JSON only.',
        ].join('\n');

        const completion = await createChatCompletion(
            [
                { role: 'system', content: ANALYZER_SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
            ],
            {
                model: 'openrouter/free',
                maxTokens: 650,
                temperature: 0.2,
            }
        );

        const parsed = parseJsonObject(completion);
        const semanticPayload = toSemanticPayload(parsed);
        if (!semanticPayload) {
            console.warn(`[ProfileAnalyzer] Invalid semantic payload for ${lockKey}`);
            return { updated: false, reason: 'invalid_payload' };
        }

        await userProfileStore.updateSemanticProfile(guildId, userId, semanticPayload);
        return { updated: true, reason: 'updated' };
    } catch (error) {
        const log = error?.message?.includes('empty content') ? console.warn : console.error;
        log(`[ProfileAnalyzer] Failed to refresh profile ${lockKey}:`, error.message);
        return { updated: false, reason: 'error', error };
    } finally {
        semanticLocks.delete(lockKey);
    }
}

module.exports = {
    refreshUserProfile,
};
