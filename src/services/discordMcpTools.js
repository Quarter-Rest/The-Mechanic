const MAX_CHANNELS_LIMIT = 100;
const MAX_MESSAGES_LIMIT = 20;

const TOOL_DEFINITIONS = [
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
                        type: 'integer',
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
            name: 'get_recent_messages',
            description: 'Read recent messages from a channel in this guild.',
            parameters: {
                type: 'object',
                properties: {
                    channel_id: {
                        type: 'string',
                        description: 'Target channel ID. Defaults to the current channel if omitted.',
                    },
                    limit: {
                        type: 'integer',
                        minimum: 1,
                        maximum: MAX_MESSAGES_LIMIT,
                        description: `Maximum messages to return (1-${MAX_MESSAGES_LIMIT}).`,
                    },
                },
                additionalProperties: false,
            },
        },
    },
];

function asString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function asBoundedInt(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function normalizeContent(content) {
    if (typeof content !== 'string') {
        return '';
    }
    return content.replace(/\s+/g, ' ').trim().slice(0, 240);
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

function formatChannel(channel) {
    return {
        id: channel.id,
        name: channel.name ?? null,
        type: channel.type,
        parent_id: channel.parentId ?? null,
        nsfw: Boolean(channel.nsfw),
        topic: normalizeContent(channel.topic ?? ''),
    };
}

function isThreadChannel(channel) {
    if (!channel) {
        return false;
    }

    if (typeof channel.isThread === 'function') {
        return channel.isThread();
    }

    return false;
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

async function runGetMember(args, context) {
    const userId = asString(args.user_id);
    if (!userId) {
        return { ok: false, error: 'user_id is required' };
    }

    const guild = context?.guild;
    if (!guild) {
        return { ok: false, error: 'guild context unavailable' };
    }

    try {
        const member = await guild.members.fetch(userId);
        return {
            ok: true,
            member: {
                id: member.id,
                username: member.user?.username ?? null,
                global_name: member.user?.globalName ?? null,
                display_name: member.displayName ?? null,
                bot: Boolean(member.user?.bot),
                joined_at: member.joinedAt ? member.joinedAt.toISOString() : null,
                roles: member.roles.cache
                    .filter(role => role.id !== guild.id)
                    .map(role => ({ id: role.id, name: role.name }))
                    .slice(0, 30),
            },
        };
    } catch {
        return { ok: false, error: 'member not found in this guild' };
    }
}

async function runGetChannel(args, context) {
    const channelId = asString(args.channel_id);
    if (!channelId) {
        return { ok: false, error: 'channel_id is required' };
    }

    const channel = await resolveGuildChannel(context, channelId);
    if (!channel || channel.guildId !== context?.guild?.id) {
        return { ok: false, error: 'channel not found in this guild' };
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

    const limit = asBoundedInt(args.limit, 25, 1, MAX_CHANNELS_LIMIT);
    const includeThreads = Boolean(args.include_threads);

    try {
        await guild.channels.fetch();
    } catch {}

    const channels = [];
    for (const channel of guild.channels.cache.values()) {
        if (!includeThreads && isThreadChannel(channel)) {
            continue;
        }

        channels.push(formatChannel(channel));
        if (channels.length >= limit) {
            break;
        }
    }

    return {
        ok: true,
        guild_id: guild.id,
        count: channels.length,
        channels,
    };
}

async function runGetRecentMessages(args, context) {
    const targetChannelId = asString(args.channel_id) || context?.channel?.id || '';
    const limit = asBoundedInt(args.limit, 8, 1, MAX_MESSAGES_LIMIT);
    const channel = await resolveGuildChannel(context, targetChannelId);

    if (!channel || channel.guildId !== context?.guild?.id) {
        return { ok: false, error: 'channel not found in this guild' };
    }

    if (!channel.isTextBased || !channel.isTextBased()) {
        return { ok: false, error: 'channel is not text-based' };
    }

    try {
        const messages = await channel.messages.fetch({ limit });
        const ordered = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        return {
            ok: true,
            channel: formatChannel(channel),
            count: ordered.length,
            messages: ordered.map(message => ({
                id: message.id,
                author_id: message.author?.id ?? null,
                author_name: message.member?.displayName || message.author?.globalName || message.author?.username || 'unknown',
                created_at: message.createdAt ? message.createdAt.toISOString() : null,
                content: normalizeContent(message.content || ''),
            })),
        };
    } catch {
        return { ok: false, error: 'unable to fetch messages for this channel' };
    }
}

function getToolDefinitions() {
    return TOOL_DEFINITIONS;
}

function getToolSystemPrompt() {
    return [
        'You can call Discord tools to fetch real guild data.',
        'Only use tool data returned in this conversation and do not invent IDs or results.',
        'If a tool fails, explain briefly and continue with best effort.',
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
    case 'get_member':
        return runGetMember(parsedArgs, context);
    case 'get_channel':
        return runGetChannel(parsedArgs, context);
    case 'list_channels':
        return runListChannels(parsedArgs, context);
    case 'get_recent_messages':
        return runGetRecentMessages(parsedArgs, context);
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
