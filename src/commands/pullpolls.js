const { setTimeout: delay } = require('node:timers/promises');
const {
    MessageFlags,
    PermissionFlagsBits,
    RESTJSONErrorCodes,
    Routes,
    SlashCommandBuilder,
    SnowflakeUtil,
} = require('discord.js');
const writeExcelFile = require('write-excel-file/node').default;

const pageSize = 100;
const searchPageSize = 25;
// Discord began rolling out native polls on this day: https://github.com/discord/discord-api-docs/pull/6746
const pollRolloutDate = '2024-03-21';
const firstPollMessageId = SnowflakeUtil.generate({
    timestamp: Date.parse(`${pollRolloutDate}T00:00:00Z`),
    workerId: 0n,
    processId: 0n,
    increment: 0n,
});
const searchMinId = (firstPollMessageId - 1n).toString();
const maxIndexRetrySeconds = 5;
const progressInterval = 15_000;
const interactionLifetime = 15 * 60 * 1000;
const defaultAttachmentLimit = 20 * 1024 * 1024;
const maxSheetRows = 1_048_576;
// Store the active export on the client so command reloads keep the same guard.
const activeExport = Symbol.for('the-mechanic.pullpolls.activeExport');
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

function trackWork(activity, total) {
    const startedAt = performance.now();
    let lastCompletedAt = startedAt;
    let completed = 0;

    return {
        setRemaining(remaining) {
            total = completed + remaining;
        },
        advance() {
            completed++;
            lastCompletedAt = performance.now();
        },
        estimate() {
            if (!completed || !Number.isFinite(total) || completed >= total) return null;
            const averageMs = (lastCompletedAt - startedAt) / completed;
            const remainingMs = averageMs * (total - completed);
            const minutes = Math.round(remainingMs / 60_000);
            let duration = 'under a minute';
            if (minutes === 1) duration = 'about a minute';
            if (minutes > 1) duration = `about ${minutes} minutes`;
            return `Estimated time ${activity} is ${duration}.`;
        },
    };
}

function startProgress(interaction) {
    const prefix = `[PullPolls ${interaction.id}]`;
    const startedAt = performance.now();
    const elapsedSeconds = since => Math.floor((performance.now() - since) / 1000);
    let step = 'Acknowledging the request';
    let stepStartedAt = startedAt;
    const counts = { messages: 0, searchPages: 0, polls: 0, answers: 0, votes: 0 };

    function log(message) {
        console.log(`${prefix} ${message} (${elapsedSeconds(startedAt)}s elapsed)`);
    }

    log(`Started export for channel ${interaction.channelId}`);
    const timer = setInterval(() => {
        log(`Still running. ${step} (${elapsedSeconds(stepStartedAt)}s on this step). ` +
            `${counts.messages} history messages read, ${counts.searchPages} search pages read, ` +
            `${counts.polls} polls found, ${counts.answers} answers fetched, ${counts.votes} votes read.`);
    }, progressInterval);
    timer.unref();

    return {
        counts,
        log,
        setStep(nextStep) {
            step = nextStep;
            stepStartedAt = performance.now();
        },
        busyMessage() {
            const estimate = this.work?.estimate() ?? this.currentPoll?.estimate() ??
                'There’s no reliable time estimate yet.';
            const pollCount = counts.polls === 1 ? '1 poll' : `${counts.polls} polls`;
            return `A /pullpolls export is already in progress. ${step}. ` +
                `${pollCount} found so far (${elapsedSeconds(startedAt)}s elapsed). ${estimate}`;
        },
        error(message, error) {
            console.error(`${prefix} ${message} (${step}, ${elapsedSeconds(startedAt)}s elapsed)`, error.code ?? error.name);
        },
        stop() {
            clearInterval(timer);
        },
    };
}

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

async function readPollHistoryPage(channel, before, progress) {
    const messages = await channel.messages.fetch({ before, limit: pageSize, cache: false });
    progress.counts.messages += messages.size;
    const oldestId = messages.lastKey();
    const reachedRolloutDate = oldestId !== undefined && BigInt(oldestId) <= firstPollMessageId;
    if (reachedRolloutDate) progress.log(`Reached the poll rollout cutoff of ${pollRolloutDate} UTC`);

    return {
        polls: messages.filter(message => message.poll && BigInt(message.id) >= firstPollMessageId),
        nextBefore: !reachedRolloutDate && messages.size === pageSize ? oldestId : undefined,
    };
}

async function* fetchPollHistory(channel, before, progress) {
    while (before) {
        progress.setStep('Fetching a channel history page');
        const page = await readPollHistoryPage(channel, before, progress);
        yield* page.polls.values();
        before = page.nextBefore;
    }
}

async function searchPollPage(channel, before) {
    const route = Routes.guildMessagesSearch(channel.guildId);
    const query = new URLSearchParams({
        channel_id: channel.id,
        has: 'poll',
        max_id: before,
        min_id: searchMinId,
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

async function* fetchPollMessages(channel, before, progress) {
    // Read the newest page directly so newly posted polls can be found before indexing.
    progress.setStep('Fetching the newest messages');
    const recent = await readPollHistoryPage(channel, before, progress);
    if (!recent.nextBefore) progress.work = trackWork('to finish collecting polls', recent.polls.size);
    for (const message of recent.polls.values()) {
        yield message;
        progress.work?.advance();
    }
    before = recent.nextBefore;
    if (!before) return;

    progress.log('Searching Discord’s index for older polls');
    progress.work = trackWork('to finish collecting polls');
    while (true) {
        progress.setStep('Searching Discord’s poll index');
        const page = await searchPollPage(channel, before);
        if (!page?.messages || page.doing_deep_historical_index) {
            progress.log('Discord search is unavailable or still indexing. Scanning channel history.');
            break;
        }
        progress.counts.searchPages++;

        const beforeId = BigInt(before);
        const ids = new Set(page.messages.flat()
            .filter(message => message.channel_id === channel.id &&
                BigInt(message.id) >= firstPollMessageId && BigInt(message.id) < beforeId)
            .map(message => message.id));

        // Discord can return a short page while matches remain in the index.
        if (ids.size < Math.min(searchPageSize, page.total_results)) {
            progress.log('Discord search returned an incomplete page. Scanning channel history.');
            break;
        }
        if (ids.size === 0) return;

        progress.work.setRemaining(Math.max(ids.size, page.total_results));
        for (const id of ids) {
            if (BigInt(id) < BigInt(before)) before = id;
            progress.setStep('Fetching an indexed poll message');
            try {
                const message = await channel.messages.fetch({ message: id, force: true, cache: false });
                if (message.poll) yield message;
            } catch (error) {
                if (error.code !== RESTJSONErrorCodes.UnknownMessage) throw error;
            }
            progress.work.advance();
        }

        if (BigInt(before) === firstPollMessageId) {
            progress.log(`Reached the poll rollout cutoff of ${pollRolloutDate} UTC`);
            return;
        }
    }

    progress.work = undefined;
    yield* fetchPollHistory(channel, before, progress);
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

async function collectPolls(channel, before, progress) {
    const results = [];
    const votes = [];
    let pollCount = 0;

    for await (const message of fetchPollMessages(channel, before, progress)) {
        const poll = message.poll;
        const question = { value: poll.question.text || '', wrap: true };
        const closesAt = poll.expiresAt;
        const closed = poll.resultsFinalized || (closesAt && closesAt <= new Date());
        pollCount++;
        progress.counts.polls = pollCount;
        progress.currentPoll = trackWork('to finish fetching voters for the current poll', poll.answers.size);

        for (const answer of poll.answers.values()) {
            const emoji = answer.emoji?.toString();
            const selection = { value: [emoji, answer.text].filter(Boolean).join(' '), wrap: true };
            const previousVoteCount = votes.length;

            progress.setStep(`Fetching voters for poll ${pollCount}, answer ${answer.id}`);
            for await (const voter of fetchVoters(answer)) {
                votes.push([question, selection, voter.username, voter.displayName, voter.id, message.id, answer.id]);
                progress.counts.votes = votes.length;
            }

            results.push([
                question, selection, votes.length - previousVoteCount,
                poll.resultsFinalized ? answer.voteCount : null,
                closed ? 'Closed' : 'Open', poll.allowMultiselect,
                message.createdAt, closesAt, message.id, answer.id, message.url,
            ]);
            progress.counts.answers = results.length;
            progress.currentPoll.advance();
        }
        progress.currentPoll = undefined;
    }

    progress.work = undefined;
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

        const client = interaction.client;
        const runningExport = client[activeExport];
        if (runningExport) {
            await interaction.reply({ content: runningExport.busyMessage(), flags: MessageFlags.Ephemeral });
            return;
        }

        const progress = startProgress(interaction);
        client[activeExport] = progress;

        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            progress.setStep('Resolving the channel');
            const channel = interaction.channel ?? await client.channels.fetch(interaction.channelId);
            if (!channel?.messages) {
                await interaction.editReply('Run this command in a channel or thread with message history.');
                progress.log('Stopped because this channel has no message history');
                return;
            }

            if (!interaction.appPermissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])) {
                await interaction.editReply('I need View Channel and Read Message History permissions to export polls here.');
                progress.log('Stopped because the bot lacks access to channel history');
                return;
            }

            const { results, votes, pollCount } = await collectPolls(channel, interaction.id, progress);
            if (pollCount === 0) {
                progress.setStep('Reporting that no polls were found');
                await deliverPrivately(interaction, { content: 'No Discord polls were found in this channel.' });
                progress.log('Finished. No Discord polls found');
                return;
            }

            progress.setStep('Building the workbook');
            progress.log(`Building workbook for ${pollCount} poll(s), ${results.length} answer(s), and ${votes.length} vote(s)`);
            const sizeLimit = Math.min(interaction.attachmentSizeLimit ?? defaultAttachmentLimit, defaultAttachmentLimit);
            const files = await buildAttachments([
                { ...makeSheet('Results', resultsColumns, results), dateFormat: 'yyyy-mm-dd hh:mm:ss' },
                makeSheet('Voters', voterColumns, votes),
            ], `polls-${channel.id}`, sizeLimit);

            progress.log(`Workbook ready. Delivering ${files.length} attachment(s) privately`);
            const summary = `Exported ${pollCount} ${pollCount === 1 ? 'poll' : 'polls'} from <#${channel.id}>. `;
            progress.work = trackWork('to finish delivering the export', files.length);
            for (const [index, file] of files.entries()) {
                progress.setStep(`Delivering attachment ${index + 1} of ${files.length}`);
                const content = (index === 0 ? summary : '') + (files.length > 1 ? `File ${index + 1} of ${files.length}.` : '');
                await deliverPrivately(interaction, { content: content.trim(), files: [file] }, index > 0);
                progress.work.advance();
            }
            progress.log(`Finished. Delivered ${files.length} attachment(s)`);
        } catch (error) {
            if (!interaction.deferred) throw error;
            progress.error('Export failed', error);
            progress.work = undefined;
            progress.currentPoll = undefined;
            progress.setStep('Notifying the administrator of the failure');
            try {
                await deliverPrivately(interaction, { content: 'The poll export failed. Please try again.' });
            } catch (replyError) {
                progress.error('Failed to notify the administrator', replyError);
            }
        } finally {
            progress.stop();
            delete client[activeExport];
        }
    },
};
