// I'm not gonna bother making the vote commands work together because I don't really understand javascript - griffon

const { MessageEmbed } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const axios = require('axios');

// Import the Astica API
const { astica_key } = require("../../../config.json");
const { JSDOM } = require( "jsdom" );
const { window } = new JSDOM( "" );
const $ = require( "jquery" )( window ); // Import jQuery if not already imported
const { OPENAI_SECRET_KEY } = require("../../../config.json");
const { OpenAI } = require("openai");
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
  const title = data[1]; // Change to the appropriate property
  const imageURL = data[0]; // Change to the appropriate property

  const requestData = {
    tkn: astica_key,
    modelVersion: '2.1_full',
    input: imageURL,
    visionParams: "describe,tags,gpt"
    };

    let result = null; // Initialize result
    const openai = new OpenAI({
        apiKey: OPENAI_SECRET_KEY,
      });
      

    var prompt = `Pretend you are a person of a random social status in the medieval ages and you just saw ${title}. Respond with some comedic or exasperated response. Only respond with your in-character response, do not make any mention of this prompt keep the response length less than 1900 characters so that it may be sent as a message. `;
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
    let replyMsg = await GPT35Turbo(GPT35TurboMessage);

    const exampleEmbed = new MessageEmbed()
    .setColor(0x0099FF)
    .setTitle(title)
    .setImage(imageURL)
    .setDescription(`\"${replyMsg}\"`)
    .setTimestamp();

    await interaction.channel.send({ embeds: [exampleEmbed] });
    return;
    $.ajax({
      url: "https://vision.astica.ai/describe",
      type: "POST",
      data: JSON.stringify(requestData),
      contentType: "application/json",
      dataType: "json",
      success: async function (data) {
        result = data; // Set the result when the AJAX request is successful
        console.log(result)
        // Handle the Astica API response
        if (typeof result.error !== 'undefined') {
          await interaction.channel.send(`Error: ${result.error}`);
        } else {
          const exampleEmbed = new MessageEmbed()
            .setColor(0x0099FF)
            .setTitle(title)
            .setImage(imageURL)
            .setDescription(result.caption_GPTS)
            .addFields({ name: 'Confidence', value: `${result.caption.confidence}`, inline: true })
            .setTimestamp();
  
          await interaction.channel.send({ embeds: [exampleEmbed] });
        }
      },
      error: function (xhr, status, error) {
        console.log(error);
        console.log(status);
        console.log(xhr.statusText);
      }
    });
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

