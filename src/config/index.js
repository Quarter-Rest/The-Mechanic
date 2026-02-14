const fs = require('node:fs');
const path = require('node:path');
const defaults = require('./defaults');

const secretsPath = path.join(__dirname, '..', '..', 'secrets.json');

let cachedConfig = buildRuntimeConfig();

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, override) {
    if (!isObject(base)) {
        return override;
    }
    if (!isObject(override)) {
        return base;
    }

    const result = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (Array.isArray(value)) {
            result[key] = [...value];
            continue;
        }

        if (isObject(value) && isObject(base[key])) {
            result[key] = mergeDeep(base[key], value);
            continue;
        }

        result[key] = value;
    }

    return result;
}

function readSecrets() {
    try {
        const raw = fs.readFileSync(secretsPath, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        console.warn(`[Config] Failed to load secrets.json: ${error.message}`);
        return {};
    }
}

function normalizeChannelIds(input) {
    if (!Array.isArray(input)) {
        return [];
    }

    return input
        .filter(id => typeof id === 'string' && id.trim())
        .map(id => id.trim());
}

function buildRuntimeConfig() {
    const secrets = readSecrets();
    const chatOverride = isObject(secrets.chat) ? secrets.chat : {};
    const merged = mergeDeep(defaults, {
        chat: chatOverride,
        groq: isObject(secrets.groq) ? secrets.groq : {},
        openrouter: isObject(secrets.openrouter) ? secrets.openrouter : {},
        hotReload: isObject(secrets.hotReload) ? secrets.hotReload : {},
        devops: isObject(secrets.devops) ? secrets.devops : {},
    });

    merged.chat.trigger = merged.chat.trigger || {};
    merged.chat.trigger.mode = merged.chat.trigger.mode === 'channels' ? 'channels' : 'mention';
    merged.chat.trigger.channelIds = normalizeChannelIds(
        chatOverride.channel_ids ?? merged.chat.trigger.channelIds
    );

    merged.discord = {
        token: secrets.token || null,
        clientId: secrets.client_id || null,
        testGuildId: secrets.test_guild_id || null,
    };

    merged.groq.apiKey = merged.groq.api_key || process.env.GROQ_API_KEY || null;
    merged.openrouter.apiKey = merged.openrouter.api_key || process.env.OPENROUTER_API_KEY || null;

    return merged;
}

function getConfig() {
    return cachedConfig;
}

function refreshConfig() {
    cachedConfig = buildRuntimeConfig();
    return cachedConfig;
}

module.exports = {
    getConfig,
    refreshConfig,
};
