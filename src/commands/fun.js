const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const { getBalance, transferBalance } = require('../services/fun');

const moneyFormat = new Intl.NumberFormat('en-US');
const paymentErrors = {
    already_paid: 'This payment has already been sent.',
    insufficient_funds: 'You don’t have enough money for that payment.',
    overflow: 'That payment would put the recipient over the balance limit.',
};

async function showBalance(interaction) {
    let balance;
    try {
        balance = await getBalance(interaction.user.id);
    } catch (error) {
        console.error('[Fun] Failed to read balance.', error.code ?? error.name);
        await interaction.editReply('Fun is unavailable right now. Try again in a bit.');
        return;
    }

    await interaction.editReply(`Your balance is **${moneyFormat.format(balance)}**.`);
}

async function pay(interaction) {
    const recipient = interaction.options.getUser('recipient', true);
    const amount = interaction.options.getInteger('amount', true);

    if (recipient.id === interaction.user.id) {
        return interaction.editReply('Choose someone other than yourself.');
    }
    if (recipient.bot || !interaction.options.getMember('recipient')) {
        return interaction.editReply('Choose another person in this server.');
    }
    if (!Number.isSafeInteger(amount) || amount < 1) {
        return interaction.editReply('Enter a positive whole-dollar amount.');
    }

    let result;
    try {
        result = await transferBalance(interaction.user.id, recipient.id, BigInt(amount), interaction.id);
    } catch (error) {
        console.error('[Fun] Failed to confirm payment.', error.code ?? error.name);
        return interaction.editReply('I couldn’t confirm the payment. Check your balance before trying again.');
    }

    if (!result.ok) return interaction.editReply(paymentErrors[result.reason]);

    return interaction.editReply({
        content: `You paid <@${recipient.id}> **$${moneyFormat.format(amount)}**. Your balance is **$${moneyFormat.format(result.senderBalance)}**.`,
        allowedMentions: { parse: [] },
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fun')
        .setDescription('Play Fun')
        .addSubcommand(subcommand => subcommand
            .setName('balance')
            .setDescription('Check how much money you have'))
        .addSubcommand(subcommand => subcommand
            .setName('pay')
            .setDescription('Send Fun money to another member')
            .addUserOption(option => option
                .setName('recipient')
                .setDescription('Who to pay')
                .setRequired(true))
            .addIntegerOption(option => option
                .setName('amount')
                .setDescription('How many dollars to send')
                .setMinValue(1)
                .setMaxValue(Number.MAX_SAFE_INTEGER)
                .setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        if (interaction.options.getSubcommand() === 'pay') {
            await pay(interaction);
        } else {
            await showBalance(interaction);
        }
    },
};
