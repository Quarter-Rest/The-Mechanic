const { setTimeout: delay } = require('node:timers/promises');
const {
    MessageFlags,
    PermissionFlagsBits,
    RESTJSONErrorCodes,
    Routes,
    SlashCommandBuilder,
} = require('discord.js');
const writeExcelFile = require('write-excel-file/node').default;

const pageSize = 100;
const searchPageSize = 25;
const maxIndexRetrySeconds = 5;
const interactionLifetime = 15 * 60 * 1000;
const defaultAttachmentLimit = 20 * 1024 * 1024;
const maxSheetRows = 1_048_576;
const expiredInteractionCodes = new Set([
    RESTJSONErrorCodes.UnknownInteraction,
    RESTJSONErrorCodes.UnknownWebhook,
    RESTJSONErrorCodes.InvalidWebhookToken,
]);

const resultsColumns = [
    ['Question', 56], ['Answer', 38], ['Votes exported', 16], ['Discord final votes', 21],
    ['Status', 12], ['Multiple answers', 19], ['Posted (UTC)', 23], ['Closes (UTC)', 23],
    ['Poll message ID', 23], ['Answer ID', 12], ['Poll message URL', 72],
];
const voterColumns = [
    ['Question', 56], ['Answer', 38], ['Username', 33], ['Display name', 33],
    ['Voter ID', 23], ['Poll message ID', 23], ['Answer ID', 12],
];

function makeSheet(sheet, columns, rows) {
    const header = columns.map(([value]) => ({
        value,
        fontWeight: 'bold',
        color: '#FFFFFF',
        backgroundColor: '#243B53',
    }));

    return {
        sheet,
        data: [header, ...rows],
        columns: columns.map(([, width]) => ({ width })),
        stickyRowsCount: 1,
    };
}

async function* fetchPollHistory(channel, before) {
    while (true) {
        const messages = await channel.messages.fetch({ before, limit: pageSize, cache: false });

        for (const message of messages.values()) {
            if (message.poll) yield message;
        }

        if (messages.size < pageSize) return;
        before = messages.lastKey();
    }
}

async function searchPollPage(channel, before) {
    const route = Routes.guildMessagesSearch(channel.guildId);
    const query = new URLSearchParams({
        channel_id: channel.id,
        has: 'poll',
        max_id: before,
        limit: searchPageSize,
        sort_by: 'timestamp',
        sort_order: 'desc',
        include_nsfw: 'true',
    });

    try {
        const page = await channel.client.rest.get(route, { query });
        if (page.code === RESTJSONErrorCodes.IndexNotYetAvailable && page.retry_after <= maxIndexRetrySeconds) {
            await delay(Math.max(0.25, page.retry_after) * 1000);
            return await channel.client.rest.get(route, { query });
        }
        return page;
    } catch (error) {
        if (error.status === 403 || error.status === 404) return null;
        throw error;
    }
}

async function* fetchPollMessages(channel, before) {
    // Read the newest page directly so newly posted polls can be found before indexing.
    const recent = await channel.messages.fetch({ before, limit: pageSize, cache: false });
    for (const message of recent.values()) {
        if (message.poll) yield message;
    }
    if (recent.size < pageSize) return;
    before = recent.lastKey();

    while (true) {
        const page = await searchPollPage(channel, before);
        if (!page?.messages || page.doing_deep_historical_index) break;

        const ids = new Set(page.messages.flat()
            .filter(message => message.channel_id === channel.id && BigInt(message.id) < BigInt(before))
            .map(message => message.id));

        // Discord can return a short page while matches remain in the index.
        if (ids.size < Math.min(searchPageSize, page.total_results)) break;
        if (ids.size === 0) return;

        for (const id of ids) {
            if (BigInt(id) < BigInt(before)) before = id;
            try {
                const message = await channel.messages.fetch({ message: id, force: true, cache: false });
                if (message.poll) yield message;
            } catch (error) {
                if (error.code !== RESTJSONErrorCodes.UnknownMessage) throw error;
            }
        }
    }

    yield* fetchPollHistory(channel, before);
}

async function* fetchVoters(answer) {
    let after;
    while (true) {
        const voters = await answer.voters.fetch({ after, limit: pageSize });

        for (const voter of voters.values()) yield voter;

        if (voters.size < pageSize) return;
        after = voters.reduce((latestId, voter) => (
            BigInt(voter.id) > BigInt(latestId) ? voter.id : latestId
        ), '0');
    }
}

async function collectPolls(channel, before) {
    const results = [];
    const votes = [];
    let pollCount = 0;

    for await (const message of fetchPollMessages(channel, before)) {
        const poll = message.poll;
        const question = { value: poll.question.text || '', wrap: true };
        const closesAt = poll.expiresAt;
        const closed = poll.resultsFinalized || (closesAt && closesAt <= new Date());
        pollCount++;

        for (const answer of poll.answers.values()) {
            const emoji = answer.emoji?.toString();
            const selection = { value: [emoji, answer.text].filter(Boolean).join(' '), wrap: true };
            const previousVoteCount = votes.length;

            for await (const voter of fetchVoters(answer)) {
                votes.push([question, selection, voter.username, voter.displayName, voter.id, message.id, answer.id]);
            }

            results.push([
                question, selection, votes.length - previousVoteCount,
                poll.resultsFinalized ? answer.voteCount : null,
                closed ? 'Closed' : 'Open', poll.allowMultiselect,
                message.createdAt, closesAt, message.id, answer.id, message.url,
            ]);
        }
    }

    return { results, votes, pollCount };
}

async function buildAttachments(sheets, basename, sizeLimit) {
    if (sheets.every(sheet => sheet.data.length <= maxSheetRows)) {
        const attachment = await writeExcelFile(sheets).toBuffer();
        if (attachment.length <= sizeLimit) return [{ attachment, name: `${basename}.xlsx` }];
    }

    const files = [];
    for (const sheet of sheets) {
        let batchSize = maxSheetRows - 1;
        let part = 1;
        let offset = 1;
        do {
            const data = [sheet.data[0], ...sheet.data.slice(offset, offset + batchSize)];
            const attachment = await writeExcelFile([{ ...sheet, data }]).toBuffer();
            if (attachment.length > sizeLimit) {
                if (data.length <= 2) throw new Error('A poll export row exceeds Discord’s attachment size limit.');
                batchSize = Math.floor((data.length - 1) / 2);
                continue;
            }

            files.push({ attachment, name: `${basename}-${sheet.sheet.toLowerCase()}-${part}.xlsx` });
            part++;
            offset += data.length - 1;
        } while (offset < sheet.data.length);
    }

    return files;
}

async function deliverPrivately(interaction, reply, followUp = false) {
    if (Date.now() - interaction.createdTimestamp < interactionLifetime) {
        try {
            if (followUp) {
                await interaction.followUp({ ...reply, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.editReply(reply);
            }
            return;
        } catch (error) {
            if (!expiredInteractionCodes.has(error.code)) throw error;
        }
    }

    await interaction.user.send(reply);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pullpolls')
        .setDescription('Export this channel’s Discord polls and who voted for each answer')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.inGuild() || !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: 'Only server administrators can export polls.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);
            if (!channel?.messages) {
                await interaction.editReply('Run this command in a channel or thread with message history.');
                return;
            }

            if (!interaction.appPermissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) {
                await interaction.editReply('I need View Channel and Read Message History permissions to export polls here.');
                return;
            }

            const { results, votes, pollCount } = await collectPolls(channel, interaction.id);
            if (pollCount === 0) {
                await deliverPrivately(interaction, { content: 'No Discord polls were found in this channel.' });
                return;
            }

            const sizeLimit = Math.min(interaction.attachmentSizeLimit ?? defaultAttachmentLimit, defaultAttachmentLimit);
            const files = await buildAttachments([
                { ...makeSheet('Results', resultsColumns, results), dateFormat: 'yyyy-mm-dd hh:mm:ss' },
                makeSheet('Voters', voterColumns, votes),
            ], `polls-${channel.id}`, sizeLimit);

            const summary = `Exported ${pollCount} ${pollCount === 1 ? 'poll' : 'polls'} from <#${channel.id}>. `;
            for (const [index, file] of files.entries()) {
                const content = (index === 0 ? summary : '') + (files.length > 1 ? `File ${index + 1} of ${files.length}.` : '');
                await deliverPrivately(interaction, { content: content.trim(), files: [file] }, index > 0);
            }
        } catch (error) {
            console.error('[PullPolls] Export failed:', error.code ?? error.message);
            try {
                await deliverPrivately(interaction, { content: 'The poll export failed. Please try again.' });
            } catch (replyError) {
                console.error('[PullPolls] Failed to notify administrator:', replyError.code ?? replyError.message);
            }
        }
    },
};
