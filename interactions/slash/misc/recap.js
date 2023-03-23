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
    )
    .addStringOption(option =>
        option.setName('date')
          .setDescription('The date to use')
          .setRequired(true)
      ),

  async execute(interaction, args) {
    const dateString = interaction.options.getString('date');
    const date = new Date(dateString);
    console.log(`The date you entered is: ${date}`);
    var messages = fetchMessages(null, interaction.channelId, dateString);
    console.log(messages[0]);
    return
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

async function fetchMessages(ctx, fromChannelId, fromDate) {
    const channel = client.channels.cache.get(fromChannelId);
    const date = new Date(fromDate);
    const messages = await channel.messages.fetch({ limit: 200, after: date });
    const messagesArray = messages.array(); // Convert the messages Collection to an array
    return messagesArray;
  };