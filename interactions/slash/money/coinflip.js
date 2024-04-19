const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { MessageButton } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Create a coinflip challenge.")
        .addStringOption(option =>
            option
                .setName('amount')
                .setDescription('How much to wager. (optional)')
                .setRequired(false)),

    async execute(interaction, args) {
        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('heads')
                    .setLabel('Heads')
                    .setStyle('PRIMARY'),
                new MessageButton()
                    .setCustomId('tails')
                    .setLabel('Tails')
                    .setStyle('PRIMARY')
        );
        var wager = interaction.options.getString('amount');
        await interaction.reply({ content: "Please choose heads or tails.", components: [row] });
    },
};

// Listen for interaction create event
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'heads' || interaction.customId === 'tails') {
        // Delete the message after the button is clicked
        await interaction.message.delete();
    }
});