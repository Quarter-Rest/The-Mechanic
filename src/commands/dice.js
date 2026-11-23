const { randomInt } = require('node:crypto');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');

const diceSides = [4, 6, 8, 10, 12, 20];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Roll a die'),

    async execute(interaction) {
        const buttons = diceSides.map(sides => new ButtonBuilder()
            .setCustomId(`dice:${sides}`)
            .setLabel(`D${sides}`)
            .setStyle(ButtonStyle.Secondary));

        await interaction.reply({
            content: 'Choose a die to roll.',
            components: [
                new ActionRowBuilder().addComponents(buttons.slice(0, 3)),
                new ActionRowBuilder().addComponents(buttons.slice(3)),
            ],
        });
    },

    async handleButton(interaction) {
        const sides = diceSides.find(sides => interaction.customId === `dice:${sides}`);
        if (sides === undefined) return;

        await interaction.deferUpdate();
        const result = randomInt(1, sides + 1);
        await interaction.followUp({
            content: `<@${interaction.user.id}> rolled a D${sides} and got a ${result}!`,
            allowedMentions: { parse: [] },
        });
    },
};
