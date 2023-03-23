const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { OPENAI_SECRET_KEY } = require("../../../config.json");
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: OPENAI_SECRET_KEY,
});
const openai = new OpenAIApi(configuration);
// Specifically for button interactions.
const { MessageButton } = require('discord.js');

module.exports = {
  // The only part that makes this different from a default command.
  data: new SlashCommandBuilder()
    .setName("recap")
    .setDescription(
      "Get a Quarter Rest Regular Recap Report."
    ),

  async execute(interaction, args) {
    const message = interaction.options.getString('message');
    const prompt = `Please provide a recap for the following message: "${message}"`;

    (async () => {
      const gptResponse = await openai.createCompletion({
        model: "gpt-3.5-turbo",
        prompt: prompt,
        temperature: 0.6,
        max_tokens: 4096,
      });

      interaction.reply(`${gptResponse.data.choices[0].text}`);
    })();
  },
};
