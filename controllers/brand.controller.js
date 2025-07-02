const db = require('../models');

// ✅ Update brand profile (phone, skype, industry, website)
exports.updateBrandProfile = async (req, res) => {
  try {
    const brandId = req.user.id;

    const { phone, skype, industry, website } = req.body;

    const brand = await db.Brand.findByPk(brandId);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    brand.phone = phone || brand.phone;
    brand.skype = skype || brand.skype;
    brand.industry = industry || brand.industry;
    brand.website = website || brand.website;

    await brand.save();

    res.status(200).json({ message: 'Profile updated successfully', brand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const brand = await db.Brand.findByPk(req.user.id);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    brand.profile_image = `/uploads/brands/${req.file.filename}`;
    await brand.save();

    res.status(200).json({ message: 'Image uploaded', path: brand.profile_image });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const brandId = req.user.id;

    const requests = await db.CollabRequest.findAll({
      where: { brand_id: brandId },
      include: [
        {
          model: db.Influencer,
          attributes: ['id', 'full_name', 'email', 'niche', 'followers_count']
        },
        {
          model: db.Campaign,
          attributes: ['id', 'campaign_status', 'quotation_amount', 'start_date', 'end_date']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({ message: 'Your collaboration requests', data: requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBrandOverview = async (req, res) => {
  try {
    const brandId = req.user.id;

    // Collab Requests Summary
    const requests = await db.CollabRequest.findAll({
      where: { brand_id: brandId },
      attributes: ['status']
    });

    // Campaign Summary
    const campaigns = await db.Campaign.findAll({
      include: {
        model: db.CollabRequest,
        where: { brand_id: brandId },
        attributes: []
      },
      attributes: ['campaign_status']
    });

    const requestStats = {
      total: requests.length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      pending: requests.filter(r => r.status === 'pending').length
    };

    const campaignStats = {
      in_progress: campaigns.filter(c => c.campaign_status === 'in_progress').length,
      completed: campaigns.filter(c => c.campaign_status === 'completed').length
    };

    res.json({ requests: requestStats, campaigns: campaignStats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.influencers = async (req, res) =>{
  try {
    const influencers = await db.Influencer.findAll({
      attributes: ['id', 'full_name', 'niche', 'followers_count', 'social_platforms','profile_image']
    });
    res.json(influencers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }

}

exports.campaign = async (req, res)=> {

  try {
    const brandId = req.user.id;

    const campaigns = await db.Campaign.findAll({
      include: {
        model: db.CollabRequest,
        where: { brand_id: brandId },
        include: {
          model: db.Influencer,
          attributes: ['full_name', 'email']
        }
      },
      order: [['start_date', 'DESC']]
    });

    res.json({ message: 'Your campaigns', data: campaigns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

exports.ratings = async (req, res) =>{
  try {
    const brandId = req.user.id;

    const campaigns = await db.Campaign.findAll({
      where: { campaign_status: 'completed' },
      include: [
        {
          model: db.CollabRequest,
          where: { brand_id: brandId },
          include: { model: db.Influencer, attributes: ['full_name', 'email'] }
        },
        {
          model: db.Rating,
          where: { rated_by: 'brand' },
          required: false
        }
      ],
      order: [['end_date', 'DESC']]
    });

    res.json({ message: 'Completed campaigns for brand rating', data: campaigns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

exports.addRating = async (req, res) => {
  try {
    const { campaign_id, rating_value, review } = req.body;

    const existing = await db.Rating.findOne({
      where: { campaign_id, rated_by: 'brand' }
    });

    if (existing) {
      existing.rating_value = rating_value;
      existing.review = review;
      await existing.save();
      return res.json({ message: 'Rating updated successfully' });
    }

    await db.Rating.create({
      campaign_id,
      rated_by: 'brand',
      rating_value,
      review
    });

    res.status(201).json({ message: 'Rating submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}


exports.profile = async (req, res) => {
  try {
    const brand = await db.Brand.findByPk(req.user.id, {
      attributes: [
        'company_name',
        'contact_person',
        'email',
        'phone',
        'skype',
        'industry',
        'website',
        'profile_image'
      ]
    });

    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    res.json({ message: 'Brand profile fetched', data: brand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /brand/me
exports.getMyProfile = async (req, res) => {
  try {
    const influencer = await db.Brand.findByPk(req.user.id, {
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


exports.brandList = async (req, res) => {
  try {
    const brand = await db.Brand.findAll({
      attributes: [
        'company_name',
        'profile_image'
      ]
    });

    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    res.json({ message: 'Brand profile fetched', data: brand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}