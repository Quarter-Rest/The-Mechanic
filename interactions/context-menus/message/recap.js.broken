// const { OPENAI_SECRET_KEY } = require("../../../config.json");
// const { generate   } = require('stability-client')
// const fs = require('fs');
// const {MessageAttachment, MessageEmbed} = require("discord.js");
// const { 
//     v1: uuidv1,
//     v4: uuidv4,
//   } = require('uuid');

//   const { OpenAI } = require("openai");

// module.exports = {
// 	data: {
// 		name: "Recap",
// 		type: 3, // 3 is for message context menus
// 	},

// 	/**
// 	 * @param {import("discord.js").ContextMenuInteraction} interaction The Interaction Object of the command.
// 	 */

// 	async execute(interaction) {
//         var message = await interaction.channel.messages.fetch(interaction.targetId);
//         message.react('770876050318032896');
        
//         const openai = new OpenAI(
//             new OpenAI({ apiKey: OPENAI_SECRET_KEY })
//         );

//         var lastMessage = message;

//         var prompt = `Create a bullet point recap for the following messages and keep it to less than 750 characters (including formatting) and summarize as needed to meet this requirement and ignore unimportant information such as random comments or numbers:\n`;
//         const messages = await message.channel.messages.fetch({ limit: 100, cache: false, before: lastMessage.id });
//         messages.reverse();
//         for (let i = 0; i < messages.size; i++) {
//             const previousMessage = messages.at(i);
//             prompt += `${previousMessage.author.username}:\"${previousMessage.content}\"\n`;
//             lastMessage = previousMessage;
//         }

//         // Setting values for the prompt and message to be used in the GPT-3 and GPT-3.5-Turbo
// 		    let GPT35Turbo = async (messagePrompt) => {
//         const response = await openai.chat.completions.create({
//           model: "gpt-3.5-turbo",
//           messages: messagePrompt,
//         });
    
//           return response.choices[0].message;
//         };

//         const GPT35TurboMessage = [
//           { role: "system", content: prompt },
//         ];

//         await interaction.reply({ content: 'Working on it!', ephemeral: true });
//         let replyMsg = await GPT35Turbo(GPT35TurboMessage);
//         message.channel.send(replyMsg);
        
// 		return;
// 	},
// };
