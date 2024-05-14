const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { MessageButton } = require('discord.js');
const { ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName("oddson")
        .setDescription("Test your luck with a specified odds.")
        .addStringOption(option =>
            option
                .setName('odds')
                .setDescription('Odds of winning. (1 in 2-1000')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('amount')
                .setDescription('How much to wager. (optional)')
                .setRequired(false)),

    async execute(interaction, args) {
        var odds = interaction.options.getString('odds');
        //Make sure odds is an int and between 2 and 1000
        if(isNaN(odds) || odds < 2 || odds > 1000)
        {
            await interaction.reply({ content: "Invalid odds. Please choose a number between 2 and 1000.", ephemeral: true });
            return;
        }       
        var wager = interaction.options.getString('amount');
        if(wager == null)
        {
            wager = 0;
        }
        
        await interaction.reply({ content: "User " + wager + " Frodecoins.", components: [] });
    },
};