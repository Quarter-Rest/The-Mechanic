const { OPENAI_SECRET_KEY } = require("../../../config.json");
const { generate   } = require('stability-client')
const fs = require('fs');
const {MessageAttachment, MessageEmbed} = require("discord.js");
const { 
    v1: uuidv1,
    v4: uuidv4,
  } = require('uuid');

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
apiKey: OPENAI_SECRET_KEY,
});

module.exports = {
	data: {
		name: "Recap",
		type: 3, // 3 is for message context menus
	},

	/**
	 * @param {import("discord.js").ContextMenuInteraction} interaction The Interaction Object of the command.
	 */

	async execute(interaction) {
        var message = await interaction.channel.messages.fetch(interaction.targetId);
        message.react('770876050318032896');
        
        const openai = new OpenAIApi(
            new Configuration({ apiKey: OPENAI_SECRET_KEY })
        );

        var lastMessage = message;

        var prompt = `Create a recap for the following messages:\n`;
        const messages = await message.channel.messages.fetch({ limit: 10, cache: false, before: lastMessage.id });
        messages.reverse()
        for (let i = 0; i < messages.size; i++) {
            const previousMessage = messages.at(i);
            prompt += `${previousMessage.author.username}:\"${previousMessage.content}\"\n`;
            lastMessage = previousMessage;
        }
        console.log(prompt);
        // Setting values for the prompt and message to be used in the GPT-3 and GPT-3.5-Turbo
        const GPT35TurboMessage = [
        { role: "system", content: prompt },
        ];

        let GPT35Turbo = async (messagePrompt) => {
            const response = await openai.createChatCompletion({
              model: "gpt-3.5-turbo",
              messages: messagePrompt,
            });
          
            return response.data.choices[0].message.content;
          };
        
        let replyMsg = await GPT35Turbo(GPT35TurboMessage);
        message.channel.send(replyMsg);
        await interaction.reply({ content: replyMsg});
        
		return;
	},
};
