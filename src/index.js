const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { token, client_id, test_guild_id, mysql } = require('../secrets.json');
const database = require('./database');
const hotReload = require('./hotReload');
const { generateWithAI, activeGenerations } = require('./commands/proompt');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
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
        console.error(`[Command Error] /${interaction.commandName}:`, error);
        try {
            const reply = { content: `Error in \`/${interaction.commandName}\`: \`${error.message}\``, ephemeral: true };
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
                        runtimeError: error.stack || error.message,
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
