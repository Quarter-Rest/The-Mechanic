// Deconstructed the constants we need in this file.

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

module.exports = {
	// The data needed to register slash commands to Discord.
	data: new SlashCommandBuilder()
		.setName("money")
		.setDescription(
			"Check your money."
		),

	async execute(interaction) {
        var MONEY = await GetMoney(interaction);
        var NICKNAME = await GetNickname(interaction);
        var messageText = NICKNAME + " has " + MONEY + " Frodecoins.";

		// Replies to the interaction!
		await interaction.reply({
			content: messageText,
		});
	},
};

//
async function GetMoney(message) {
    const userId = message.author.id;
    let query = `SELECT MONEY FROM MONEY WHERE ID = ?`;
  
    return new Promise((resolve, reject) => {
        con.query(query, [userId], (err, rows) => {
            if (err) {
                console.error("Error fetching data:", err);
                reject(err);
            }
      
            if (rows.length === 0) {
                console.log("No data found for user:", userId);
                const insert = `INSERT INTO MONEY (ID, NICKNAME, MONEY, SHARES) VALUES (?, ?, 50, 0)`;
                con.query(insert, [userId, message.author.username], (err, result) => {
                    if (err) {
                        console.error("Error inserting data:", err);
                        reject(err);
                    } else {
                        resolve(50);
                    }
                });
            } else {
                resolve(rows[0].MONEY);
            }
        });
    });
}

async function GetNickname(message) {
    const userId = message.author.id;
    const query = `SELECT NICKNAME FROM MONEY WHERE ID = ` + userId;
  
    return new Promise((resolve, reject) => {
        con.query(query, [userId], (err, rows) => {
            if (err) {
                console.error("Error fetching data:", err);
                reject(err);
            }
      
            if (rows.length === 0) {
                console.log("No data found for user:", userId);
                reject("No data found");
            }
      
            resolve(rows[0].NICKNAME);
        });
    });
}
