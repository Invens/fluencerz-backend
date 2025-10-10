const db = require('../models');
const { literal } = db.sequelize;
const { normalizeUsername } = require('./util.normalize');
const { makeSyntheticEmail, makeRandomPasswordHash } = require('./util.identity');
const { mapInstrackToInstagramBlock } = require('./instrack.mapper');
const { search, getByUsername } = require('./instrack.client');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Download profile image from URL and save to local folder.
 * Returns the local filepath or null on error.
 */
async function downloadProfileImage(url, username) {
  if (!url || !url.startsWith('http')) return null;
  
  try {
    const filename = `${normalizeUsername(username)}.jpg`; // Assume JPG; adjust extension if needed
    const filepath = path.join('uploads/influencers', filename);
    const dir = path.dirname(filepath);
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 10000 
    });
    
    const buffer = Buffer.from(response.data, 'binary');
    fs.writeFileSync(filepath, buffer);
    
    console.log(`Downloaded profile image: ${filepath}`);
    return filepath;
  } catch (err) {
    console.error(`Failed to download profile image from ${url}:`, err.message);
    return null;
  }
}

/** Merge/insert the Instagram block in social_platforms[] */
function upsertInstagramBlock(socialPlatforms, ig) {
  const arr = Array.isArray(socialPlatforms) ? [...socialPlatforms] : [];
  const uname = normalizeUsername(ig.username);

  let idx = -1;
  if (ig.external_id) {
    idx = arr.findIndex(x => x?.platform === 'instagram' && String(x.external_id || '') === ig.external_id);
  }
  if (idx < 0) {
    idx = arr.findIndex(x => x?.platform === 'instagram' && normalizeUsername(x.username) === uname);
  }

  if (idx >= 0) {
    const prev = arr[idx] || {};
    arr[idx] = {
      ...prev,
      ...ig,
      kpi: { ...(prev.kpi || {}), ...(ig.kpi || {}) },
      timeline: Array.isArray(ig.timeline)
        ? (ig.timeline.length > 90 ? ig.timeline.slice(-90) : ig.timeline)
        : (prev.timeline || [])
    };
  } else {
    arr.push(ig);
  }
  return arr;
}

/** Find Influencer by IG external_id or username inside JSON */
async function findInfluencerByInstagram({ username, external_id }, t) {
  if (external_id) {
    const byId = await db.Influencer.findOne({
      where: literal(
        `JSON_SEARCH(JSON_EXTRACT(social_platforms, '$[*].external_id'), 'one', ${db.sequelize.escape(String(external_id))}) IS NOT NULL`
      ),
      transaction: t,
    });
    if (byId) return byId;
  }
  if (username) {
    const uname = normalizeUsername(username);
    const byU = await db.Influencer.findOne({
      where: literal(
        `JSON_SEARCH(JSON_EXTRACT(social_platforms, '$[*].username'), 'one', ${db.sequelize.escape(uname)}) IS NOT NULL`
      ),
      transaction: t,
    });
    if (byU) return byU;
  }
  return null;
}

/** Ensure a User exists (type=influencer). Generate synthetic email/pwd if needed. */
async function ensureUser({ full_name, emailCandidate }, t) {
  let email = (emailCandidate || '').trim().toLowerCase();
  if (!email) email = makeSyntheticEmail(full_name || 'creator');

  const user = await db.User.findOne({
    where: db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('email')), email),
    transaction: t
  });

  if (user) {
    if (user.user_type !== 'influencer') {
      user.user_type = 'influencer';
      await user.save({ transaction: t });
    }
    return { user, was_created: false, synthetic_email: !emailCandidate };
  }

  const [firstname, ...rest] = (full_name || 'Creator').split(' ');
  const lastname = rest.join(' ');
  const { password_hash } = await makeRandomPasswordHash();

  const created = await db.User.create({
    firstname: firstname || 'Creator',
    lastname: lastname || '',
    email,
    phone: null,
    password_hash,
    user_type: 'influencer',
    is_onboarded: false,
  }, { transaction: t });

  return { user: created, was_created: true, synthetic_email: !emailCandidate };
}

/** Create or update Influencer and link to the User */
async function upsertInfluencer({ user, ig, profile }, t) {
  let inf = await findInfluencerByInstagram({ username: ig.username, external_id: ig.external_id }, t);

  if (!inf) {
    inf = await db.Influencer.findOne({ where: { auth_user_id: user.id }, transaction: t });
  }

  const mergedSocial = upsertInstagramBlock(inf?.social_platforms || [], ig);
  const fullName = profile.name || profile.full_name || ig.username;

  // Download profile image if URL is available and not already a local path
  let profilePicPath = inf?.profile_picture || null;
  if (ig.profile_picture_url && (!profilePicPath || profilePicPath.startsWith('http'))) {
    profilePicPath = await downloadProfileImage(ig.profile_picture_url, ig.username);
  }

  if (inf) {
    inf.auth_user_id = user.id;
    inf.full_name = inf.full_name || fullName;

    if (profilePicPath) {
      inf.profile_picture = profilePicPath;
      inf.profile_image = profilePicPath;
    }
    if (Number.isFinite(ig.followers)) inf.followers_count = ig.followers;

    inf.social_platforms = mergedSocial;
    await inf.save({ transaction: t });
    return { influencer: inf, created: false };
  }

  // For new influencer, download if URL available
  const createData = {
    auth_user_id: user.id,
    full_name: fullName,
    email: user.email,                 // keep unique email aligned with the user
    phone: '',
    skype: '',
    password_hash: user.password_hash, // optional
    niche: null,
    followers_count: ig.followers,
    engagement_rate: 0,
    total_reach: 0,
    social_platforms: mergedSocial,
    followers_by_country: [],
    audience_age_group: null,
    audience_gender: { male: 0, female: 0, other: 0 },
    country: null,
    categories: [],
    communication_channel: {},
    portfolio: '',
    availability: 'available',
    is_onboarded: false,
  };

  if (profilePicPath) {
    createData.profile_image = profilePicPath;
    createData.profile_picture = profilePicPath;
  } else {
    createData.profile_image = ig.profile_picture_url || null;
    createData.profile_picture = ig.profile_picture_url || null;
  }

  const created = await db.Influencer.create(createData, { transaction: t });

  return { influencer: created, created: true };
}

/** Import by full Instrack payload (the JSON you posted) */
async function importInstrackProfile(profile, sequelize) {
  if (!profile?.username) throw new Error('Invalid Instrack payload (username missing)');
  const ig = mapInstrackToInstagramBlock(profile);

  return sequelize.transaction(async (t) => {
    const full_name = profile.name || profile.full_name || ig.username;
    const { user, was_created, synthetic_email } =
      await ensureUser({ full_name, emailCandidate: null }, t);

    const { influencer, created } =
      await upsertInfluencer({ user, ig, profile }, t);

    return {
      ok: true,
      user_id: user.id,
      influencer_id: influencer.id,
      user_created: was_created,
      influencer_created: created,
      used_synthetic_email: synthetic_email,
      email: user.email,
      username: ig.username,
    };
  });
}

/** Import by username (server fetches from Instrack first), fallback to search */
async function importByUsername(username, sequelize) {
  const uname = normalizeUsername(username);
  let profile = null;

  try {
    profile = await getByUsername(uname);
  } catch {
    const hits = await search(uname);
    const exact = hits.find(h => normalizeUsername(h.username) === uname);
    profile = exact || hits[0];
    if (!profile) throw new Error(`No match for ${uname}`);
  }

  return importInstrackProfile(profile, sequelize);
}

module.exports = { importInstrackProfile, importByUsername };