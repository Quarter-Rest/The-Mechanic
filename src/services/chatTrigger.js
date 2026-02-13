function normalizeMode(mode) {
    return mode === 'channels' ? 'channels' : 'mention';
}

function normalizeChannelIds(channelIds) {
    if (!Array.isArray(channelIds)) {
        return new Set();
    }

    return new Set(
        channelIds
            .filter(id => typeof id === 'string' && id.trim())
            .map(id => id.trim())
    );
}

function shouldRespond(message, clientUserId, config = {}) {
    const mode = normalizeMode(config.mode);
    const channelIds = normalizeChannelIds(config.channelIds);

    if (!message?.guildId) {
        return { shouldRespond: false, reason: 'no_guild', mode };
    }

    if (!clientUserId) {
        return { shouldRespond: false, reason: 'no_client_user', mode };
    }

    if (mode === 'channels') {
        if (!channelIds.size) {
            return { shouldRespond: false, reason: 'no_channels_configured', mode };
        }

        if (!channelIds.has(message.channelId)) {
            return { shouldRespond: false, reason: 'channel_not_allowed', mode };
        }

        return { shouldRespond: true, reason: 'channel_mode', mode };
    }

    const botMentioned = Boolean(message.mentions?.users?.has(clientUserId));
    if (!botMentioned) {
        return { shouldRespond: false, reason: 'not_mentioned', mode };
    }

    return { shouldRespond: true, reason: 'mention', mode };
}

module.exports = {
    shouldRespond,
};
