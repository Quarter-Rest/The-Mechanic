const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Replies with Pong!'),

    async execute(interaction) {
        const { resource } = await interaction.reply({ content: 'Pinging...', withResponse: true });
        const latency = resource.message.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`Pong! Latency: ${latency}ms | API: ${interaction.client.ws.ping}ms`);
    },
};
