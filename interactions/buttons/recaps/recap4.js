const { OPENAI_SECRET_KEY } = require("../../../config.json");
const { generate } = require('stability-client')
const fs = require('fs');
const { MessageAttachment, MessageEmbed } = require("discord.js");
const {
	v1: uuidv1,
	v4: uuidv4,
} = require('uuid');

const { OpenAI } = require("openai");
const configuration = new OpenAI({
	apiKey: OPENAI_SECRET_KEY,
});

module.exports = {
	id: "recap4",

	async execute(interaction) {
		var message = await interaction.channel.messages.fetch(interaction.targetId);
		var lastMessage = message;
		message.react('770876050318032896');

		const openai = new OpenAI(
			new OpenAI({ apiKey: OPENAI_SECRET_KEY })
		);

		var currTime = lastMessage.createdAt;
		currTime.setHours(currTime.getHours() - 4)

		var prompt = `Create a bullet point recap for the following messages keep it to less than 750 characters (including formatting) and summarize as needed to meet this requirement and ignore unimportant information such as random comments or numbers starting with "In the last four hours, ":\n`;
		var messages = await message.channel.messages.fetch({ limit: 100, cache: false, before: lastMessage.id });
		while (messages.at(messages.size - 1).createdAt > currTime) {
			var extraMessages = await message.channel.messages.fetch({ limit: 100, cache: false, before: messages.at(messages.size - 1).id });
			messages = [...messages, ...extraMessages];
		}
		messages.reverse();
		for (let i = 0; i < messages.size; i++) {
			if (messages.at(i).createdAt < currTime) {
				continue;
			}
			const previousMessage = messages.at(i);
			prompt += `${previousMessage.author.username}:\"${previousMessage.content}\"\n`;
			lastMessage = previousMessage;
		}

		// Setting values for the prompt and message to be used in the GPT-3 and GPT-3.5-Turbo
		let GPT35Turbo = async (messagePrompt) => {
            const response = await openai.chat.completions.create({
              model: "gpt-3.5-turbo",
              messages: messagePrompt,
            });
          
            return response.choices[0].message;
          };

        const GPT35TurboMessage = [
            { role: "system", content: prompt },
        ];

		await interaction.reply({ content: 'Working on it! May take awhile depending on how many messages were sent.', ephemeral: true });
		let replyMsg = await GPT35Turbo(GPT35TurboMessage);
		message.channel.send(replyMsg);

		return;
	},
};
