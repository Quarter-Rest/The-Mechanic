// I'm not gonna bother making the vote commands work together because I don't really understand javascript - griffon

const { MessageEmbed } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const axios = require('axios');

// Import the Astica API
const { asticaAPI_start, asticaVision } = require('astica.api.js');
const { astica_key } = require("./config.json");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("randomnsfw")
    .setDescription("Get random nsfw."),
  
  async execute(interaction, args) {
    run(interaction, args);
  }
};

async function run(interaction, args) {
  if (interaction.channel.test == false) return;
  const nsfw = new Nsfw()
  const data = await nsfw.random();
  var title = data[1];
  var imageURL = data[0];

  // Initialize the Astica API with your API key
  asticaAPI_start(astica_key);

  // Example 1: Simple computer vision
  const result = await asticaVision(imageURL, 'Description,Faces,Objects');
  
  // Example 2: Computer vision with options
  // const result = await asticaVision('Image URL', 'Description,Faces,Objects');

  // Example 3: Advanced, simple
  // const result = await asticaVision('https://astica.ai/example/asticaVision_sample.jpg');

  // Example 4: Advanced with parameters
  // const result = await asticaVision(
  //   '1.0_full', //modelVersion: 1.0_full, 2.0_full
  //   'IMAGE URL or Base64', //Input Image
  //   'Description,Moderate,Faces', //or 'all'
  // );

  // Handle the Astica API response
  if (typeof result.error !== 'undefined') {
    await interaction.reply(`Error: ${result.error}`);
  } else {

    const exampleEmbed = new MessageEmbed()
      .setColor(0x0099FF)
      .setTitle(title)
      .setImage(imageURL)
      .setDescription(result)
      .setTimestamp();

    await interaction.reply({ embeds: [exampleEmbed] });
  }
}



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
    
    async random() {
        const functions = [
          this.anal,
          this.fourk,
          this.ass,
          this.gonewild,
          this.pgif,
          this.pussy,
          this.thigh,
          this.boobs,
          this.hentaiass,
          this.hentai,
          this.hmidriff,
          this.hentaithigh
        ];
    
        const randomFunction = functions[Math.floor(Math.random() * functions.length)];
        const message = await randomFunction.call(this);
        return [message, randomFunction.name];
      }
  }

