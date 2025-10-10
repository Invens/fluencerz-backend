// middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { User, Brand, Influencer } = require('../models');

exports.verifyToken = async (req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Current tokens: { id: <Users.id>, role: 'brand'|'influencer'|... }
    const authUserId = decoded.auth_user_id ?? decoded.id; // support old & new

    let brandId = decoded.brand_id ?? null;
    let influencerId = decoded.influencer_id ?? null;

    if (decoded.role === 'brand' && !brandId) {
      const brand = await Brand.findOne({ where: { auth_user_id: authUserId } });
      if (!brand) {
        // No brand row yet; better to fail clearly than pass undefined to queries
        return res.status(409).json({ message: 'Brand profile not found. Please complete brand onboarding.' });
      }
      brandId = brand.id;
    }

    if (decoded.role === 'influencer' && !influencerId) {
      const inf = await Influencer.findOne({ where: { auth_user_id: authUserId } });
      if (!inf) {
        return res.status(409).json({ message: 'Influencer profile not found. Please complete influencer onboarding.' });
      }
      influencerId = inf.id;
    }

    // Map req.user.id to the entity id so old code keeps working:
    let effectiveId = authUserId;
    if (decoded.role === 'brand' && brandId) effectiveId = brandId;
    if (decoded.role === 'influencer' && influencerId) effectiveId = influencerId;

    req.user = {
      ...decoded,
      auth_user_id: authUserId,
      brand_id: brandId,
      influencer_id: influencerId,
      id: effectiveId, // 👈 entity id for brand/influencer routes
    };

    next();
  } catch (err) {
    return res.status(400).json({ message: 'Invalid or expired token.' });
  }
};

exports.requireRole = (allowedRoles) => {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
    }
    next();
  };
};
