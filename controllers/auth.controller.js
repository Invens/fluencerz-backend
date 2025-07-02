const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models'); // ✅ Make sure folder name is lowercase
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// 🔐 Utility: Generate JWT token
const generateToken = (id, role, userType) => {
  return jwt.sign({ id, role, userType }, JWT_SECRET, { expiresIn: '7d' });
};

// ✅ Brand Registration
exports.registerBrand = async (req, res) => {
  try {
    const { company_name, contact_person, email, phone, skype, password, industry } = req.body;

    const existing = await db.Brand.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Brand already exists.' });

    const hash = await bcrypt.hash(password, 10);

    const brand = await db.Brand.create({
      company_name,
      contact_person,
      email,
      industry,
      phone,
      skype,
      password_hash: hash
    });

    res.status(201).json({ message: 'Brand account created successfully!', brand });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// ✅ Influencer Registration
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
      availability
    } = req.body;

    const existing = await db.Influencer.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Influencer already exists.' });

    const hash = await bcrypt.hash(password, 10);

    const influencer = await db.Influencer.create({
      full_name,
      email,
      phone,
      skype,
      niche: niche || 'general',
      password_hash: hash,
      followers_count: parseInt(followers_count) || 0,
      engagement_rate: parseFloat(engagement_rate) || 0,
      social_platforms: social_platforms || [],
      followers_by_country: followers_by_country || [],
      audience_age_group: audience_age_group || null,
      audience_gender: audience_gender || { male: 0, female: 0, other: 0 },
      total_reach: parseInt(total_reach) || 0,
      portfolio: portfolio || '',
      availability: availability || 'available'
    });

    res.status(201).json({ message: 'Influencer account created successfully!', influencer });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// ✅ Admin Registration
exports.registerAdmin = async (req, res) => {
  try {
    const { full_name, email, phone, skype, password, role } = req.body;

    const existing = await db.Admin.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Admin already exists.' });

    const hash = await bcrypt.hash(password, 10);

    const admin = await db.Admin.create({
      full_name,
      email,
      phone,
      skype,
      password_hash: hash,
      role: role || 'super_admin'
    });

    res.status(201).json({ message: 'Admin account created successfully!', admin });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

// ✅ Login for All Users
exports.login = async (req, res) => {
  const { email, password, userType } = req.body;

  try {
    let user;

    if (userType === 'brand') {
      user = await db.Brand.findOne({ where: { email } });
    } else if (userType === 'influencer') {
      user = await db.Influencer.findOne({ where: { email } });
    } else if (userType === 'admin') {
      user = await db.Admin.findOne({ where: { email } });
    } else {
      return res.status(400).json({ message: 'Invalid user type.' });
    }

    if (!user) return res.status(404).json({ message: 'User not found.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password.' });

    const token = generateToken(user.id, user.role || userType, userType);

    res.status(200).json({
      message: 'Login successful.',
      token,
      userType,
      role: user.role || userType,
      user
    });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};
