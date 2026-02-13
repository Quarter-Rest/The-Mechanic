const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { getConfig } = require('./config');
const runtimeConfig = getConfig();
const token = runtimeConfig.discord.token;
const clientId = runtimeConfig.discord.clientId;
const testGuildId = runtimeConfig.discord.testGuildId;

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Deploy to guild for faster testing (instant update)
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, testGuildId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);

        // Uncomment below for global commands (takes up to 1 hour to propagate)
        // await rest.put(Routes.applicationCommands(client_id), { body: commands });
    } catch (error) {
        console.error(error);
    }
})();
