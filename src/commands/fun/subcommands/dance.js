const { randomInt } = require('node:crypto');
const { MessageFlags, SlashCommandSubcommandBuilder } = require('discord.js');
const danceSongs = require('./dance-songs.json');

const maxSongLinkLength = 1800;
const musicVideoIds = Object.values(danceSongs).flatMap(songs => songs.map(song => song.videoId));

const danceMoves = [
    'is dancing to',
    'is shaking their butt to',
    'is raising the roof to',
    'is busting a move to',
    'is moonwalking to',
    'is doing the worm to',
    'is throwing it back to',
    'is cutting a rug to',
    'is doing the robot to',
    'is two-stepping to',
    'is shuffling to',
    'is playing air guitar to',
    'is dancing like nobody’s watching to',
    'is having a dance battle with their own shadow to',
    'is dropping it low to',
    'is doing the sprinkler to',
    'is doing the running man to',
    'is giving their kitchen a full halftime show to',
    'is doing the cha-cha to',
    'is doing a little shoulder shimmy to',
];

function parseSongLink(input) {
    const link = input.trim().replace(/^<(.*)>$/, '$1');
    if (!/^https?:\/\/[^\s<>]+$/i.test(link)) return null;

    try {
        const url = new URL(link);
        if (url.hostname === 'music.youtube.com' && url.pathname === '/watch') {
            url.protocol = 'https:';
            url.hostname = 'www.youtube.com';
        }
        if (url.username || url.password || url.href.length > maxSongLinkLength) return null;
        return url.href;
    } catch {
        return null;
    }
}

function getDanceLine(songLink) {
    const link = songLink === null
        ? `https://www.youtube.com/watch?v=${musicVideoIds[randomInt(musicVideoIds.length)]}`
        : parseSongLink(songLink);
    if (!link) return null;

    return `${danceMoves[randomInt(danceMoves.length)]} <${link}>`;
}

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName('dance')
        .setDescription('Dance to a song')
        .addStringOption(option => option
            .setName('song')
            .setDescription('Song link. Leave blank for a random YouTube song.')
            .setMaxLength(maxSongLinkLength)),

    async execute(interaction) {
        const line = getDanceLine(interaction.options.getString('song'));
        if (!line) {
            return interaction.reply({
                content: 'Enter an HTTP or HTTPS song link, or leave it blank for a random song.',
                flags: MessageFlags.Ephemeral,
            });
        }

        return interaction.reply({
            content: `<@${interaction.user.id}> ${line}`,
            allowedMentions: { parse: [] },
        });
    },
};
