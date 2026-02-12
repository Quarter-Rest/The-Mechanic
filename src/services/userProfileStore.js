const database = require('../database');

const SELF_SAMPLE_CAP = 40;
const SOCIAL_SAMPLE_CAP = 25;

function query(sql, params = []) {
    const connection = database.getConnection();
    if (!connection) {
        throw new Error('MySQL connection is not initialized');
    }

    return new Promise((resolve, reject) => {
        connection.query(sql, params, (error, results) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(results);
        });
    });
}

function normalizeContent(content) {
    if (typeof content !== 'string') {
        return '';
    }

    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized) {
        return '';
    }

    return normalized.slice(0, 2000);
}

function toDate(value) {
    if (!value) {
        return null;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    const converted = new Date(value);
    return Number.isNaN(converted.getTime()) ? null : converted;
}

async function init() {
    await query(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            guild_id VARCHAR(32) NOT NULL,
            user_id VARCHAR(32) NOT NULL,
            tone_summary TEXT NULL,
            personality_summary TEXT NULL,
            interests_summary TEXT NULL,
            social_summary TEXT NULL,
            do_list TEXT NULL,
            dont_list TEXT NULL,
            messages_seen INT UNSIGNED NOT NULL DEFAULT 0,
            mentions_to_bot INT UNSIGNED NOT NULL DEFAULT 0,
            messages_since_semantic INT UNSIGNED NOT NULL DEFAULT 0,
            last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_semantic_at DATETIME NULL,
            profile_version INT UNSIGNED NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (guild_id, user_id),
            INDEX idx_profiles_last_semantic (guild_id, last_semantic_at),
            INDEX idx_profiles_updated (guild_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS user_profile_samples (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            guild_id VARCHAR(32) NOT NULL,
            owner_user_id VARCHAR(32) NOT NULL,
            actor_user_id VARCHAR(32) NOT NULL,
            channel_id VARCHAR(32) NOT NULL,
            message_id VARCHAR(32) NOT NULL,
            sample_type ENUM('self','social') NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            INDEX idx_samples_owner_recent (guild_id, owner_user_id, created_at),
            INDEX idx_samples_owner_type (guild_id, owner_user_id, sample_type, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
}

async function touchUserProfile(guildId, userId, deltas = {}) {
    const messagesSeenDelta = Math.max(0, Number(deltas.messagesSeenDelta || 0));
    const mentionsToBotDelta = Math.max(0, Number(deltas.mentionsToBotDelta || 0));
    const messagesSinceSemanticDelta = Math.max(0, Number(deltas.messagesSinceSemanticDelta || 0));

    await query(
        `INSERT INTO user_profiles (
            guild_id,
            user_id,
            messages_seen,
            mentions_to_bot,
            messages_since_semantic,
            last_seen_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            messages_seen = messages_seen + VALUES(messages_seen),
            mentions_to_bot = mentions_to_bot + VALUES(mentions_to_bot),
            messages_since_semantic = messages_since_semantic + VALUES(messages_since_semantic),
            last_seen_at = NOW()`,
        [guildId, userId, messagesSeenDelta, mentionsToBotDelta, messagesSinceSemanticDelta]
    );
}

async function insertSample(sample) {
    const content = normalizeContent(sample.content);
    if (content.length < 5) {
        return null;
    }

    const result = await query(
        `INSERT INTO user_profile_samples (
            guild_id,
            owner_user_id,
            actor_user_id,
            channel_id,
            message_id,
            sample_type,
            content
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            sample.guildId,
            sample.ownerUserId,
            sample.actorUserId,
            sample.channelId,
            sample.messageId,
            sample.sampleType,
            content
        ]
    );

    return result.insertId || null;
}

async function pruneSamples(guildId, ownerUserId, sampleType, keepCount) {
    const staleRows = await query(
        `SELECT id
         FROM user_profile_samples
         WHERE guild_id = ? AND owner_user_id = ? AND sample_type = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 18446744073709551615 OFFSET ?`,
        [guildId, ownerUserId, sampleType, keepCount]
    );

    if (!staleRows.length) {
        return 0;
    }

    const staleIds = staleRows.map(row => row.id);
    const placeholders = staleIds.map(() => '?').join(', ');
    const result = await query(
        `DELETE FROM user_profile_samples WHERE id IN (${placeholders})`,
        staleIds
    );

    return result.affectedRows || 0;
}

async function getProfile(guildId, userId) {
    const rows = await query(
        `SELECT *
         FROM user_profiles
         WHERE guild_id = ? AND user_id = ?
         LIMIT 1`,
        [guildId, userId]
    );
    return rows[0] || null;
}

async function shouldRefreshSemantic(guildId, userId, thresholdMessages = 12, minimumAgeMinutes = 15) {
    const profile = await getProfile(guildId, userId);
    if (!profile) {
        return false;
    }

    if ((profile.messages_since_semantic || 0) < thresholdMessages) {
        return false;
    }

    const lastSemanticAt = toDate(profile.last_semantic_at);
    if (!lastSemanticAt) {
        return true;
    }

    const minimumAgeMs = minimumAgeMinutes * 60 * 1000;
    return Date.now() - lastSemanticAt.getTime() >= minimumAgeMs;
}

function isSemanticRecent(profile, withinMinutes = 5) {
    const lastSemanticAt = toDate(profile?.last_semantic_at);
    if (!lastSemanticAt) {
        return false;
    }
    return Date.now() - lastSemanticAt.getTime() < withinMinutes * 60 * 1000;
}

async function getRecentSamples(guildId, ownerUserId, limits = {}) {
    const selfLimit = limits.selfLimit ?? 20;
    const socialLimit = limits.socialLimit ?? 12;

    const selfRows = await query(
        `SELECT actor_user_id, content, created_at
         FROM user_profile_samples
         WHERE guild_id = ? AND owner_user_id = ? AND sample_type = 'self'
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [guildId, ownerUserId, selfLimit]
    );

    const socialRows = await query(
        `SELECT actor_user_id, content, created_at
         FROM user_profile_samples
         WHERE guild_id = ? AND owner_user_id = ? AND sample_type = 'social'
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [guildId, ownerUserId, socialLimit]
    );

    return {
        selfSamples: selfRows.reverse(),
        socialSamples: socialRows.reverse(),
    };
}

async function updateSemanticProfile(guildId, userId, semanticProfile) {
    await touchUserProfile(guildId, userId, {});

    await query(
        `UPDATE user_profiles
         SET tone_summary = ?,
             personality_summary = ?,
             interests_summary = ?,
             social_summary = ?,
             do_list = ?,
             dont_list = ?,
             messages_since_semantic = 0,
             last_semantic_at = NOW(),
             profile_version = profile_version + 1
         WHERE guild_id = ? AND user_id = ?`,
        [
            semanticProfile.tone_summary || null,
            semanticProfile.personality_summary || null,
            semanticProfile.interests_summary || null,
            semanticProfile.social_summary || null,
            JSON.stringify(semanticProfile.do_list || []),
            JSON.stringify(semanticProfile.dont_list || []),
            guildId,
            userId,
        ]
    );
}

async function getProfileWithSampleCounts(guildId, userId) {
    const profile = await getProfile(guildId, userId);
    const countRows = await query(
        `SELECT sample_type, COUNT(*) AS total
         FROM user_profile_samples
         WHERE guild_id = ? AND owner_user_id = ?
         GROUP BY sample_type`,
        [guildId, userId]
    );

    const counts = { self: 0, social: 0 };
    for (const row of countRows) {
        counts[row.sample_type] = Number(row.total) || 0;
    }

    return { profile, counts };
}

async function resetProfile(guildId, userId) {
    const sampleDelete = await query(
        `DELETE FROM user_profile_samples
         WHERE guild_id = ? AND owner_user_id = ?`,
        [guildId, userId]
    );

    const profileDelete = await query(
        `DELETE FROM user_profiles
         WHERE guild_id = ? AND user_id = ?`,
        [guildId, userId]
    );

    return {
        deletedSamples: sampleDelete.affectedRows || 0,
        deletedProfiles: profileDelete.affectedRows || 0,
    };
}

async function cleanupOldSamples(retentionDays = 30) {
    const safeRetentionDays = Math.max(1, Number(retentionDays) || 30);
    const result = await query(
        `DELETE FROM user_profile_samples
         WHERE created_at < (NOW() - INTERVAL ${safeRetentionDays} DAY)`
    );
    return result.affectedRows || 0;
}

module.exports = {
    SELF_SAMPLE_CAP,
    SOCIAL_SAMPLE_CAP,
    init,
    touchUserProfile,
    insertSample,
    pruneSamples,
    getProfile,
    shouldRefreshSemantic,
    isSemanticRecent,
    getRecentSamples,
    updateSemanticProfile,
    getProfileWithSampleCounts,
    resetProfile,
    cleanupOldSamples,
};
