exports.rateInfluencer = async (req, res) => {
    try {
      const { campaign_id, rating_value, review } = req.body;
      const rated_by = req.user.role; // 'admin' or 'brand'
  
      const campaign = await db.Campaign.findByPk(campaign_id);
      if (!campaign || campaign.campaign_status !== 'completed') {
        return res.status(400).json({ message: 'Rating only allowed after campaign completion.' });
      }
  
      const existing = await db.Rating.findOne({
        where: { campaign_id, rated_by }
      });
  
      if (existing) {
        return res.status(400).json({ message: 'You already rated this campaign.' });
      }
  
      const rating = await db.Rating.create({
        campaign_id,
        rated_by,
        rating_value,
        review
      });
  
      res.status(201).json({ message: 'Rating submitted successfully', rating });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  