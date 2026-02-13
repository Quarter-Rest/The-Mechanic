const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { token, client_id, test_guild_id, mysql } = require('../secrets.json');
const database = require('./database');
const hotReload = require('./hotReload');
const { generateWithAI, activeGenerations } = require('./commands/proompt');
const userProfileStore = require('./services/userProfileStore');
const profileAnalyzer = require('./services/profileAnalyzer');
const mentionResponder = require('./services/mentionResponder');
const { formatErrorForAI, formatErrorForUser } = require('./utils/errorFormatter');

const SAMPLE_RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.commands = new Collection();

// Load commands using hot reload's loader (supports subdirectories)
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

async function getSocialTargetUserIds(message, authorId) {
    const socialTargets = new Set();

    for (const mentionedUser of message.mentions.users.values()) {
        if (mentionedUser.bot || mentionedUser.id === authorId) {
            continue;
        }
        socialTargets.add(mentionedUser.id);
    }

    let repliedUser = message.mentions.repliedUser || null;
    if (!repliedUser && message.reference?.messageId) {
        const referencedMessage = await message.fetchReference().catch(() => null);
        repliedUser = referencedMessage?.author || null;
    }

    if (repliedUser && !repliedUser.bot && repliedUser.id !== authorId) {
        socialTargets.add(repliedUser.id);
    }

    return [...socialTargets];
}

// Handle interactions
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
            console.error(`[Command Error] Failed to send error reply:`, replyError.message);
        }

        // Auto-fix: if the command is a generated command, attempt to fix it
        const cmdName = interaction.commandName;
        const generatedFile = path.join(__dirname, 'commands', 'generated', `${cmdName}.js`);
        if (fs.existsSync(generatedFile) && !activeGenerations.has(cmdName)) {
            // Fire-and-forget async auto-fix
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
                    // Follow up to let the user know
                    try {
                        await interaction.followUp({ content: `Auto-fixed \`/${cmdName}\` — try again!` });
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

    const guildId = message.guild.id;
    const authorId = message.author.id;
    const botUserId = client.user?.id;
    const botMentioned = Boolean(botUserId && message.mentions.users.has(botUserId));
    const content = typeof message.content === 'string' ? message.content.trim() : '';

    try {
        await userProfileStore.touchUserProfile(guildId, authorId, {
            messagesSeenDelta: 1,
            messagesSinceSemanticDelta: 1,
            mentionsToBotDelta: botMentioned ? 1 : 0,
        });
    } catch (error) {
        console.error(`[Profile] Failed to touch profile ${guildId}:${authorId}:`, error.message);
    }

    if (content.length >= 5) {
        try {
            await userProfileStore.insertSample({
                guildId,
                ownerUserId: authorId,
                actorUserId: authorId,
                channelId: message.channelId,
                messageId: message.id,
                sampleType: 'self',
                content,
            });

            await userProfileStore.pruneSamples(guildId, authorId, 'self', userProfileStore.SELF_SAMPLE_CAP);

            const socialTargetUserIds = await getSocialTargetUserIds(message, authorId);
            for (const targetUserId of socialTargetUserIds) {
                await userProfileStore.insertSample({
                    guildId,
                    ownerUserId: targetUserId,
                    actorUserId: authorId,
                    channelId: message.channelId,
                    messageId: message.id,
                    sampleType: 'social',
                    content,
                });

                await userProfileStore.pruneSamples(guildId, targetUserId, 'social', userProfileStore.SOCIAL_SAMPLE_CAP);
            }
        } catch (error) {
            console.error(`[Profile] Failed to store profile samples for ${guildId}:${authorId}:`, error.message);
        }
    }

    try {
        await profileAnalyzer.refreshUserProfile({ guildId, userId: authorId, force: false });
    } catch (error) {
        console.error(`[Profile] Semantic refresh failed for ${guildId}:${authorId}:`, error.message);
    }

    if (!botMentioned) {
        return;
    }

    try {
        const existingProfile = await userProfileStore.getProfile(guildId, authorId);
        if (!userProfileStore.isSemanticRecent(existingProfile, 5)) {
            await profileAnalyzer.refreshUserProfile({ guildId, userId: authorId, force: true });
        }

        const latestProfile = await userProfileStore.getProfile(guildId, authorId);
        const reply = await mentionResponder.generateMentionReply({
            botUserId,
            messageContent: message.content || '',
            profile: latestProfile || {},
        });

        await message.reply({ content: reply });
    } catch (error) {
        console.error(`[Mention] Failed to respond to mention for ${guildId}:${authorId}:`, error.message);
        try {
            await message.reply({ content: mentionResponder.FALLBACK_REPLY });
        } catch {}
    }
});

client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);

    // Register commands on startup
    const rest = new REST().setToken(token);
    try {
        console.log(`Registering ${commands.length} slash commands...`);
        await rest.put(
            Routes.applicationGuildCommands(client_id, test_guild_id),
            { body: commands }
        );
        console.log('Slash commands registered successfully');
    } catch (error) {
        console.error('Failed to register commands:', error);
    }

    // Initialize and start hot reload
    hotReload.init(client, token, client_id, test_guild_id);
    hotReload.startWatching();

    // Initialize user profile tables and cleanup task
    try {
        await userProfileStore.init();
        const deletedRows = await userProfileStore.cleanupOldSamples(SAMPLE_RETENTION_DAYS);
        console.log(`[Profile] Profile tables ready (initial cleanup deleted ${deletedRows} sample rows)`);
    } catch (error) {
        console.error('[Profile] Failed to initialize profile store:', error);
    }

    setInterval(async () => {
        try {
            const deletedRows = await userProfileStore.cleanupOldSamples(SAMPLE_RETENTION_DAYS);
            if (deletedRows > 0) {
                console.log(`[Profile] Cleanup deleted ${deletedRows} old sample rows`);
            }
        } catch (error) {
            console.error('[Profile] Cleanup failed:', error.message);
        }
    }, CLEANUP_INTERVAL_MS);
});

// Connect to database
database.connect(mysql);

// Global crash protection — log but don't die
process.on('unhandledRejection', (error) => {
    console.error('[Unhandled Rejection]', error);
});
process.on('uncaughtException', (error) => {
    console.error('[Uncaught Exception]', error);
});

// Login
client.login(token);
