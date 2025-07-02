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

// Define associations
db.Brand.hasMany(db.CollabRequest, { foreignKey: 'brand_id' });
db.Influencer.hasMany(db.CollabRequest, { foreignKey: 'influencer_id' });
db.CollabRequest.belongsTo(db.Brand, { foreignKey: 'brand_id' });
db.CollabRequest.belongsTo(db.Influencer, { foreignKey: 'influencer_id' });

db.CollabRequest.hasOne(db.Campaign, { foreignKey: 'collab_request_id' });
db.Campaign.belongsTo(db.CollabRequest, { foreignKey: 'collab_request_id' });

db.Campaign.hasOne(db.Payment, { foreignKey: 'campaign_id' });
db.Payment.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

db.Campaign.hasOne(db.Rating, { foreignKey: 'campaign_id' });
db.Rating.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });


module.exports = db;
