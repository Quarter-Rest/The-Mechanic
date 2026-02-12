const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('proompt')
        .setDescription('Generate a new command from a prompt')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name for the new command (lowercase, no spaces)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('description')
                .setDescription('What the command should do')
                .setRequired(true)),

    async execute(interaction) {
        const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9]/g, '');
        const description = interaction.options.getString('description');

        if (!name) {
            return interaction.reply({ content: 'Invalid command name. Use only letters and numbers.', ephemeral: true });
        }

        const generatedPath = path.join(__dirname, 'generated');

        // Ensure generated folder exists
        if (!fs.existsSync(generatedPath)) {
            fs.mkdirSync(generatedPath, { recursive: true });
        }

        const filePath = path.join(generatedPath, `${name}.js`);

        // Check if command already exists
        if (fs.existsSync(filePath)) {
            return interaction.reply({ content: `Command \`${name}\` already exists!`, ephemeral: true });
        }

        // Generate the command file
        const commandCode = `const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('${name}')
        .setDescription('${description.replace(/'/g, "\\'")}'),

    async execute(interaction) {
        await interaction.reply('I am the **${name}** command. My purpose: ${description.replace(/'/g, "\\'")}');
    },
};
`;

        try {
            fs.writeFileSync(filePath, commandCode);
            await interaction.reply(`Created command \`/${name}\` - it will be available in a few seconds after hot reload registers it.`);
        } catch (error) {
            console.error('[Proompt] Failed to create command:', error);
            await interaction.reply({ content: `Failed to create command: ${error.message}`, ephemeral: true });
        }
    },
};
