const { REST, Routes } = require('discord.js');
const { getConfig } = require('./config');
const { loadCommands } = require('./hotReload');
const runtimeConfig = getConfig();
const token = runtimeConfig.discord.token;
const clientId = runtimeConfig.discord.clientId;
const testGuildId = runtimeConfig.discord.testGuildId;

const commands = Array.from(loadCommands().values(), command => command.data.toJSON());
const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, testGuildId),
            { body: commands },
        );
        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
