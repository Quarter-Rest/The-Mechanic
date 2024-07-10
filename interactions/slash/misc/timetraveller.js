const { EmbedBuilder, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("timetraveller")
		.setDescription(
			"Get the time and date in case you're a time traveller and only have The Mechanic."
		),

	async execute(interaction) {
        var messageText = "";
		
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

		messageText = "Good " + tod + "! It is " + day + ", " + date.toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'}) + ".";

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
