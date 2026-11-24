const { randomInt } = require('node:crypto');

const maxSongLinkLength = 1800;

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

const musicVideoIds = [
    'FGBhQbmPwH8', // Daft Punk - One More Time
    'eH3giaIzONA', // Whitney Houston - I Wanna Dance with Somebody
    'Gs069dndIYk', // Earth, Wind & Fire - September
    'xFrGuyw1V8s', // ABBA - Dancing Queen
    'uAOR6ib95kQ', // Gorillaz - DARE
    'hAx6mYeC6pY', // Sophie Ellis-Bextor - Murder on the Dancefloor
    '4JkIs37a2JE', // Jamiroquai - Virtual Insanity
    'UqyT8IEBkvY', // Bruno Mars - 24K Magic
    'PWgvGjAhvIw', // Outkast - Hey Ya!
    'wZv62ShoStY', // Mr C The Slide Man - Cha-Cha Slide
    'c18441Eh_WE', // Kylie Minogue - Can't Get You Out of My Head
    'fWNaR-rxAic', // Carly Rae Jepsen - Call Me Maybe
    'ZbZSe6N_BXs', // Pharrell Williams - Happy
    '5NV6Rdv1a3I', // Daft Punk - Get Lucky
    'IXXxciRUMzE', // Lizzo - About Damn Time
    'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up
];

function parseSongLink(input) {
    const link = input.trim().replace(/^<(.*)>$/, '$1');
    if (!/^https?:\/\/[^\s<>]+$/i.test(link)) return null;

    try {
        const url = new URL(link);
        if (url.username || url.password || url.href.length > maxSongLinkLength) return null;
        return url.href;
    } catch {
        return null;
    }
}

function getDanceLine(songLink) {
    const link = songLink === null
        ? `https://music.youtube.com/watch?v=${musicVideoIds[randomInt(musicVideoIds.length)]}`
        : parseSongLink(songLink);
    if (!link) return null;

    return `${danceMoves[randomInt(danceMoves.length)]} <${link}>`;
}

module.exports = { getDanceLine, maxSongLinkLength };
