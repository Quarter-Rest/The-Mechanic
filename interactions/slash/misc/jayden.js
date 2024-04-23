// Deconstructed the constants we need in this file.

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("jayden")
		.setDescription(
			"Get Jayden\'s impression of the server right now."
		),

	async execute(interaction) {
        var messageText = "";

		//Get number of people in the voice channels.
        let members = interaction.guild.members.cache.filter(member => member.voice.channel);
        let count = members.size;
		// 											     +5 cst
		//Set up time of day from SQL server. 2024-04-23T22:23:04.000Z
		var date = await GetTime();
		date.setHours(date.getHours() - 5);
		var day = date.toLocaleDateString('en-US',{weekday: "long"});
		var time = date.getHours();
		var tod = "";
		if(time >= 0 && time < 12) {
			tod = "morning";
		}
		else if(time >= 12 && time < 18) {
			tod = "afternoon";
		}
		else {
			var rand = Math.random();
			if(rand < 0.5) {
				tod = "night";
			}
			else {
				tod = "evening";
			}
		}

		if(count <= 4) {
			messageText = "Damn, chat's really dead on a " + day + " " + tod + " huh?";
		}
		else if(count > 4 && count <= 8) {
			messageText = "Chat's really popping off on a " + day + " " + tod + "!";
		}
		else {
			messageText = "Wowzers! Chat's really super EXTRA popping off on a " + day + " " + tod + "!";
		}

		// Replies to the interaction!
		await interaction.reply({
			content: messageText,
		});
	},
};

async function GetTime() {
    const query = 'SELECT SYSDATE() AS TIME;';

    return new Promise((resolve, reject) => {
        con.query(query, (err, result) => {
            if (err) {
                console.error("Error fetching data:", err);
                reject(err);
            }
            resolve(result[0].TIME);
        });
    });
}
