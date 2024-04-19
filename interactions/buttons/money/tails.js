// module.exports = {
//     id: "tails",

//     async execute(interaction) {
//         var flip = Math.floor(Math.random() * 2);
//         var wOrL = '';
//         if(flip == 1) {
//             wOrL = '**lost**'
//         }
//         else {
//             wOrL = '**won**'
//         }
//         await interaction.update({
// 			content: interaction.user.username + " selected tails against " + interaction.member.user.username + ' and ' + wOrL + '!',
//             components: [] // This removes the buttons
//         });
//         return;
//     },
// };