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
		name: "Recap 1 Hour",
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

        var currTime = lastMessage.createdAt;
        currTime.setHours(maxTime.getHours() - 1)
        var prompt = `Create a bullet point recap for the following messages starting with "In the hour proceeding this message, ":\n`;
        const messages = await message.channel.messages.fetch({ limit: 250, cache: false, before: lastMessage.id });
        messages.reverse();
        for (let i = 0; i < messages.size; i++) {
            if(messages.at(i).createdAt < currTime){
              continue;
            }
            const previousMessage = messages.at(i);
            prompt += `${previousMessage.author.username}:\"${previousMessage.content}\"\n`;
            lastMessage = previousMessage;
        }

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

        await interaction.reply({ content: 'Working on it!', ephemeral: true });
        let replyMsg = await GPT35Turbo(GPT35TurboMessage);
        message.channel.send(replyMsg);
        
		return;
	},
};
