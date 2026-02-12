const { Client, Collection, GatewayIntentBits, Events, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { token, client_id, test_guild_id, mysql } = require('../secrets.json');
const database = require('./database');
const hotReload = require('./hotReload');

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
        console.error(error);
        const reply = { content: 'There was an error executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(reply);
        } else {
            await interaction.reply(reply);
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

// Login
client.login(token);
