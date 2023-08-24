// I'm not gonna bother making the vote commands work together because I don't really understand javascript - griffon

const { MessageEmbed, Collection } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { MessageActionRow, MessageSelectMenu } = require('discord.js');
const { EmbedBuilder } = require('discord.js');

const nsfw = Nsfw();

module.exports = {
	// The only part that makes this different from a default command.
	data: new SlashCommandBuilder()
		.setName("randomnsfw")
		.setDescription(
			"Get random nsfw."
		),

	async execute(interaction, args) {
		run(interaction, args);
	}
};

async function run(interaction, args) {

    var title = "";
    var imageURL = 'https://i.imgur.com/AfFp7pu.png';

    const message = nsfw.ass();
    console.log(message)
    return;

	// finished doing checks
	const exampleEmbed = new MessageEmbed()
	.setColor(0x0099FF)
	.setTitle(title)
	.addFields(
		{ name: 'Squirt', value: '💦', inline: true },
		{ name: 'Bad', value: '❌', inline: true },
	)
    .setImage('https://i.imgur.com/AfFp7pu.png')
	.setTimestamp()

	const replied = await interaction.reply({ embeds: [exampleEmbed], fetchReply: true });
}


const axios = require('axios');


class Nsfw {
  constructor() {
    this.baseUrl =`https://nekobot.xyz/api`
  }

  async anal() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=anal`
    );
    const message = await data.message;
    return message;
  }

  async fourk() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=4k`
    );
    const message = await data.message;
    return message;
  }

  async ass() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=ass`
    );
    const message = await data.message;
    return message;
  }

  async gonewild() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=gonewild`
    );
    const message = await data.message;
    return message;
  }

  async pgif() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=pgif`
    );
    const message = await data.message;
    return message;
  }

  async pussy() {
    const { data }  = await axios.get(
      `${this.baseUrl}/image?type=pussy`
    );
    const message = await data.message;
     return message;

  }

  async thigh() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=thigh`
    );
    const message = await data.message;
    return message;
  }

  async boobs() {
    const { data } = await axios.get(
        `${this.baseUrl}/image?type=boobs`
      );
      const message = await data.message;
      return message;
  }

  async hentaiass() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=hass`
    );
    const message = await data.message;
    return message;
  }

  async hentai() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=hentai`
    );
    const message = await data.message;
    return message;
  }

  async hmidriff() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=hmidriff`
    );
    const message = await data.message;
    return message;
  }

  async hentaithigh() {
    const { data } = await axios.get(
      `${this.baseUrl}/image?type=hthigh`
    );
    const message = await data.message;
    return message;
  }

  

}
