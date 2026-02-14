const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { getConfig } = require('./config');
const hotReload = require('./hotReload');
const { generateWithAI, activeGenerations } = require('./commands/proompt');
const mentionResponder = require('./services/mentionResponder');
const chatTrigger = require('./services/chatTrigger');
const conversationContextStore = require('./services/conversationContextStore');
const { formatErrorForAI, formatErrorForUser } = require('./utils/errorFormatter');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = hotReload.getCommandFiles(commandsPath);

for (const filePath of commandFiles) {
    const command = hotReload.loadCommand(filePath);

    if (command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
    }
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        const runtimeErrorForAI = formatErrorForAI(error);
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

        const cmdName = interaction.commandName;
        const generatedFile = path.join(__dirname, 'commands', 'generated', `${cmdName}.js`);
        if (fs.existsSync(generatedFile) && !activeGenerations.has(cmdName)) {
            (async () => {
                activeGenerations.add(cmdName);
                try {
                    console.log(`[AutoFix] Attempting to fix /${cmdName}...`);
                    try {
                        await interaction.followUp({ content: `Attempting to auto-fix \`/${cmdName}\`...` });
                    } catch {}

                    const existingCode = fs.readFileSync(generatedFile, 'utf-8');
                    const fixedCode = await generateWithAI(cmdName, null, {
                        existingCode,
                        runtimeError: runtimeErrorForAI,
                    });
                    fs.writeFileSync(generatedFile, fixedCode);
                    console.log(`[AutoFix] Fixed /${cmdName}, hot reload will pick it up`);

                    try {
                        await interaction.followUp({ content: `Auto-fixed \`/${cmdName}\` - try again!` });
                    } catch {}
                } catch (fixError) {
                    console.error(`[AutoFix] Failed to fix /${cmdName}:`, fixError.message);
                    try {
                        await interaction.followUp({ content: `Auto-fix for \`/${cmdName}\` failed: ${fixError.message}` });
                    } catch {}
                } finally {
                    activeGenerations.delete(cmdName);
                }
            })();
        }
    }
});

client.on(Events.MessageCreate, async message => {
    if (!message.guild) return;
    if (message.author.bot || message.webhookId || message.system) return;

    const botUserId = client.user?.id;
    const runtimeConfig = getConfig();
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
            authorId,
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

    const rest = new REST().setToken(token);
    try {
        console.log(`Registering ${commands.length} slash commands...`);
        await rest.put(
            Routes.applicationGuildCommands(clientId, testGuildId),
            { body: commands }
        );
        console.log('Slash commands registered successfully');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }

    hotReload.init(client, token, clientId, testGuildId);
    hotReload.startWatching();
});

process.on('unhandledRejection', error => {
    console.error('[Unhandled Rejection]', error);
});
process.on('uncaughtException', error => {
    console.error('[Uncaught Exception]', error);
});

client.login(getConfig().discord.token);
