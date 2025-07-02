const db = require('../models');
const { Op, literal } = require('sequelize');
// PATCH /influencer/upload-profile
exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const influencer = await db.Influencer.findByPk(req.user.id);
    if (!influencer) return res.status(404).json({ message: 'Influencer not found' });

    influencer.profile_image = `/uploads/influencers/${req.file.filename}`;
    await influencer.save();

    res.status(200).json({ message: 'Image uploaded', path: influencer.profile_image });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /influencer/me
exports.getMyProfile = async (req, res) => {
  try {
    const influencer = await db.Influencer.findByPk(req.user.id, {
      attributes: {
        exclude: ['password_hash']
      }
    });

    if (!influencer) {
      return res.status(404).json({ message: 'Influencer not found.' });
    }

    res.status(200).json(influencer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// PUT /influencer/update

exports.updateMyProfile = async (req, res) => {
  try {
    const {
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
    } = req.body;

    const influencer = await db.Influencer.findByPk(req.user.id);
    if (!influencer) {
      return res.status(404).json({ message: 'Influencer not found.' });
    }

    // Helper function to validate JSON
    const validateJson = (data, fieldName) => {
      if (data === undefined) return undefined;
      if (data === null || data === '') return '[]';
      try {
        const parsed = JSON.parse(data);
        if (!Array.isArray(parsed)) {
          throw new Error(`${fieldName} must be an array`);
        }
        return data;
      } catch (err) {
        throw new Error(`Invalid JSON for ${fieldName}: ${err.message}`);
      }
    };

    // Update fields
    influencer.phone = phone !== undefined ? phone : influencer.phone;
    influencer.skype = skype !== undefined ? skype : influencer.skype;
    influencer.niche = niche !== undefined ? niche : influencer.niche;
    influencer.portfolio = portfolio !== undefined ? portfolio : influencer.portfolio;
    influencer.followers_count =
      followers_count !== undefined ? parseInt(followers_count) || 0 : influencer.followers_count;
    influencer.total_reach =
      total_reach !== undefined ? parseInt(total_reach) || 0 : influencer.total_reach;
    influencer.engagement_rate =
      engagement_rate !== undefined ? parseFloat(engagement_rate) || 0 : influencer.engagement_rate;
    influencer.audience_age_group =
      audience_age_group !== undefined ? audience_age_group : influencer.audience_age_group;

    // Validate and update JSON fields
    try {
      influencer.social_platforms =
        social_platforms !== undefined
          ? validateJson(social_platforms, 'social_platforms')
          : influencer.social_platforms;
      influencer.followers_by_country =
        followers_by_country !== undefined
          ? validateJson(followers_by_country, 'followers_by_country')
          : influencer.followers_by_country;
      influencer.audience_gender =
        audience_gender !== undefined
          ? validateJson(audience_gender, 'audience_gender')
          : influencer.audience_gender;
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    // Save only if changes exist
    const changes = influencer.changed();
    if (changes) {
      await influencer.save();
      res.status(200).json({ message: 'Profile updated successfully!' });
    } else {
      res.status(200).json({ message: 'No changes to save.' });
    }
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(400).json({ message: err.message || 'Invalid input data' });
  }
};
// 📥 Get all notifications for the influencer
exports.getNotifications = async (req, res) => {
  try {
    const influencer_id = req.user.id;

    const notifications = await db.Notification.findAll({
      where: {
        user_type: 'influencer',
        user_id: influencer_id
      },
      order: [['created_at', 'DESC']]
    });

    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Mark a notification as read
exports.markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await db.Notification.findByPk(id);

    if (!notification || notification.user_type !== 'influencer') {
      return res.status(404).json({ message: 'Notification not found or unauthorized.' });
    }

    notification.is_read = true;
    await notification.save();

    res.status(200).json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getMyCampaigns = async (req, res) => {
    try {
      const influencerId = req.user.id;
  
      // Fetch only approved collabs with campaigns
      const requests = await db.CollabRequest.findAll({
        where: { influencer_id: influencerId, status: 'approved' },
        include: [
          {
            model: db.Brand,
            attributes: ['id', 'company_name', 'email']
          },
          {
            model: db.Campaign,
            attributes: ['id', 'campaign_status', 'deliverables', 'quotation_amount', 'start_date', 'end_date']
          }
        ],
        order: [['created_at', 'DESC']]
      });
  
      res.status(200).json({ message: 'Your assigned campaigns', data: requests });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  exports.getLastCollab = async (req, res) => {
    try {
      const influencerId = req.user.id;
  
      const request = await db.CollabRequest.findOne({
        where: { influencer_id: influencerId, status: 'approved' },
        include: [
          {
            model: db.Campaign,
            where: { campaign_status: 'completed' },
            required: true,
            include: [
              {
                model: db.Rating,
                attributes: ['rated_by', 'rating_value', 'review']
              }
            ]
          },
          {
            model: db.Brand,
            attributes: ['company_name', 'email']
          }
        ],
        order: [['created_at', 'DESC']]
      });
  
      if (!request) return res.status(404).json({ message: 'No completed collaborations found.' });
  
      res.status(200).json({ message: 'Last completed collaboration', data: request });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  
  exports.overview = async (req, res) =>{
    try {
      const influencerId = req.user.id;
  
      const requests = await db.CollabRequest.findAll({ where: { influencer_id: influencerId } });
      const campaigns = await db.Campaign.findAll({
        include: {
          model: db.CollabRequest,
          where: { influencer_id: influencerId }
        }
      });
  
      const ratings = await db.Rating.findAll({
        include: {
          model: db.Campaign,
          include: {
            model: db.CollabRequest,
            where: { influencer_id: influencerId }
          }
        }
      });
  
      const total = requests.length;
      const pending = requests.filter(r => r.status === 'pending').length;
      const approved = requests.filter(r => r.status === 'approved').length;
      const rejected = requests.filter(r => r.status === 'rejected').length;
  
      const in_progress = campaigns.filter(c => c.campaign_status === 'in_progress').length;
      const completed = campaigns.filter(c => c.campaign_status === 'completed').length;
  
      const ratingAvg =
        ratings.length > 0
          ? (
              ratings.reduce((sum, r) => sum + r.rating_value, 0) / ratings.length
            ).toFixed(1)
          : 0;
  
      res.json({
        message: 'Influencer overview',
        data: {
          requests: { total, pending, approved, rejected },
          campaigns: { in_progress, completed },
          rating: ratingAvg
        }
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }


  exports.influencer = async (req, res) => {
    try {
      console.log('Query params:', req.query);
      const { search, niche, minFollowers, maxFollowers, platforms } = req.query;
      const whereClause = {};
  
      // Filter by name search
      if (search && search.trim()) {
        const searchTerms = search.trim().split(/\s+/).filter(term => term); // Split by whitespace
        if (searchTerms.length > 0) {
          whereClause.full_name = {
            [Op.or]: searchTerms.map(term => ({
              [Op.like]: `%${term}%`,
            })),
          };
        }
      }
  
      // Filter by niche
      if (niche && niche.trim()) {
        whereClause.niche = niche.trim();
      }
  
      // Filter by follower count range
      if (minFollowers || maxFollowers) {
        whereClause.followers_count = {};
        if (minFollowers && !isNaN(parseInt(minFollowers))) {
          whereClause.followers_count[Op.gte] = parseInt(minFollowers);
        }
        if (maxFollowers && !isNaN(parseInt(maxFollowers))) {
          whereClause.followers_count[Op.lte] = parseInt(maxFollowers);
        }
      }
  
      // Filter by social platforms
      if (platforms && platforms.trim()) {
        const platformsArr = platforms.split(',').map(item => item.trim()).filter(p => p);
        if (platformsArr.length > 0) {
          whereClause.social_platforms = {
            [Op.or]: platformsArr.map(p => ({
              [Op.like]: `%${p}%`,
            })),
          };
        }
      }
  
      console.log('Where clause:', whereClause);
  
      const influencers = await db.Influencer.findAll({
        where: whereClause,
        attributes: ['id', 'full_name', 'niche', 'followers_count', 'profile_image', 'social_platforms', 'followers_by_country'],
        order: search && search.trim() ? [
          // Prioritize matches for the first search term
          [literal(`full_name LIKE '%${search.trim().split(/\s+/)[0]}%' DESC`)],
          // Secondary sorting for second term (if exists)
          ...(search.trim().split(/\s+/).length > 1
            ? [[literal(`full_name LIKE '%${search.trim().split(/\s+/)[1]}%' DESC`)]]
            : []),
          ['full_name', 'ASC'], // Fallback alphabetical sort
        ] : [['full_name', 'ASC']],
      });
  
      res.status(200).json({ message: 'Influencers retrieved successfully', data: influencers });
    } catch (err) {
      console.error('Error in influencer filter:', err.stack);
      res.status(500).json({ message: 'Failed to retrieve influencers', error: err.message });
    }
  };