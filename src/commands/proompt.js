const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load OpenRouter API key from secrets
let openrouterKey = null;
try {
    const secrets = require('../../secrets.json');
    openrouterKey = secrets.openrouter?.api_key;
} catch (e) {
    console.warn('[Proompt] Could not load OpenRouter API key from secrets.json');
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
 * Generate command code using OpenRouter API
 * @param {string} commandName - Name for the command
 * @param {string} userRequest - What the user wants the command to do
 * @returns {Promise<string>} Generated code
 */
async function generateWithAI(commandName, userRequest) {
    if (!openrouterKey) {
        throw new Error('OpenRouter API key not configured in secrets.json');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openrouterKey}`
        },
        body: JSON.stringify({
            model: 'openai/gpt-oss-120b:free',
            max_tokens: 4096,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                {
                    role: 'user',
                    content: `Generate a Discord.js v14 slash command with:\n- Name: "${commandName}"\n- Functionality: ${userRequest}\n\nOutput only the JavaScript code:`
                }
            ]
        })
    });

    const responseText = await response.text();

    if (!response.ok) {
        console.error('[Proompt] OpenRouter API error:', response.status, responseText);
        throw new Error(`OpenRouter API error ${response.status}: ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const output = data.choices?.[0]?.message?.content;

    if (!output) {
        throw new Error('AI returned an empty response');
    }

    // Clean up the output - remove any markdown code blocks if present
    let cleanCode = output.trim();
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

        if (!openrouterKey) {
            return interaction.reply({ content: 'AI generation is not configured. Missing OpenRouter API key.', ephemeral: true });
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

            const generatedCode = await generateWithAI(name, request);

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
