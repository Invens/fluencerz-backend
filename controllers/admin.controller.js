const  db = require('../models');
const { Sequelize } = require('sequelize');

exports.createCampaign = async (req, res) => {
    try {
      const { collab_request_id, deliverables, start_date, end_date, quotation_amount } = req.body;
  
      const request = await db.CollabRequest.findByPk(collab_request_id);
      if (!request || request.status !== 'approved') {
        return res.status(400).json({ message: 'Collab request must be approved before campaign creation.' });
      }
  
      const existing = await db.Campaign.findOne({ where: { collab_request_id } });
      if (existing) {
        return res.status(400).json({ message: 'Campaign already exists for this request.' });
      }
  
      const campaign = await db.Campaign.create({
        collab_request_id,
        deliverables,
        start_date,
        end_date,
        quotation_amount
      });
  
      res.status(201).json({ message: 'Campaign created with quotation.', campaign });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  exports.getAllCampaigns = async (req, res) => {
    try {
      const campaigns = await db.Campaign.findAll({
        include: [
          {
            model: db.CollabRequest,
            include: [
              { model: db.Brand, attributes: ['company_name', 'email'] },
              { model: db.Influencer, attributes: ['full_name', 'email'] }
            ]
          }
        ],
        order: [['created_at', 'DESC']]
      });
  
      res.status(200).json(campaigns);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  
  
  exports.getAllCollabRequests = async (req, res) => {
    try {
      const requests = await db.CollabRequest.findAll({
        include: [
          { model: db.Brand, attributes: ['company_name', 'email'] },
          { model: db.Influencer, attributes: ['full_name', 'email'] }
        ],
        order: [['created_at', 'DESC']]
      });
  
      res.status(200).json(requests);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  exports.getBrandInsights = async (req, res) => {
    try {
      const brands = await db.Brand.findAll({
        attributes: [
          'id',
          'company_name',
          'email',
          [db.Sequelize.fn('COUNT', db.Sequelize.col('collab_requests.id')), 'collab_count']
        ],
        include: [
          {
            model: db.CollabRequest,
            attributes: [],
          }
        ],
        group: ['Brand.id'],
        order: [[db.Sequelize.literal('collab_count'), 'DESC']]
      });
  
      res.json(brands);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  
  exports.getInfluencerInsights = async (req, res) => {
    try {
      const influencers = await db.Influencer.findAll({
        attributes: [
          'id',
          'full_name',
          'email',
          [db.Sequelize.literal(`(
            SELECT COUNT(*)
            FROM campaigns AS c
            JOIN collab_requests cr ON cr.id = c.collab_request_id
            WHERE cr.influencer_id = Influencer.id
          )`), 'campaign_count'],
          [db.Sequelize.literal(`(
            SELECT AVG(r.rating_value)
            FROM ratings r
            JOIN campaigns c ON c.id = r.campaign_id
            JOIN collab_requests cr ON cr.id = c.collab_request_id
            WHERE cr.influencer_id = Influencer.id
          )`), 'average_rating']
        ],
        order: [
          [db.Sequelize.literal('average_rating IS NULL'), 'ASC'],
          [db.Sequelize.literal('average_rating'), 'DESC']
        ]
              });
  
      res.json(influencers);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };
  
  
exports.getAdminStats = async (req, res) => {
    try {
      const [brands, influencers, collabs, campaigns] = await Promise.all([
        db.Brand.count(),
        db.Influencer.count(),
        db.CollabRequest.findAll({
          attributes: [
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
            [Sequelize.fn('SUM', Sequelize.literal("status = 'pending'")), 'pending'],
            [Sequelize.fn('SUM', Sequelize.literal("status = 'approved'")), 'approved'],
            [Sequelize.fn('SUM', Sequelize.literal("status = 'rejected'")), 'rejected']
          ],
          raw: true
        }),
        db.Campaign.findAll({
          attributes: [
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
            [Sequelize.fn('SUM', Sequelize.col('quotation_amount')), 'total_quotation']
          ],
          raw: true
        })
      ]);
  
      const collabStats = collabs[0];
      const campaignStats = campaigns[0];
  
      res.status(200).json({
        brands,
        influencers,
        collab_requests: {
          total: Number(collabStats.total),
          pending: Number(collabStats.pending),
          approved: Number(collabStats.approved),
          rejected: Number(collabStats.rejected)
        },
        campaigns: {
          total: Number(campaignStats.total),
          total_quotation: Number(campaignStats.total_quotation) || 0
        }
      });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };