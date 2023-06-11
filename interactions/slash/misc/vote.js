const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const CooldownTime = 172800000;
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
		run(interaction, args);
	}
};

async function run(interaction, args) {
	let title = interaction.options.getString("title");
	let desc = interaction.options.getString("description");

	if(interaction.channel.id != '1107152890465890334')
	{
		interaction.reply({content: "You may only create votes in the proper thread."})
		return;
	}

	if(!title || !desc) return;

	const user = interaction.user;
	let curTime = Date.now();

	
	global.con.ping(function (err) 
	{
		if (err) 
		{
			console.log("Lost connection to MYSQL, reestablishing before we run the command.")
			interaction.channel.send({content: "Lost connection to MYSQL, reestablishing before we run the command."})
			global.con = createConnection(mysql);

			// Then we are going to connect to our MySQL database and we will test this on errors
			global.con.connect(err => {
				// Console log if there is an error
				if (err) return console.log(err);

				// No error found?
				console.log(`MySQL has been connected by vote command!`);

				try {
					run(interaction, args);
					return;
				} 
				catch (error) 
				{
					console.error(error);
					interaction.reply({
						content: "There was an error trying to execute that command!",
					});
					return;
				}
			});
		}
	})

	global.con.query('SELECT * FROM `vote_creation`', function(err, results, fields) {
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

		if (authorData.banned != undefined && authorData.banned)
		{
			interaction.reply({content: "You are not allowed to create votes."});
			return;
		}

		if(curTime - authorData.last_vote < CooldownTime)
		{
			let diff = curTime - authorData.last_vote;
			diff = CooldownTime - diff;
			interaction.reply({content: `You are on vote cooldown for another ${msToTime(diff)}`});
			return;
		}

		CreateVote(interaction, user, title, desc, curTime);
		return;
	});
}

async function CreateVote(interaction, user, title, desc, curTime)
{
	// finished doing checks
	const exampleEmbed = new MessageEmbed()
	.setColor(0x0099FF)
	.setTitle(title)
	.setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatarURL() })
	.setDescription(desc)
	.addFields(
		{ name: 'Vote Yay', value: '👍', inline: true },
		{ name: 'Vote Nay', value: '👎', inline: true },
		{ name: 'Abstain', value: '⚪', inline: true },
	)
	.setThumbnail('https://th.bing.com/th/id/R.7e18af4777dbfce8a8f36e742ac7c318?rik=id88H6t%2fXM9OHA&riu=http%3a%2f%2fwww.technologybloggers.org%2fwp-content%2fuploads%2f2011%2f06%2fThe-United-Nations-logo.png&ehk=LBNkq62sxRCgriL6bRuJ0ZCqP5CPBfRT1mgPSqx3zaI%3d&risl=&pid=ImgRaw&r=0')
	.setTimestamp()

	const replied = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true });
	await replied.react('👍');
	await replied.react('👎');
	await replied.react('⚪');

	global.con.query(`UPDATE vote_creation SET last_vote = ${curTime} WHERE id = ${user.id}`, (err, row) => {
		if (err) {
			console.log("SQL Failed");
			return console.error(err);
		}
	});
}

// https://stackoverflow.com/questions/19700283/how-to-convert-time-in-milliseconds-to-hours-min-sec-format-in-javascript
function msToTime(duration) {
	var milliseconds = Math.floor((duration % 1000) / 100),
	  seconds = Math.floor((duration / 1000) % 60),
	  minutes = Math.floor((duration / (1000 * 60)) % 60),
	  hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  
	hours = (hours < 10) ? "0" + hours : hours;
	minutes = (minutes < 10) ? "0" + minutes : minutes;
	seconds = (seconds < 10) ? "0" + seconds : seconds;
  
	return hours + " hrs " + minutes + " mins " + seconds + " secs";
  }