// controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../models');
const sequelize = db.sequelize;
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

/* ================================
 * Helpers
 * ================================ */

// Always sign a payload that can include:
// { auth_user_id, role, brand_id?, influencer_id? }
const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

const fullName = (first, last) =>
  [first, last].filter(Boolean).join(' ').trim() || 'Unknown';

async function verifyLegacyPassword(record, password) {
  if (!record || !record.password_hash) {
    console.error('[AUTH] verifyLegacyPassword: No record or hash for verification');
    return false;
  }
  try {
    const match = await bcrypt.compare(password, record.password_hash);
    if (!match) {
      console.error('[AUTH] verifyLegacyPassword: Password mismatch for record ID:', record.id);
    }
    return match;
  } catch (err) {
    console.error('[AUTH] verifyLegacyPassword error:', err.message, { recordId: record.id, passwordLength: password.length });
    return false;
  }
}

/**
 * Bridge a legacy Brand/Influencer into Users:
 * - Create/reuse Users row by email
 * - Copy password_hash if Users hash is empty
 * - Set user_type and is_onboarded
 * - Back-link legacy.auth_user_id
 */
async function bridgeLegacyUser(legacy, type) {
  const lowerEmail = legacy.email.toLowerCase();
  let user = await db.User.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      Op.eq,
      lowerEmail
    )
  });

  const legacyName =
    type === 'brand' ? (legacy.contact_person || '') : (legacy.full_name || '');
  const first = (legacyName.split(' ')[0] || 'User').trim();
  const last  = legacyName.split(' ').slice(1).join(' ').trim();

  try {
    if (!user) {
      console.log('[AUTH] bridgeLegacyUser: Creating new User for legacy', type, 'email:', lowerEmail);
      user = await db.User.create({
        firstname: first,
        lastname: last,
        email: legacy.email,
        phone: legacy.phone || null,
        password_hash: legacy.password_hash || null,
        user_type: type,
        is_onboarded: Boolean(legacy.is_onboarded),
      });
      console.log('[AUTH] bridgeLegacyUser: New User created ID:', user.id);
    } else {
      console.log('[AUTH] bridgeLegacyUser: Updating existing User ID:', user.id, 'for type:', type);
      if (!user.user_type) user.user_type = type;
      if (!user.password_hash && legacy.password_hash) {
        user.password_hash = legacy.password_hash;
      }
      user.is_onboarded = Boolean(user.is_onboarded || legacy.is_onboarded);
      await user.save();
      console.log('[AUTH] bridgeLegacyUser: User updated successfully');
    }

    if (!legacy.auth_user_id) {
      console.log('[AUTH] bridgeLegacyUser: Setting auth_user_id on legacy:', legacy.id);
      legacy.auth_user_id = user.id;
      await legacy.save();
    }

    return user;
  } catch (err) {
    console.error('[AUTH] bridgeLegacyUser error:', err.message, { legacyId: legacy.id, type, email: lowerEmail });
    throw err;
  }
}

/* ================================
 * AUTH: Register / Login / Me
 * ================================ */

// Minimal registration (no role yet)
exports.register = async (req, res) => {
  try {
    const { firstname, lastname, email, phone, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
      console.error('[AUTH] register: Missing required fields', { firstname: !!firstname, lastname: !!lastname, email: !!email, password: !!password });
      return res.status(400).json({ message: 'Missing required fields.' });
    }

    const lowerEmail = email.toLowerCase();
    const exists = await db.User.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        Op.eq,
        lowerEmail
      )
    });
    if (exists) {
      console.error('[AUTH] register: Email already in use', lowerEmail);
      return res.status(400).json({ message: 'Email already in use.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await db.User.create({
      firstname,
      lastname,
      email,
      phone: phone || null,
      password_hash: hash,
      user_type: null,
      is_onboarded: false,
    });

    const token = signToken({ auth_user_id: user.id, role: null });

    console.log('[AUTH] register: Success for email', lowerEmail, 'User ID:', user.id);
    return res.status(201).json({
      message: 'Registered',
      token,
      userType: null,
      is_onboarded: false,
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
      },
    });
  } catch (err) {
    console.error('[AUTH] register error:', err.message, { stack: err.stack, body: req.body });
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * LOGIN — LEGACY FIRST:
 * 1) Check Brand by email → verify password → bridge + token({auth_user_id, role:'brand', brand_id})
 * 2) Else check Influencer → verify password → bridge + token({auth_user_id, role:'influencer', influencer_id})
 * 3) Else check Users → verify password → token({auth_user_id, role, brand_id?/influencer_id?})
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      console.error('[AUTH] login: Missing email or password', { email: !!email, password: !!password });
      return res.status(400).json({ message: 'Email and password required.' });
    }

    const lowerEmail = email.toLowerCase();
    console.log('[AUTH] login: Attempting login for', lowerEmail);

    // Step 1: try legacy Brand
    const legacyBrand = await db.Brand.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        Op.eq,
        lowerEmail
      )
    });
    console.log('[AUTH] login: Legacy Brand found?', !!legacyBrand);
    if (legacyBrand && await verifyLegacyPassword(legacyBrand, password)) {
      console.log('[AUTH] login: Brand password verified, bridging...');
      const bridgedUser = await bridgeLegacyUser(legacyBrand, 'brand');
      const token = signToken({
        auth_user_id: bridgedUser.id,
        role: 'brand',
        brand_id: legacyBrand.id,
      });
      console.log('[AUTH] login: Brand login success. Users.id:', bridgedUser.id, 'Brands.id:', legacyBrand.id);
      return res.status(200).json({
        message: 'Login successful (legacy brand).',
        token,
        userType: 'brand',
        role: 'brand',
        is_onboarded: Boolean(bridgedUser.is_onboarded),
        user: {
          id: bridgedUser.id,
          email: bridgedUser.email,
          firstname: bridgedUser.firstname,
          lastname: bridgedUser.lastname,
          user_type: 'brand',
          is_onboarded: bridgedUser.is_onboarded,
        },
      });
    }

    // Step 2: try legacy Influencer
    const legacyInfluencer = await db.Influencer.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        Op.eq,
        lowerEmail
      )
    });
    console.log('[AUTH] login: Legacy Influencer found?', !!legacyInfluencer);
    if (legacyInfluencer && await verifyLegacyPassword(legacyInfluencer, password)) {
      console.log('[AUTH] login: Influencer password verified, bridging...');
      const bridgedUser = await bridgeLegacyUser(legacyInfluencer, 'influencer');
      const token = signToken({
        auth_user_id: bridgedUser.id,
        role: 'influencer',
        influencer_id: legacyInfluencer.id,
      });
      console.log('[AUTH] login: Influencer login success. Users.id:', bridgedUser.id, 'Influencers.id:', legacyInfluencer.id);
      return res.status(200).json({
        message: 'Login successful (legacy influencer).',
        token,
        userType: 'influencer',
        role: 'influencer',
        is_onboarded: Boolean(bridgedUser.is_onboarded),
        user: {
          id: bridgedUser.id,
          email: bridgedUser.email,
          firstname: bridgedUser.firstname,
          lastname: bridgedUser.lastname,
          user_type: 'influencer',
          is_onboarded: bridgedUser.is_onboarded,
        },
      });
    }

    // Step 3: New Users table
    const user = await db.User.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        Op.eq,
        lowerEmail
      )
    });
    console.log('[AUTH] login: New User found?', !!user);
    if (!user) {
      console.error('[AUTH] login: No user found in any table for', lowerEmail);
      return res.status(404).json({ message: 'User not found.' });
    }

    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) {
      console.error('[AUTH] login: Password mismatch for User ID:', user.id);
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    // Build token payload with entity ids when available
    const payload = { auth_user_id: user.id, role: user.user_type || null };

    if (user.user_type === 'brand') {
      const brand = await db.Brand.findOne({ where: { auth_user_id: user.id } });
      if (brand) payload.brand_id = brand.id;
    } else if (user.user_type === 'influencer') {
      const inf = await db.Influencer.findOne({ where: { auth_user_id: user.id } });
      if (inf) payload.influencer_id = inf.id;
    }

    const token = signToken(payload);
    console.log('[AUTH] login: New user login success, Users.id:', user.id, 'Type:', user.user_type, 'payload:', payload);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      userType: user.user_type || null,
      role: user.user_type || null,
      is_onboarded: Boolean(user.is_onboarded),
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        user_type: user.user_type,
        is_onboarded: user.is_onboarded,
      },
    });
  } catch (err) {
    console.error('[AUTH] login error:', err.message, { stack: err.stack, email: req.body.email, userType: req.body.userType });
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Who am I (guard/redirect helper)
exports.me = async (req, res) => {
  try {
    const authUserId = req.user?.auth_user_id ?? req.user?.id; // support both shapes
    const u = await db.User.findByPk(authUserId);
    if (!u) {
      console.error('[AUTH] me: User not found for Users.id:', authUserId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('[AUTH] me: Success for Users.id:', u.id, 'Type:', u.user_type);
    return res.json({
      id: u.id,
      email: u.email,
      userType: u.user_type,
      is_onboarded: u.is_onboarded,
      name: fullName(u.firstname, u.lastname),
      created_at: u.created_at,
      updated_at: u.updated_at,
    });
  } catch (err) {
    console.error('[AUTH] me error:', err.message, { stack: err.stack, user_claim: req.user });
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/* ================================
 * ONBOARDING
 * ================================ */

// Step A: user picks type (brand|influencer) and get a fresh token
exports.selectType = async (req, res) => {
  try {
    const { userType } = req.body || {};
    if (!['brand', 'influencer'].includes(userType)) {
      console.error('[AUTH] selectType: Invalid user type', userType);
      return res.status(400).json({ message: 'Invalid user type' });
    }

    const authUserId = req.user?.auth_user_id ?? req.user?.id;
    const user = await db.User.findByPk(authUserId);
    if (!user) {
      console.error('[AUTH] selectType: User not found for Users.id:', authUserId);
      return res.status(404).json({ message: 'User not found' });
    }

    user.user_type = userType;
    await user.save();

    // Fresh token (no entity id yet until onboarding completes)
    const token = signToken({ auth_user_id: user.id, role: userType });

    console.log('[AUTH] selectType: Success for Users.id:', user.id, 'Type:', userType);
    return res.json({ message: 'User type saved', userType: user.user_type, token });
  } catch (err) {
    console.error('[AUTH] selectType error:', err.message, { stack: err.stack, user_claim: req.user, body: req.body });
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Brand onboarding (mark onboarded + return fresh token WITH brand_id)
exports.updateBrandProfile = async (req, res) => {
  try {
    const authUserId = req.user?.auth_user_id ?? req.user?.id;
    const baseUser = await db.User.findByPk(authUserId);
    if (!baseUser) {
      console.error('[AUTH] updateBrandProfile: User not found for Users.id:', authUserId);
      return res.status(404).json({ message: 'User not found' });
    }
    if (baseUser.user_type !== 'brand') {
      console.error('[AUTH] updateBrandProfile: Forbidden type for Users.id:', authUserId, 'Expected: brand, Got:', baseUser.user_type);
      return res.status(403).json({ message: 'Forbidden' });
    }

    const {
      company_name,
      industry,
      logo_url,
      communication_channel,
      phone,
      skype,
      website,
      contact_person,
      budget_range,
      campaign_goal,
    } = req.body;

    const [brand] = await db.Brand.findOrCreate({
      where: { auth_user_id: authUserId },
      defaults: {
        auth_user_id: authUserId,
        email: baseUser.email || '',
        company_name: company_name || null,
        contact_person:
          contact_person ||
          fullName(baseUser.firstname, baseUser.lastname) ||
          (company_name || 'Unknown'),
        phone: phone || '',
        skype: skype || '',
        industry: industry || null,
        website: website || null,
        profile_image: logo_url || null,
        budget_range: budget_range || null,
        campaign_goal: campaign_goal || null,
        communication_channel: communication_channel || null,
        is_onboarded: false,
      },
    });

    brand.company_name = company_name ?? brand.company_name;
    brand.industry = industry ?? brand.industry;
    brand.profile_image = logo_url ?? brand.profile_image;
    brand.communication_channel = communication_channel ?? brand.communication_channel;
    brand.phone = phone ?? brand.phone;
    brand.skype = skype ?? brand.skype;
    brand.website = website ?? brand.website;
    brand.contact_person = contact_person ?? brand.contact_person;
    brand.budget_range = budget_range ?? brand.budget_range;
    brand.campaign_goal = campaign_goal ?? brand.campaign_goal;
    brand.is_onboarded = true;
    await brand.save();

    baseUser.is_onboarded = true;
    await baseUser.save();

    const token = signToken({ auth_user_id: baseUser.id, role: 'brand', brand_id: brand.id });

    console.log('[AUTH] updateBrandProfile: Success for Users.id:', authUserId, 'Brands.id:', brand.id);
    return res.status(200).json({
      message: 'Brand onboarded',
      token,
      userType: 'brand',
      is_onboarded: true,
      brand,
    });
  } catch (err) {
    console.error('[AUTH] updateBrandProfile error:', err.message, { stack: err.stack, user_claim: req.user, body: req.body });
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

// Influencer onboarding (mark onboarded + return fresh token WITH influencer_id)
exports.updateInfluencerProfile = async (req, res) => {
  try {
    const authUserId = req.user?.auth_user_id ?? req.user?.id;
    const baseUser = await db.User.findByPk(authUserId);
    if (!baseUser) {
      console.error('[AUTH] updateInfluencerProfile: User not found for Users.id:', authUserId);
      return res.status(404).json({ message: 'User not found.' });
    }
    if (baseUser.user_type !== 'influencer') {
      console.error('[AUTH] updateInfluencerProfile: Forbidden type for Users.id:', authUserId, 'Expected: influencer, Got:', baseUser.user_type);
      return res.status(403).json({ message: 'Forbidden' });
    }

    const {
      full_name,
      name,
      country,
      categories,
      communication_channels, // [{channel, handle}]
      profile_picture,

      // legacy/extra
      phone,
      skype,
      niche,
      followers_count,
      total_reach,
      audience_age_group,
      social_platforms,
      portfolio,
      engagement_rate,
      followers_by_country,
      audience_gender,
      availability,
    } = req.body;

    if (
      communication_channels &&
      (!Array.isArray(communication_channels) ||
        communication_channels.some(c => !c.channel || !c.handle))
    ) {
      console.error('[AUTH] updateInfluencerProfile: Invalid communication_channels', communication_channels);
      return res.status(400).json({
        message: 'communication_channels must be an array of { channel, handle }',
      });
    }

    const communication_channel = communication_channels
      ? communication_channels.reduce((acc, item) => {
          acc[item.channel] = { handle: item.handle };
          return acc;
        }, {})
      : {};

    const [influencer] = await db.Influencer.findOrCreate({
      where: { auth_user_id: authUserId },
      defaults: {
        auth_user_id: authUserId,
        email: baseUser.email || '',
        full_name: full_name || name || fullName(baseUser.firstname, baseUser.lastname),

        // strict schema safety:
        phone: phone || '',
        skype: skype || '',
        password_hash: baseUser.password_hash || '',

        niche: niche || null,
        followers_count: parseInt(followers_count) || 0,
        engagement_rate: parseFloat(engagement_rate) || 0,
        total_reach: parseInt(total_reach) || 0,
        audience_age_group: audience_age_group || null,
        audience_gender: audience_gender || { male: 0, female: 0, other: 0 },
        social_platforms: social_platforms || [],
        followers_by_country: followers_by_country || [],
        portfolio: portfolio || '',
        categories: categories || [],
        communication_channel,
        profile_picture: profile_picture || null,
        country: country || null,
        availability: availability || 'available',
        is_onboarded: false,
      },
    });

    influencer.full_name = (full_name || name) ?? influencer.full_name;
    influencer.country = country ?? influencer.country;
    influencer.categories = categories ?? influencer.categories;
    influencer.communication_channel = communication_channel ?? influencer.communication_channel;
    influencer.profile_picture = profile_picture ?? influencer.profile_picture;

    if (phone !== undefined) influencer.phone = phone;
    if (skype !== undefined) influencer.skype = skype;
    if (niche !== undefined) influencer.niche = niche;
    if (followers_count !== undefined) influencer.followers_count = parseInt(followers_count) || 0;
    if (total_reach !== undefined) influencer.total_reach = parseInt(total_reach) || 0;
    if (engagement_rate !== undefined) influencer.engagement_rate = parseFloat(engagement_rate) || 0;
    if (audience_age_group !== undefined) influencer.audience_age_group = audience_age_group;
    if (social_platforms !== undefined) influencer.social_platforms = social_platforms;
    if (followers_by_country !== undefined) influencer.followers_by_country = followers_by_country;
    if (audience_gender !== undefined) influencer.audience_gender = audience_gender;
    if (portfolio !== undefined) influencer.portfolio = portfolio;
    if (availability !== undefined) influencer.availability = availability;

    influencer.is_onboarded = true;
    await influencer.save();

    baseUser.is_onboarded = true;
    await baseUser.save();

    const token = signToken({ auth_user_id: baseUser.id, role: 'influencer', influencer_id: influencer.id });

    console.log('[AUTH] updateInfluencerProfile: Success for Users.id:', authUserId, 'Influencers.id:', influencer.id);
    return res.status(200).json({
      message: 'Influencer onboarded',
      token,
      userType: 'influencer',
      is_onboarded: true,
      influencer,
    });
  } catch (err) {
    console.error('[AUTH] updateInfluencerProfile error:', err.message, { stack: err.stack, user_claim: req.user, body: req.body });
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

/* ================================
 * LEGACY REGISTRATION (optional)
 * ================================ */

exports.registerBrand = async (req, res) => {
  try {
    const { company_name, contact_person, email, phone, skype, password, industry } = req.body;

    const lowerEmail = email.toLowerCase();
    const existing = await db.Brand.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        Op.eq,
        lowerEmail
      )
    });
    if (existing) {
      console.error('[AUTH] registerBrand: Brand already exists for', lowerEmail);
      return res.status(400).json({ message: 'Brand already exists.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const brand = await db.Brand.create({
      company_name,
      contact_person: contact_person || company_name || 'Unknown',
      email,
      phone: phone || '',
      skype: skype || '',
      password_hash: hash,
      industry: industry || null,
      is_onboarded: true,
    });

    // Auto-bridge to Users for new system
    await bridgeLegacyUser(brand, 'brand');

    console.log('[AUTH] registerBrand: Success for email', lowerEmail, 'Brands.id:', brand.id);
    return res.status(201).json({ message: 'Brand account created successfully!', brand });
  } catch (err) {
    console.error('[AUTH] registerBrand error:', err.message, { stack: err.stack, body: req.body });
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.registerInfluencer = async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone,
      skype,
      password,
      niche,
      followers_count,
      engagement_rate,
      social_platforms,
      followers_by_country,
      audience_age_group,
      audience_gender,
      total_reach,
      portfolio,
      availability,
    } = req.body;

    const lowerEmail = email.toLowerCase();
    const existing = await db.Influencer.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        Op.eq,
        lowerEmail
      )
    });
    if (existing) {
      console.error('[AUTH] registerInfluencer: Influencer already exists for', lowerEmail);
      return res.status(400).json({ message: 'Influencer already exists.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const influencer = await db.Influencer.create({
      full_name: full_name || 'Unknown',
      email,
      phone: phone || '',
      skype: skype || '',
      password_hash: hash,
      niche: niche || 'general',
      followers_count: parseInt(followers_count) || 0,
      engagement_rate: parseFloat(engagement_rate) || 0,
      total_reach: parseInt(total_reach) || 0,
      social_platforms: social_platforms || [],
      followers_by_country: followers_by_country || [],
      audience_age_group: audience_age_group || null,
      audience_gender: audience_gender || { male: 0, female: 0, other: 0 },
      portfolio: portfolio || '',
      availability: availability || 'available',
      is_onboarded: true,
    });

    // Auto-bridge to Users for new system
    await bridgeLegacyUser(influencer, 'influencer');

    console.log('[AUTH] registerInfluencer: Success for email', lowerEmail, 'Influencers.id:', influencer.id);
    return res.status(201).json({ message: 'Influencer account created successfully!', influencer });
  } catch (err) {
    console.error('[AUTH] registerInfluencer error:', err.message, { stack: err.stack, body: req.body });
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ✅ Admin login (case-insensitive email, robust type check, correct token fn)
exports.loginasAdmin = async (req, res) => {
  try {
    const rawEmail = req.body?.email || '';
    const password = req.body?.password || '';
    const normalizedType = (req.body?.userType || '').trim().toLowerCase();

    if (normalizedType !== 'admin') {
      return res.status(400).json({ message: 'Invalid user type.' });
    }
    if (!rawEmail || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const lowerEmail = rawEmail.trim().toLowerCase();

    // Case-insensitive lookup (same style you used elsewhere)
    const user = await db.Admin.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        lowerEmail
      ),
      // logging: console.log,  // uncomment to see SQL during debugging
    });

    if (!user) {
      // Optional: quick hint to find common issues
      // console.error('[ADMIN LOGIN] No admin found for', lowerEmail);
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash || '');
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password.' });
    }

    // Be explicit: app-level role vs. admin table role
    const token = signToken({
      auth_user_id: user.id,
      role: 'admin',             // app role
      admin_role: user.role,     // 'super_admin' | 'moderator' from DB
      admin_id: user.id
    });

    return res.status(200).json({
      message: 'Login successful.',
      token,
      userType: 'admin',
      role: 'admin',
      admin_role: user.role, // expose if your frontend needs it
      user
    });
  } catch (err) {
    console.error('[ADMIN LOGIN] error:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};
