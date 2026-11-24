const { Client, GatewayIntentBits, Events } = require('discord.js');
const { getConfig } = require('./config');
const hotReload = require('./hotReload');
const mentionResponder = require('./services/mentionResponder');
const chatTrigger = require('./services/chatTrigger');
const conversationContextStore = require('./services/conversationContextStore');
const fun = require('./services/fun');
const { formatErrorForUser } = require('./utils/errorFormatter');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = hotReload.loadCommands();

let nextFunErrorLog = 0;

function logFunStorageError(error) {
    const now = Date.now();
    if (now < nextFunErrorLog) return;

    nextFunErrorLog = now + 60_000;
    console.error('[Fun] Storage operation failed.', error.code ?? error.name);
}

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton() && interaction.customId.startsWith('dice:')) {
        try {
            await client.commands.get('dice')?.handleButton(interaction);
        } catch (error) {
            console.error('[Button Error] /dice:', error);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        const userErrorMessage = formatErrorForUser(error);

        console.error(`[Command Error] /${interaction.commandName}:`, error);
        try {
            const reply = { content: `Error in \`/${interaction.commandName}\`: \`${userErrorMessage}\``, ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        } catch (replyError) {
            console.error('[Command Error] Failed to send error reply:', replyError.message);
        }
    }
});

client.on(Events.MessageCreate, async message => {
    if (!message.guild) return;
    if (message.author.bot || message.webhookId || message.system) return;

    const runtimeConfig = getConfig();
    if (message.guild.id === runtimeConfig.discord.testGuildId) {
        void fun.rewardMessage(message.author.id, message.id).catch(logFunStorageError);
    }

    const botUserId = client.user?.id;
    const trigger = chatTrigger.shouldRespond(message, botUserId, runtimeConfig.chat.trigger);
    if (!trigger.shouldRespond) {
        return;
    }

    const guildId = message.guild.id;
    const channelId = message.channelId;
    const authorId = message.author.id;

    if (!mentionResponder.consumeCooldown(guildId, authorId)) {
        return;
    }

    const lockAcquired = conversationContextStore.acquireChannelLock({ guildId, channelId });
    if (!lockAcquired) {
        try {
            await message.reply({ content: mentionResponder.getBusyReply() });
        } catch {}
        return;
    }

    try {
        const reply = await mentionResponder.generateMentionReply({
            guildId,
            channelId,
            guild: message.guild,
            channel: message.channel,
            message,
            authorId,
            authorMember: message.member || null,
            authorDisplayName: message.member?.displayName || message.author.globalName || message.author.username,
            messageContent: message.content || '',
            botUserId,
            triggerReason: trigger.reason,
        });

        await message.reply({ content: reply });
    } catch (error) {
        console.error(`[Mention] Failed to respond for ${guildId}:${authorId}:`, error.message);
        try {
            await message.reply({ content: mentionResponder.getFallbackReply() });
        } catch {}
    } finally {
        conversationContextStore.releaseChannelLock({ guildId, channelId });
    }
});

client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    const runtimeConfig = getConfig();
    const token = runtimeConfig.discord.token;
    const clientId = runtimeConfig.discord.clientId;
    const testGuildId = runtimeConfig.discord.testGuildId;

    void fun.initialize().catch(logFunStorageError);

    hotReload.init(client, token, clientId, testGuildId);
    hotReload.startWatching();
    await hotReload.registerCommands();
});

process.on('unhandledRejection', error => {
    console.error('[Unhandled Rejection]', error);
});
process.on('uncaughtException', error => {
    console.error('[Uncaught Exception]', error);
});

client.login(getConfig().discord.token);
