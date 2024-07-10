// Deconstructed the constants we need in this file.

const { EmbedBuilder, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
let DateGenerator = require('random-date-generator'); 

const blacklistID = ['981746689096421406']

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("rm")
		.setDescription(
			"Sends a random message from a the discord."
		),

	async execute(interaction) {
        let startDate = new Date(2020, 10, 15, 13);
        let endDate = new Date();
        let snow = new Snowflake(DateGenerator.getRandomDateInRange(startDate, endDate));

        let messages = Array.from((await interaction.channel.messages.fetch({
            limit: 100,
            before: snow.toString()
        }, false)).values());

        let m = messages[Random(0, messages.length)];

        while(m.length > 0 && blacklistID.contains(m.author.id))
        {
            messages.splice(messages.indexOf(m), 1);
            m = messages[Random(0, messages.length)];
        } 

        var date = m.createdAt;

		//Delete last
		interaction.channel.messages.fetch({ limit: 1 }).then(messages => {
			let lastMessage = messages.first();
			
			if (!lastMessage.author.bot) {
			  lastMessage.delete();
			}
		});

        let messageText = m.author.username + "\n" + date.toLocaleString('en-US') + "\n\"" + m.cleanContent + "\"" + "\nhttps://discord.com/channels/" + m.author.id + "/" + m.channel.id + "/" + m.id;
		// Replies to the interaction!
		await interaction.reply({
			content: messageText,
		});
	},
};
