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
            new Configuration({ apiKey: process.env.OPENAI_KEY })
        );

        // Setting values for the prompt and message to be used in the GPT-3 and GPT-3.5-Turbo
        const GPT35TurboMessage = [
        { role: "system", content: `Create a recap for the following messages:\n${message.content}` },
        ];

        let GPT35Turbo = async (messagePrompt) => {
            const response = await openai.createChatCompletion({
              model: "gpt-3.5-turbo",
              messages: messagePrompt,
            });
          
            return response.data.choices[0].message.content;
          };

        console.log("### I'm GPT-3.5-TURBO. ####", await GPT35Turbo(GPT35TurboMessage));

		return;
	},
};
