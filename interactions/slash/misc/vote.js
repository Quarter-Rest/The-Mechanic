const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const CooldownTime = 259200000;
module.exports = {
	// The only part that makes this different from a default command.
	data: new SlashCommandBuilder()
		.setName("vote")
		.setDescription(
			"Create a basic yes/no vote."
		)
		.addStringOption((option) =>
			option
				.setName("title")
				.setDescription("The title of the vote.")
		)
		.addStringOption((option) =>
			option
				.setName("description")
				.setDescription("The description of the vote.")
		),

	async execute(interaction, args) {
		let title = interaction.options.getString("title");
		let desc = interaction.options.getString("description");
		const user = interaction.user;
		let curTime = Date.now();

		await global.con.query('SELECT * FROM `vote_creation`', function(err, results, fields) {
			if(err)
			{
				console.log("SQL Failed")
				console.error(err);
			}

			let authorData = results.find(o => o.id == user.id);
			if(authorData === undefined)
			{
				// player doesn't have database entry
				global.con.query(`INSERT INTO vote_creation (id, last_vote, banned) values (${user.id}, '0', '0')`, (err, row) => {
					// Return if there is an error
					if (err) {
						console.log("Failed");
						return console.log(err);
					}

					console.log(`Added ${user.username}.`);
				});

				authorData = results.find(o => o.id == user.id);
			}

			if (authorData.banned)
			{
				interaction.reply({content: "You are not allowed to create votes."});
				return;
			}

			if(curTime - authorData.last_vote < CooldownTime)
			{
				let diff = curTime - authorData.last_vote;
				diff = CooldownTime - diff;
				diff = Math.floor(diff / 1000);
				interaction.reply({content: `You are on vote cooldown for another ${diff} seconds.`});
				return;
			}
		});

		// finished doing checks
		const exampleEmbed = new MessageEmbed()
		.setColor(0x0099FF)
		.setTitle(title)
		.setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
		.setDescription(desc)
		.setThumbnail('https://th.bing.com/th/id/R.7e18af4777dbfce8a8f36e742ac7c318?rik=id88H6t%2fXM9OHA&riu=http%3a%2f%2fwww.technologybloggers.org%2fwp-content%2fuploads%2f2011%2f06%2fThe-United-Nations-logo.png&ehk=LBNkq62sxRCgriL6bRuJ0ZCqP5CPBfRT1mgPSqx3zaI%3d&risl=&pid=ImgRaw&r=0')
		.setTimestamp()

		const replied = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true });
		await replied.react('👍');
		await replied.react('👎');
		await replied.react('⚪');

		await global.con.query(`UPDATE vote_creation SET last_vote = ${curTime} WHERE id = ${user.id}`, (err, row) => {
            if (err) {
                message.channel.send("SQL Failed");
                return console.error(err);
            }
        });

	},
};
