const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getConfig } = require('../config');

const MAX_CHANNELS_LIMIT = 200;
const MAX_MESSAGES_LIMIT = 200;
const MAX_SEARCH_LIMIT = 100;

const TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'resolve_user',
            description: 'Resolve a Discord user in this guild from id, mention, username, display name, or global name.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'User id, mention, or name query.',
                    },
                    limit: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: 10,
                        description: 'Maximum candidate matches to return.',
                    },
                },
                required: ['query'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_member',
            description: 'Fetch basic member details for a Discord user in this guild.',
            parameters: {
                type: 'object',
                properties: {
                    user_id: {
                        type: 'string',
                        description: 'Discord user ID to look up.',
                    },
                },
                required: ['user_id'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_profile',
            description: 'Fetch profile details for a user in this guild.',
            parameters: {
                type: 'object',
                properties: {
                    user_id: {
                        type: 'string',
                        description: 'Discord user ID to look up.',
                    },
                },
                required: ['user_id'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_channel',
            description: 'Fetch basic details for a channel in this guild.',
            parameters: {
                type: 'object',
                properties: {
                    channel_id: {
                        type: 'string',
                        description: 'Discord channel ID to look up.',
                    },
                },
                required: ['channel_id'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_channels',
            description: 'List channels in this guild that the bot can access.',
            parameters: {
                type: 'object',
                properties: {
                    limit: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: MAX_CHANNELS_LIMIT,
                        description: `Maximum channels to return (1-${MAX_CHANNELS_LIMIT}).`,
                    },
                    include_threads: {
                        type: 'boolean',
                        description: 'Include thread channels when true.',
                    },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_channel_messages',
            description: 'Read recent messages from one channel in this guild.',
            parameters: {
                type: 'object',
                properties: {
                    channel_id: {
                        type: 'string',
                        description: 'Target channel ID. Defaults to current channel if omitted.',
                    },
                    limit: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: 100,
                        description: 'Maximum messages to return.',
                    },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_recent_messages',
            description: 'Alias of get_channel_messages. Read recent messages from one channel.',
            parameters: {
                type: 'object',
                properties: {
                    channel_id: {
                        type: 'string',
                        description: 'Target channel ID. Defaults to current channel if omitted.',
                    },
                    limit: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: 100,
                        description: 'Maximum messages to return.',
                    },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_messages',
            description: 'Fetch recent messages from one user across allowed guild channels.',
            parameters: {
                type: 'object',
                properties: {
                    user_id: {
                        type: 'string',
                        description: 'Discord user ID to collect messages for.',
                    },
                    limit: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: MAX_MESSAGES_LIMIT,
                        description: `Maximum messages to return (1-${MAX_MESSAGES_LIMIT}).`,
                    },
                    days_back: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: 180,
                        description: 'Search only messages newer than this many days.',
                    },
                    include_threads: {
                        type: 'boolean',
                        description: 'Include thread channels when true.',
                    },
                    channel_ids: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional channel id filter. If omitted, scans readable guild channels.',
                    },
                },
                required: ['user_id'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_user_activity_stats',
            description: 'Summarize activity stats for one user from recent guild messages.',
            parameters: {
                type: 'object',
                properties: {
                    user_id: {
                        type: 'string',
                        description: 'Discord user ID to summarize.',
                    },
                    days_back: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: 180,
                        description: 'Search only messages newer than this many days.',
                    },
                    channel_ids: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional channel id filter.',
                    },
                    include_threads: {
                        type: 'boolean',
                        description: 'Include thread channels when true.',
                    },
                },
                required: ['user_id'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_guild_messages',
            description: 'Search message content by keyword across readable guild channels.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Case-insensitive text query.',
                    },
                    limit: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: MAX_SEARCH_LIMIT,
                        description: `Maximum matches to return (1-${MAX_SEARCH_LIMIT}).`,
                    },
                    days_back: {
                        type: ['integer', 'string'],
                        minimum: 1,
                        maximum: 90,
                        description: 'Search only messages newer than this many days.',
                    },
                    include_threads: {
                        type: 'boolean',
                        description: 'Include thread channels when true.',
                    },
                    channel_ids: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional channel id filter.',
                    },
                },
                required: ['query'],
                additionalProperties: false,
            },
        },
    },
];

function getResponderConfig() {
    return getConfig().chat?.responder || {};
}

function getToolExecutionConfig() {
    const defaults = {
        maxChannelsScanned: 60,
        maxMessagesFetched: 2500,
        maxRuntimeMs: 4500,
        maxMessageChars: 500,
    };
    const configured = getResponderConfig().toolExecution || {};
    return {
        maxChannelsScanned: Math.max(1, Number(configured.maxChannelsScanned) || defaults.maxChannelsScanned),
        maxMessagesFetched: Math.max(20, Number(configured.maxMessagesFetched) || defaults.maxMessagesFetched),
        maxRuntimeMs: Math.max(500, Number(configured.maxRuntimeMs) || defaults.maxRuntimeMs),
        maxMessageChars: Math.max(80, Number(configured.maxMessageChars) || defaults.maxMessageChars),
    };
}

function getToolQueryDefaults() {
    const configured = getResponderConfig().toolQueryDefaults || {};
    return {
        userSummaryLimit: Math.max(1, Math.min(MAX_MESSAGES_LIMIT, Number(configured.userSummaryLimit) || 200)),
        userSummaryDaysBack: Math.max(1, Math.min(180, Number(configured.userSummaryDaysBack) || 30)),
    };
}

function asString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value, maxItems = 100) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(item => typeof item === 'string' && item.trim())
        .map(item => item.trim())
        .slice(0, maxItems);
}

function asBoundedInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function normalizeContent(content, maxLength) {
    if (typeof content !== 'string') {
        return '';
    }

    return content.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseToolArguments(toolCall) {
    const raw = toolCall?.function?.arguments;
    if (typeof raw !== 'string' || !raw.trim()) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        return null;
    }
}

function parseUserId(input) {
    const text = asString(input);
    if (!text) {
        return '';
    }

    const mentionMatch = text.match(/^<@!?(\d{17,20})>$/);
    if (mentionMatch) {
        return mentionMatch[1];
    }

    const idMatch = text.match(/^(\d{17,20})$/);
    if (idMatch) {
        return idMatch[1];
    }

    return '';
}

function resolveRequesterUserId(context) {
    const requesterId = asString(context?.requesterId);
    return requesterId || '';
}

function normalizeRequestedUserId(value, context) {
    const directId = parseUserId(value);
    if (directId) {
        return directId;
    }

    const text = asString(value).toLowerCase();
    if (!text) {
        return '';
    }

    if (text === 'me' || text === 'myself' || text === 'self' || text === '@me') {
        return resolveRequesterUserId(context);
    }

    return asString(value);
}

function normalizeChannelIdArg(value) {
    const text = asString(value);
    if (!text) {
        return '';
    }

    const lowered = text.toLowerCase();
    if (
        lowered === 'this channel' ||
        lowered === 'current channel' ||
        lowered === 'here' ||
        lowered === 'this'
    ) {
        return '';
    }

    return text;
}

function getTextChannelTypes() {
    return new Set([
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.PublicThread,
        ChannelType.PrivateThread,
        ChannelType.AnnouncementThread,
    ]);
}

function isThreadChannel(channel) {
    if (!channel) {
        return false;
    }

    if (typeof channel.isThread === 'function') {
        return channel.isThread();
    }

    return (
        channel.type === ChannelType.PublicThread ||
        channel.type === ChannelType.PrivateThread ||
        channel.type === ChannelType.AnnouncementThread
    );
}

function canReadChannel(channel, guild) {
    if (!channel || !guild) {
        return false;
    }

    if (!channel.isTextBased || !channel.isTextBased()) {
        return false;
    }

    const textTypes = getTextChannelTypes();
    if (!textTypes.has(channel.type)) {
        return false;
    }

    const me = guild.members?.me;
    if (!me || typeof channel.permissionsFor !== 'function') {
        return true;
    }

    const permissions = channel.permissionsFor(me);
    if (!permissions) {
        return false;
    }

    return (
        permissions.has(PermissionFlagsBits.ViewChannel) &&
        permissions.has(PermissionFlagsBits.ReadMessageHistory)
    );
}

function formatChannel(channel) {
    return {
        id: channel.id,
        name: channel.name ?? null,
        type: channel.type,
        parent_id: channel.parentId ?? null,
        nsfw: Boolean(channel.nsfw),
        topic: normalizeContent(channel.topic ?? '', 240),
    };
}

function formatMessage(message, maxContentChars) {
    return {
        id: message.id,
        channel_id: message.channelId ?? null,
        author_id: message.author?.id ?? null,
        author_name: message.member?.displayName || message.author?.globalName || message.author?.username || 'unknown',
        created_at: message.createdAt ? message.createdAt.toISOString() : null,
        content: normalizeContent(message.content || '', maxContentChars),
        has_attachments: Boolean(message.attachments?.size),
        has_embeds: Boolean(message.embeds?.length),
        has_links: /https?:\/\//i.test(message.content || ''),
    };
}

async function resolveGuildChannel(context, channelId) {
    if (!context?.guild) {
        return null;
    }

    if (!channelId) {
        return context.channel ?? null;
    }

    const existing = context.guild.channels.cache.get(channelId);
    if (existing) {
        return existing;
    }

    try {
        const fetched = await context.guild.channels.fetch(channelId);
        return fetched ?? null;
    } catch {
        return null;
    }
}

function getCandidateChannels(context, args = {}) {
    const guild = context?.guild;
    if (!guild) {
        return [];
    }

    const includeThreads = Boolean(args.include_threads);
    const channelIds = new Set(asStringArray(args.channel_ids, MAX_CHANNELS_LIMIT));
    const channels = [];

    for (const channel of guild.channels.cache.values()) {
        if (channelIds.size && !channelIds.has(channel.id)) {
            continue;
        }
        if (!includeThreads && isThreadChannel(channel)) {
            continue;
        }
        if (!canReadChannel(channel, guild)) {
            continue;
        }
        channels.push(channel);
    }

    channels.sort((a, b) => {
        const aPosition = Number(a.rawPosition) || 0;
        const bPosition = Number(b.rawPosition) || 0;
        if (aPosition !== bPosition) {
            return aPosition - bPosition;
        }
        return String(a.name || '').localeCompare(String(b.name || ''));
    });

    return channels;
}

async function ensureGuildChannelsCache(context) {
    if (!context?.guild) {
        return;
    }

    try {
        await context.guild.channels.fetch();
    } catch {}
}

async function resolveGuildMember(guild, userId) {
    if (!guild || !userId) {
        return null;
    }

    const cached = guild.members?.cache?.get(userId);
    if (cached) {
        return cached;
    }

    try {
        return await guild.members.fetch(userId);
    } catch {
        return null;
    }
}

async function runResolveUser(args, context) {
    const guild = context?.guild;
    if (!guild) {
        return { ok: false, error: 'guild context unavailable' };
    }

    const query = asString(args.query);
    if (!query) {
        return { ok: false, error: 'query is required' };
    }

    const loweredQuery = query.toLowerCase();
    if (loweredQuery === 'me' || loweredQuery === 'myself' || loweredQuery === 'self' || loweredQuery === '@me') {
        const requesterId = resolveRequesterUserId(context);
        if (!requesterId) {
            return { ok: false, error: 'requester context unavailable' };
        }
        const requesterMember = await resolveGuildMember(guild, requesterId);
        if (!requesterMember) {
            return { ok: false, error: 'requester not found in this guild' };
        }
        return {
            ok: true,
            count: 1,
            candidates: [{
                id: requesterMember.id,
                username: requesterMember.user?.username ?? null,
                global_name: requesterMember.user?.globalName ?? null,
                display_name: requesterMember.displayName ?? null,
                bot: Boolean(requesterMember.user?.bot),
            }],
        };
    }

    const limit = asBoundedInt(args.limit, 5, 1, 10);
    const candidateMap = new Map();
    const exactId = parseUserId(query);

    if (exactId) {
        const exactMember = await resolveGuildMember(guild, exactId);
        if (exactMember) {
            candidateMap.set(exactMember.id, exactMember);
        }
    }

    const normalizedQuery = loweredQuery;
    for (const member of guild.members.cache.values()) {
        if (candidateMap.size >= limit * 2) {
            break;
        }

        const values = [
            member.id,
            member.displayName,
            member.user?.username,
            member.user?.globalName,
        ].filter(Boolean).map(value => String(value).toLowerCase());

        if (values.some(value => value.includes(normalizedQuery))) {
            candidateMap.set(member.id, member);
        }
    }

    if (!candidateMap.size && typeof guild.members.search === 'function') {
        try {
            const searched = await guild.members.search({ query, limit });
            for (const member of searched.values()) {
                candidateMap.set(member.id, member);
            }
        } catch {}
    }

    const candidates = Array.from(candidateMap.values())
        .slice(0, limit)
        .map(member => ({
            id: member.id,
            username: member.user?.username ?? null,
            global_name: member.user?.globalName ?? null,
            display_name: member.displayName ?? null,
            bot: Boolean(member.user?.bot),
        }));

    return {
        ok: true,
        count: candidates.length,
        candidates,
    };
}

function toMemberPayload(member, guild) {
    return {
        id: member.id,
        username: member.user?.username ?? null,
        global_name: member.user?.globalName ?? null,
        display_name: member.displayName ?? null,
        avatar_url: member.user?.displayAvatarURL?.() ?? null,
        bot: Boolean(member.user?.bot),
        joined_at: member.joinedAt ? member.joinedAt.toISOString() : null,
        roles: member.roles.cache
            .filter(role => role.id !== guild.id)
            .map(role => ({ id: role.id, name: role.name }))
            .slice(0, 30),
    };
}

async function runGetMember(args, context) {
    const userId = normalizeRequestedUserId(args.user_id, context);
    if (!userId) {
        return { ok: false, error: 'user_id is required' };
    }

    const guild = context?.guild;
    if (!guild) {
        return { ok: false, error: 'guild context unavailable' };
    }

    const member = await resolveGuildMember(guild, userId);
    if (!member) {
        return { ok: false, error: 'member not found in this guild' };
    }

    return {
        ok: true,
        member: toMemberPayload(member, guild),
    };
}

async function runGetUserProfile(args, context) {
    return runGetMember(args, context);
}

async function runGetChannel(args, context) {
    const channelId = normalizeChannelIdArg(args.channel_id);
    if (!channelId) {
        const currentChannel = context?.channel;
        if (!currentChannel) {
            return { ok: false, error: 'channel_id is required' };
        }
        return {
            ok: true,
            channel: formatChannel(currentChannel),
        };
    }

    const channel = await resolveGuildChannel(context, channelId);
    if (!channel || channel.guildId !== context?.guild?.id) {
        return { ok: false, error: 'channel not found in this guild' };
    }

    if (!canReadChannel(channel, context.guild)) {
        return { ok: false, error: 'channel is not readable by bot' };
    }

    return {
        ok: true,
        channel: formatChannel(channel),
    };
}

async function runListChannels(args, context) {
    const guild = context?.guild;
    if (!guild) {
        return { ok: false, error: 'guild context unavailable' };
    }

    await ensureGuildChannelsCache(context);
    const limit = asBoundedInt(args.limit, 25, 1, MAX_CHANNELS_LIMIT);
    const channels = getCandidateChannels(context, {
        include_threads: args.include_threads,
        channel_ids: [],
    }).slice(0, limit);

    return {
        ok: true,
        guild_id: guild.id,
        count: channels.length,
        channels: channels.map(formatChannel),
    };
}

async function runGetChannelMessages(args, context) {
    const targetChannelId = normalizeChannelIdArg(args.channel_id) || context?.channel?.id || '';
    const limit = asBoundedInt(args.limit, 8, 1, 100);
    const channel = await resolveGuildChannel(context, targetChannelId);

    if (!channel || channel.guildId !== context?.guild?.id) {
        return { ok: false, error: 'channel not found in this guild' };
    }

    if (!canReadChannel(channel, context.guild)) {
        return { ok: false, error: 'channel is not readable by bot' };
    }

    const toolConfig = getToolExecutionConfig();
    try {
        const messages = await channel.messages.fetch({ limit });
        const ordered = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        return {
            ok: true,
            channel: formatChannel(channel),
            count: ordered.length,
            messages: ordered.map(message => formatMessage(message, toolConfig.maxMessageChars)),
        };
    } catch {
        return { ok: false, error: 'unable to fetch messages for this channel' };
    }
}

async function collectUserMessages(context, args) {
    const guild = context?.guild;
    if (!guild) {
        return { ok: false, error: 'guild context unavailable' };
    }

    const userId = normalizeRequestedUserId(args.user_id, context);
    if (!userId) {
        return { ok: false, error: 'user_id is required' };
    }

    await ensureGuildChannelsCache(context);

    const queryDefaults = getToolQueryDefaults();
    const toolConfig = getToolExecutionConfig();
    const limit = asBoundedInt(args.limit, queryDefaults.userSummaryLimit, 1, MAX_MESSAGES_LIMIT);
    const daysBack = asBoundedInt(args.days_back, queryDefaults.userSummaryDaysBack, 1, 180);
    const cutoff = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

    const channels = getCandidateChannels(context, {
        include_threads: args.include_threads,
        channel_ids: args.channel_ids,
    });

    const maxChannelsScanned = Math.min(toolConfig.maxChannelsScanned, channels.length);
    const startedAt = Date.now();
    let scannedChannels = 0;
    let fetchedMessages = 0;
    let partial = false;
    const collected = [];

    for (const channel of channels) {
        if (scannedChannels >= maxChannelsScanned) {
            partial = true;
            break;
        }
        if (Date.now() - startedAt >= toolConfig.maxRuntimeMs) {
            partial = true;
            break;
        }
        if (fetchedMessages >= toolConfig.maxMessagesFetched) {
            partial = true;
            break;
        }
        if (collected.length >= limit) {
            break;
        }

        scannedChannels++;
        const remainingForResult = Math.max(1, limit - collected.length);
        const fetchLimit = Math.min(100, remainingForResult + 30);

        let fetched;
        try {
            fetched = await channel.messages.fetch({ limit: fetchLimit });
        } catch {
            continue;
        }

        fetchedMessages += fetched.size;
        for (const message of fetched.values()) {
            if (message.author?.id !== userId) {
                continue;
            }
            if (Number(message.createdTimestamp) < cutoff) {
                continue;
            }

            collected.push(formatMessage(message, toolConfig.maxMessageChars));
            if (collected.length >= limit) {
                break;
            }
        }
    }

    collected.sort((a, b) => {
        const aTime = Date.parse(a.created_at || 0);
        const bTime = Date.parse(b.created_at || 0);
        return aTime - bTime;
    });

    return {
        ok: true,
        user_id: userId,
        days_back: daysBack,
        count: collected.length,
        partial,
        scanned_channels: scannedChannels,
        scanned_channels_total: channels.length,
        fetched_messages: fetchedMessages,
        messages: collected,
    };
}

function buildUserActivityStats(messages) {
    const channelCounts = new Map();
    const hourCounts = new Map();
    let withLinks = 0;
    let withAttachments = 0;
    let totalChars = 0;

    for (const message of messages) {
        const channelId = message.channel_id || 'unknown';
        channelCounts.set(channelId, (channelCounts.get(channelId) || 0) + 1);

        const createdAt = Date.parse(message.created_at || '');
        if (Number.isFinite(createdAt)) {
            const hour = new Date(createdAt).getUTCHours();
            hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
        }

        if (message.has_links) {
            withLinks++;
        }
        if (message.has_attachments) {
            withAttachments++;
        }
        totalChars += String(message.content || '').length;
    }

    const topChannels = Array.from(channelCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([channel_id, message_count]) => ({ channel_id, message_count }));

    const hourlyDistribution = Array.from(hourCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([hour_utc, message_count]) => ({ hour_utc, message_count }));

    return {
        total_messages: messages.length,
        active_channels: channelCounts.size,
        top_channels: topChannels,
        hourly_distribution_utc: hourlyDistribution,
        average_message_chars: messages.length
            ? Math.round((totalChars / messages.length) * 100) / 100
            : 0,
        messages_with_links: withLinks,
        messages_with_attachments: withAttachments,
    };
}

async function runGetUserActivityStats(args, context) {
    const collected = await collectUserMessages(context, {
        ...args,
        limit: Math.min(200, asBoundedInt(args.limit, 200, 1, MAX_MESSAGES_LIMIT)),
    });

    if (!collected.ok) {
        return collected;
    }

    return {
        ok: true,
        user_id: collected.user_id,
        days_back: collected.days_back,
        partial: collected.partial,
        scanned_channels: collected.scanned_channels,
        scanned_channels_total: collected.scanned_channels_total,
        fetched_messages: collected.fetched_messages,
        stats: buildUserActivityStats(collected.messages),
    };
}

async function runSearchGuildMessages(args, context) {
    const query = asString(args.query);
    if (!query) {
        return { ok: false, error: 'query is required' };
    }

    const toolConfig = getToolExecutionConfig();
    const limit = asBoundedInt(args.limit, 20, 1, MAX_SEARCH_LIMIT);
    const daysBack = asBoundedInt(args.days_back, 14, 1, 90);
    const cutoff = Date.now() - (daysBack * 24 * 60 * 60 * 1000);

    await ensureGuildChannelsCache(context);
    const channels = getCandidateChannels(context, {
        include_threads: args.include_threads,
        channel_ids: args.channel_ids,
    });

    const startedAt = Date.now();
    const lowerQuery = query.toLowerCase();
    const matches = [];
    let scannedChannels = 0;
    let fetchedMessages = 0;
    let partial = false;

    for (const channel of channels) {
        if (scannedChannels >= toolConfig.maxChannelsScanned) {
            partial = true;
            break;
        }
        if (Date.now() - startedAt >= toolConfig.maxRuntimeMs) {
            partial = true;
            break;
        }
        if (fetchedMessages >= toolConfig.maxMessagesFetched) {
            partial = true;
            break;
        }
        if (matches.length >= limit) {
            break;
        }

        scannedChannels++;
        let fetched;
        try {
            fetched = await channel.messages.fetch({ limit: 100 });
        } catch {
            continue;
        }

        fetchedMessages += fetched.size;
        for (const message of fetched.values()) {
            if (Number(message.createdTimestamp) < cutoff) {
                continue;
            }

            const content = String(message.content || '');
            if (!content.toLowerCase().includes(lowerQuery)) {
                continue;
            }

            const formatted = formatMessage(message, toolConfig.maxMessageChars);
            matches.push({
                ...formatted,
                channel_name: channel.name ?? null,
            });
            if (matches.length >= limit) {
                break;
            }
        }
    }

    matches.sort((a, b) => {
        const aTime = Date.parse(a.created_at || 0);
        const bTime = Date.parse(b.created_at || 0);
        return bTime - aTime;
    });

    return {
        ok: true,
        query,
        count: matches.length,
        partial,
        scanned_channels: scannedChannels,
        scanned_channels_total: channels.length,
        fetched_messages: fetchedMessages,
        matches,
    };
}

function getToolDefinitions() {
    return TOOL_DEFINITIONS;
}

function getToolSystemPrompt() {
    return [
        'You can call Discord read-only tools to fetch real guild data.',
        'Do not call tools for casual chat, personal banter, or opinion-only questions.',
        'Prefer resolve_user before user-specific tools when only a name is provided.',
        'For "summary of user" requests, use get_user_activity_stats and optionally get_user_messages.',
        'Never invent IDs, messages, or channels. Use only returned tool data.',
        'If a tool fails or returns partial=true, mention that briefly and continue with best effort.',
    ].join(' ');
}

async function executeToolCall(toolCall, context) {
    const toolName = toolCall?.function?.name || '';
    const parsedArgs = parseToolArguments(toolCall);

    if (parsedArgs === null) {
        return {
            ok: false,
            error: 'invalid_arguments_json',
        };
    }

    switch (toolName) {
    case 'resolve_user':
        return runResolveUser(parsedArgs, context);
    case 'get_member':
        return runGetMember(parsedArgs, context);
    case 'get_user_profile':
        return runGetUserProfile(parsedArgs, context);
    case 'get_channel':
        return runGetChannel(parsedArgs, context);
    case 'list_channels':
        return runListChannels(parsedArgs, context);
    case 'get_channel_messages':
    case 'get_recent_messages':
        return runGetChannelMessages(parsedArgs, context);
    case 'get_user_messages':
        return collectUserMessages(context, parsedArgs);
    case 'get_user_activity_stats':
        return runGetUserActivityStats(parsedArgs, context);
    case 'search_guild_messages':
        return runSearchGuildMessages(parsedArgs, context);
    default:
        return {
            ok: false,
            error: `unknown_tool:${toolName || 'missing_name'}`,
        };
    }
}

module.exports = {
    getToolDefinitions,
    getToolSystemPrompt,
    executeToolCall,
};
