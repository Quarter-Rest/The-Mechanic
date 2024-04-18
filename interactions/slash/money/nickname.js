// // Change money nickname.

// const { MessageEmbed, Collection } = require("discord.js");
// const { SlashCommandBuilder } = require("@discordjs/builders");

// module.exports = {
// 	// The data needed to register slash commands to Discord.
// 	data: new SlashCommandBuilder()
// 		.setName("nickname")
// 		.setDescription(
// 			"Change your nickname to something else when using money commands."
// 		).addStringOption(option =>
// 			option
// 				.setName('Name')
// 				.setDescription('What to change your nickname to.')
//                 .setRequired(true)),

// 	async execute(interaction) {
//         await interaction.reply({ content: 'Workin\' on it.', ephemeral: true });
        
//         SetNickname(interaction, interaction.options.getString('Name'));
//         var messageText = interaction.options.getString('Name');
// 		interaction.channel.send({ content: 'Nickname changed to ' + messageText + '.'});
// 	},
// };

// async function SetNickname(interaction, nick) {
//     const userId = interaction.member.id;
//     const query = `UPDATE MONEY SET NICKNAME = ? WHERE ID = ?`;

//     return new Promise((resolve, reject) => {
//         con.query(query, [nick, userId], (err, result) => {
//             if (err) {
//                 console.error("Error updating data:", err);
//                 reject(err);
//             }
      
//             if (result.affectedRows === 0) {
//                 console.log("No data found for user:", userId);
//                 reject("No data found");
//             }
      
//             resolve(`Nickname changed to ${nick}`);
//         });
//     });
// }