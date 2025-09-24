const Sequelize = require('sequelize');
const sequelize = require('../config/db');

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import Models
db.Influencer = require('./influencer.model')(sequelize, Sequelize);
db.Brand = require('./brand.model')(sequelize, Sequelize);
db.Admin = require('./admin.model')(sequelize, Sequelize);
db.CollabRequest = require('./collab_request.model')(sequelize, Sequelize);
db.Campaign = require('./campaign.model')(sequelize, Sequelize);
db.Payment = require('./payment.model')(sequelize, Sequelize);
db.Notification = require('./notification.model')(sequelize, Sequelize);
db.Rating = require('./rating.model')(sequelize, Sequelize);
db.InfluencerInstagramAccount = require('./InfluencerInstagramAccount.model')(sequelize, Sequelize);
db.CampaignApplication= require('./CampaignApplication')(sequelize, Sequelize);
db.CampaignMessage = require('./CampaignMessage')(sequelize, Sequelize);
db.CampaignMediaFile = require('./CampaignMediaFile')(sequelize, Sequelize);
db.CampaignDeliverable = require('./CampaignDeliverable')(sequelize, Sequelize);


// CampaignMessage ↔ Brand
db.CampaignMessage.belongsTo(db.Brand, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'SenderBrand'
});

// CampaignMessage ↔ Influencer
db.CampaignMessage.belongsTo(db.Influencer, {
  foreignKey: 'sender_id',
  constraints: false,
  as: 'SenderInfluencer'
});

// In models/index.js


// Brand ↔ Campaign
db.Brand.hasMany(db.Campaign, { foreignKey: 'brand_id' });
db.Campaign.belongsTo(db.Brand, { foreignKey: 'brand_id' });

// Campaign ↔ Deliverables
db.Campaign.hasMany(db.CampaignDeliverable, { foreignKey: 'campaign_id', as: 'deliverables' });
db.CampaignDeliverable.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

// Influencer ↔ Deliverables
db.Influencer.hasMany(db.CampaignDeliverable, { foreignKey: 'influencer_id' });
db.CampaignDeliverable.belongsTo(db.Influencer, { foreignKey: 'influencer_id' });

// Media uploader can be Brand
db.Brand.hasMany(db.CampaignMediaFile, { foreignKey: 'uploader_id', constraints: false, scope: { uploader_type: 'brand' } });
db.CampaignMediaFile.belongsTo(db.Brand, { foreignKey: 'uploader_id', constraints: false });

// Media uploader can also be Influencer
db.Influencer.hasMany(db.CampaignMediaFile, { foreignKey: 'uploader_id', constraints: false, scope: { uploader_type: 'influencer' } });
db.CampaignMediaFile.belongsTo(db.Influencer, { foreignKey: 'uploader_id', constraints: false });


// Define associations
db.Brand.hasMany(db.CollabRequest, { foreignKey: 'brand_id' });
db.Influencer.hasMany(db.CollabRequest, { foreignKey: 'influencer_id' });
db.CollabRequest.belongsTo(db.Brand, { foreignKey: 'brand_id' });
db.CollabRequest.belongsTo(db.Influencer, { foreignKey: 'influencer_id' });

// db.CollabRequest.hasOne(db.Campaign, { foreignKey: 'collab_request_id' });
// db.Campaign.belongsTo(db.CollabRequest, { foreignKey: 'collab_request_id' });

db.Campaign.hasOne(db.Payment, { foreignKey: 'campaign_id' });
db.Payment.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

db.Campaign.hasOne(db.Rating, { foreignKey: 'campaign_id' });
db.Rating.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

// Campaign ↔ Brand
db.Brand.hasMany(db.Campaign, { foreignKey: 'brand_id' });
db.Campaign.belongsTo(db.Brand, { foreignKey: 'brand_id' });

// Campaign ↔ Applications
db.Campaign.hasMany(db.CampaignApplication, { foreignKey: 'campaign_id' });
db.CampaignApplication.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

db.Influencer.hasMany(db.CampaignApplication, { foreignKey: 'influencer_id' });
db.CampaignApplication.belongsTo(db.Influencer, { foreignKey: 'influencer_id' });

db.Campaign.hasMany(db.CampaignMessage, { foreignKey: 'campaign_id' });
db.CampaignMessage.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

// Not mandatory, but useful for querying sender/receiver-specific messages
db.Brand.hasMany(db.CampaignMessage, { foreignKey: 'sender_id', constraints: false, scope: { sender_type: 'brand' } });
db.Influencer.hasMany(db.CampaignMessage, { foreignKey: 'sender_id', constraints: false, scope: { sender_type: 'influencer' } });

db.Campaign.hasMany(db.CampaignMediaFile, { foreignKey: 'campaign_id' });
db.CampaignMediaFile.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

// ✅ Influencer ↔ Instagram Account (1:1)
db.Influencer.hasOne(db.InfluencerInstagramAccount, { 
  foreignKey: 'influencer_id',
  as: 'instagramAccount'
});
db.InfluencerInstagramAccount.belongsTo(db.Influencer, { 
  foreignKey: 'influencer_id',
  as: 'influencer'
});

module.exports = db;
