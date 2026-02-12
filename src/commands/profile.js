const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const userProfileStore = require('../services/userProfileStore');

function parseStoredList(value) {
    if (!value || typeof value !== 'string') {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
    } catch {
        return [];
    }
}

function formatDate(value) {
    if (!value) {
        return 'n/a';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'n/a';
    }

    return date.toISOString();
}

function shortText(value, maxLength = 350) {
    if (!value || typeof value !== 'string') {
        return 'n/a';
    }
    return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Moderator tools for user behavior profiles')
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View cached profile details for a user')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to inspect')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset a user profile and cached samples')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to reset')
                        .setRequired(true))),

    async execute(interaction) {
        if (!interaction.guildId) {
            await interaction.reply({ content: 'This command only works in a server.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user', true);

        if (subcommand === 'view') {
            const { profile, counts } = await userProfileStore.getProfileWithSampleCounts(interaction.guildId, targetUser.id);

            if (!profile) {
                await interaction.reply({
                    content: `No profile data exists yet for <@${targetUser.id}> in this server.`,
                    ephemeral: true
                });
                return;
            }

            const doList = parseStoredList(profile.do_list);
            const dontList = parseStoredList(profile.dont_list);

            const embed = new EmbedBuilder()
                .setTitle(`Profile: ${targetUser.tag}`)
                .setDescription(`User ID: ${targetUser.id}`)
                .addFields(
                    {
                        name: 'Counters',
                        value: [
                            `messages_seen: ${profile.messages_seen || 0}`,
                            `mentions_to_bot: ${profile.mentions_to_bot || 0}`,
                            `messages_since_semantic: ${profile.messages_since_semantic || 0}`,
                            `profile_version: ${profile.profile_version || 0}`,
                            `self_samples: ${counts.self || 0}`,
                            `social_samples: ${counts.social || 0}`,
                        ].join('\n')
                    },
                    {
                        name: 'Timestamps',
                        value: [
                            `last_seen_at: ${formatDate(profile.last_seen_at)}`,
                            `last_semantic_at: ${formatDate(profile.last_semantic_at)}`,
                            `updated_at: ${formatDate(profile.updated_at)}`,
                        ].join('\n')
                    },
                    { name: 'Tone', value: shortText(profile.tone_summary), inline: false },
                    { name: 'Personality', value: shortText(profile.personality_summary), inline: false },
                    { name: 'Interests', value: shortText(profile.interests_summary), inline: false },
                    { name: 'Social', value: shortText(profile.social_summary), inline: false },
                    { name: 'Do', value: doList.length ? doList.map(item => `- ${item}`).join('\n') : 'n/a', inline: false },
                    { name: "Don't", value: dontList.length ? dontList.map(item => `- ${item}`).join('\n') : 'n/a', inline: false },
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        if (subcommand === 'reset') {
            const result = await userProfileStore.resetProfile(interaction.guildId, targetUser.id);
            await interaction.reply({
                content: `Reset profile for <@${targetUser.id}>.\nDeleted profile rows: ${result.deletedProfiles}\nDeleted sample rows: ${result.deletedSamples}`,
                ephemeral: true
            });
        }
    },
};
