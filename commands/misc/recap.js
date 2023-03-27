const { MessageActionRow, MessageButton } = require('discord.js');

module.exports = {
	name: "recap",
	description: "Recap messages within a given timeframe.",

	async execute(interaction, args) {
		const row = new MessageActionRow()
			.addComponents(
				new MessageButton()
					.setCustomId('recap1')
					.setLabel('1 Hour')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('recap4')
					.setLabel('4 Hours')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('recap8')
					.setLabel('8 Hours')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('recap12')
					.setLabel('12 Hours')
					.setStyle('PRIMARY'),
				new MessageButton()
					.setCustomId('recap24')
					.setLabel('24 Hours')
					.setStyle('PRIMARY')
			);
		await interaction.reply({ content: "Please choose a timeframe to recap.", components: [row] });
	},
};
