const { MessageFlags, SlashCommandSubcommandBuilder } = require('discord.js');
const { transferBalance } = require('../../../services/fun');

const paymentErrors = {
    already_paid: 'This payment has already been sent.',
    insufficient_funds: 'You don’t have enough money for that payment.',
    overflow: 'That payment would put the recipient over the balance limit.',
};

module.exports = {
    data: new SlashCommandSubcommandBuilder()
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
            .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

        const paid = amount.toLocaleString('en-US');
        const remaining = result.senderBalance.toLocaleString('en-US');
        return interaction.editReply({
            content: `You paid <@${recipient.id}> **$${paid}**. Your balance is **$${remaining}**.`,
            allowedMentions: { parse: [] },
        });
    },
};
