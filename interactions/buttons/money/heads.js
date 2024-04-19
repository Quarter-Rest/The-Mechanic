// module.exports = {
//     id: "heads",

//     async execute(interaction) {
//         var flip = Math.floor(Math.random() * 2);
//         var wOrL = '';
//         if(flip == 1) {
//             wOrL = '**won**'
//         }
//         else {
//             wOrL = '**lost**'
//         }
//         await interaction.update({
//             content: interaction.user.username + " selected heads against " + interaction.member.user.username + ' and ' + wOrL + '!',
//             components: [] // This removes the buttons
//         });
//         return;
//     },
// };