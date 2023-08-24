const { OPENAI_SECRET_KEY } = require("../../../config.json");
const { generate } = require('stability-client')
const fs = require('fs');
const { MessageAttachment, MessageEmbed } = require("discord.js");
const {
	v1: uuidv1,
	v4: uuidv4,
} = require('uuid');

import OpenAI from 'openai';
const configuration = new OpenAI({
	apiKey: OPENAI_SECRET_KEY,
});

module.exports = {
	id: "recap1",

	async execute(interaction) {
		var message = await interaction.channel.messages.fetch(interaction.targetId);
		var lastMessage = message;
		message.react('770876050318032896');

		const openai = new OpenAIApi(
			new OpenAI({ apiKey: OPENAI_SECRET_KEY })
		);

		var currTime = lastMessage.createdAt;
		currTime.setHours(currTime.getHours() - 1)

		var prompt = `Create a bullet point recap for the following messages starting with "In the last hour, ":\n`;
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

		await interaction.reply({ content: 'Working on it! May take awhile depending on how many messages were sent.', ephemeral: true });
		let replyMsg = await GPT35Turbo(GPT35TurboMessage);
		message.channel.send(replyMsg);

		return;
	},
};
