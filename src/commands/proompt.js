const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load Bonsai API key from secrets
let bonsaiKey = null;
try {
    const secrets = require('../../secrets.json');
    bonsaiKey = secrets.bonsai?.api_key;
} catch (e) {
    console.warn('[Proompt] Could not load Bonsai API key from secrets.json');
}

const SYSTEM_PROMPT = `You are a Discord.js v14 command generator. Generate ONLY the JavaScript code for a Discord slash command file.

Requirements:
- Use SlashCommandBuilder from discord.js
- Export an object with 'data' and 'execute' properties
- The execute function receives an 'interaction' parameter
- Use modern Discord.js v14 patterns
- Include appropriate options if the user's request implies parameters
- Keep the code clean and functional
- Do NOT include any explanation, markdown, or comments outside the code
- Output ONLY valid JavaScript code that can be directly saved to a .js file

Example structure:
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Description'),

    async execute(interaction) {
        // Implementation
    },
};`;

/**
 * Generate command code using Anthropic API via Bonsai
 * @param {string} commandName - Name for the command
 * @param {string} userRequest - What the user wants the command to do
 * @returns {Promise<string>} Generated code
 */
async function generateWithClaude(commandName, userRequest) {
    if (!bonsaiKey) {
        throw new Error('Bonsai API key not configured in secrets.json');
    }

    const response = await fetch('https://go.trybons.ai/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bonsaiKey}`,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'anthropic/claude-sonnet-4.5',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: `Generate a Discord.js v14 slash command with:
- Name: "${commandName}"
- Functionality: ${userRequest}

Output only the JavaScript code:`
                }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('[Proompt] Bonsai API error:', response.status, errorText);
        throw new Error(`Bonsai API error ${response.status}: ${errorText}`);
    }

    const message = await response.json();

    // Extract text from response
    const responseText = message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('');

    // Clean up the output - remove any markdown code blocks if present
    let cleanCode = responseText.trim();
    cleanCode = cleanCode.replace(/^```(?:javascript|js)?\n?/i, '');
    cleanCode = cleanCode.replace(/\n?```$/i, '');

    return cleanCode.trim();
}

/**
 * Validate that generated code has required exports
 * @param {string} code - Generated JavaScript code
 * @returns {boolean}
 */
function validateCommand(code) {
    return code.includes('module.exports') &&
           code.includes('data') &&
           code.includes('execute') &&
           code.includes('SlashCommandBuilder');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('proompt')
        .setDescription('Generate a new command using AI')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name for the new command (lowercase, no spaces)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('request')
                .setDescription('Describe what you want the command to do')
                .setRequired(true)),

    async execute(interaction) {
        const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9]/g, '');
        const request = interaction.options.getString('request');

        if (!name) {
            return interaction.reply({ content: 'Invalid command name. Use only letters and numbers.', ephemeral: true });
        }

        if (name.length > 32) {
            return interaction.reply({ content: 'Command name must be 32 characters or less.', ephemeral: true });
        }

        if (!bonsaiKey) {
            return interaction.reply({ content: 'AI generation is not configured. Missing Bonsai API key.', ephemeral: true });
        }

        const generatedPath = path.join(__dirname, 'generated');

        // Ensure generated folder exists
        if (!fs.existsSync(generatedPath)) {
            fs.mkdirSync(generatedPath, { recursive: true });
        }

        const filePath = path.join(generatedPath, `${name}.js`);

        // Check if command already exists
        if (fs.existsSync(filePath)) {
            return interaction.reply({ content: `Command \`/${name}\` already exists!`, ephemeral: true });
        }

        await interaction.deferReply();

        try {
            await interaction.editReply(`Generating \`/${name}\` command...`);

            const generatedCode = await generateWithClaude(name, request);

            // Validate the generated code
            if (!validateCommand(generatedCode)) {
                await interaction.editReply({
                    content: `Failed to generate valid command code. The AI output didn't match the expected format. Please try again with a clearer description.`
                });
                return;
            }

            // Write the command file
            fs.writeFileSync(filePath, generatedCode);

            await interaction.editReply({
                content: `Created command \`/${name}\`\n\n**Request:** ${request}\n\nThe command will be available in a few seconds after hot reload registers it.`
            });

        } catch (error) {
            console.error('[Proompt] Generation failed:', error);
            await interaction.editReply({
                content: `Failed to generate command: ${error.message}`
            });
        }
    },
};
