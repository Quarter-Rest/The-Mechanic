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
        console.log(`"${message.content}\"`);
        var prompt = `Recap the following messages.\n\"${message.content}\"`;
        const openai = new OpenAIApi(configuration);
        (async () => {
            const gptResponse = await openai.createCompletion({
                model: "text-davinci-003",
                prompt: prompt,
                temperature: 0.6,
                max_tokens: 1024,
              });
              console.log(gptResponse.data.choices[0].text);
              await message.channel.send(`${gptResponse.data.choices[0].text}`);

        })();
		return;
	},
};
