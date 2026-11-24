const fs = require('node:fs');
const path = require('node:path');
const { MessageFlags, SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('fun')
    .setDescription('Play Fun');
const subcommands = new Map();
const subcommandsPath = path.join(__dirname, 'subcommands');
const entries = fs.readdirSync(subcommandsPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;

    const subcommand = require(path.join(subcommandsPath, entry.name));
    const name = subcommand.data?.name;
    if (!name || typeof subcommand.execute !== 'function' || subcommands.has(name)) {
        throw new Error(`Invalid or duplicate Fun subcommand in ${entry.name}`);
    }

    data.addSubcommand(subcommand.data);
    subcommands.set(name, subcommand);
}

data.toJSON();

module.exports = {
    data,

    async execute(interaction) {
        const subcommand = subcommands.get(interaction.options.getSubcommand(false));
        if (!subcommand) {
            return interaction.reply({
                content: 'That Fun command is unavailable right now.',
                flags: MessageFlags.Ephemeral,
            });
        }

        return subcommand.execute(interaction);
    },
};
