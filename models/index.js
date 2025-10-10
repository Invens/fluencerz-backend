// models/index.js
const Sequelize = require('sequelize');
const sequelize = require('../config/db');

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

/* =========================
 * Load Models
 * ========================= */
db.User                       = require('./user.model')(sequelize, Sequelize);
db.Brand                      = require('./brand.model')(sequelize, Sequelize);
db.Influencer                 = require('./influencer.model')(sequelize, Sequelize);
db.Admin                      = require('./admin.model')(sequelize, Sequelize);

db.Campaign                   = require('./campaign.model')(sequelize, Sequelize);
db.CampaignApplication        = require('./CampaignApplication')(sequelize, Sequelize);
db.CampaignMessage            = require('./CampaignMessage')(sequelize, Sequelize);
db.CampaignMediaFile          = require('./CampaignMediaFile')(sequelize, Sequelize);
db.CampaignDeliverable        = require('./CampaignDeliverable')(sequelize, Sequelize);

db.CollabRequest              = require('./collab_request.model')(sequelize, Sequelize);
db.Payment                    = require('./payment.model')(sequelize, Sequelize);
db.Notification               = require('./notification.model')(sequelize, Sequelize);
db.Rating                     = require('./rating.model')(sequelize, Sequelize);

db.InfluencerInstagramAccount = require('./InfluencerInstagramAccount.model')(sequelize, Sequelize);
db.DriveFile                  = require('./DriveFile')(sequelize, Sequelize);

// Reporting system
db.ReportThread               = require('./ReportThread')(sequelize, Sequelize);
db.ReportEntry                = require('./ReportEntry')(sequelize, Sequelize);
db.ReportComment              = require('./ReportComment')(sequelize, Sequelize);

/* =========================
 * Associations
 * ========================= */

/* ---- Auth ↔ Entities ---- */
db.User.hasOne(db.Brand,        { foreignKey: 'auth_user_id' });
db.User.hasOne(db.Influencer,   { foreignKey: 'auth_user_id' });
db.Brand.belongsTo(db.User,     { foreignKey: 'auth_user_id' });
db.Influencer.belongsTo(db.User,{ foreignKey: 'auth_user_id' });

/* ---- Brand ↔ Campaign ---- */
db.Brand.hasMany(db.Campaign,   { foreignKey: 'brand_id' });
db.Campaign.belongsTo(db.Brand, { foreignKey: 'brand_id' });

/* ---- Campaign ↔ Applications ---- */
db.Campaign.hasMany(db.CampaignApplication,   { foreignKey: 'campaign_id' });
db.CampaignApplication.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

db.Influencer.hasMany(db.CampaignApplication, { foreignKey: 'influencer_id' });
db.CampaignApplication.belongsTo(db.Influencer,{ foreignKey: 'influencer_id' });

/* ---- Campaign ↔ Messages ---- */
db.Campaign.hasMany(db.CampaignMessage,       { foreignKey: 'campaign_id' });
db.CampaignMessage.belongsTo(db.Campaign,     { foreignKey: 'campaign_id' });

// Optional (sender convenience)
db.CampaignMessage.belongsTo(db.Brand,        { foreignKey: 'sender_id', constraints: false, as: 'SenderBrand' });
db.CampaignMessage.belongsTo(db.Influencer,   { foreignKey: 'sender_id', constraints: false, as: 'SenderInfluencer' });
db.Brand.hasMany(db.CampaignMessage,          { foreignKey: 'sender_id', constraints: false, scope: { sender_type: 'brand' } });
db.Influencer.hasMany(db.CampaignMessage,     { foreignKey: 'sender_id', constraints: false, scope: { sender_type: 'influencer' } });

/* ---- Campaign ↔ Media Files (uploader can be brand or influencer) ---- */
db.Campaign.hasMany(db.CampaignMediaFile,     { foreignKey: 'campaign_id' });
db.CampaignMediaFile.belongsTo(db.Campaign,   { foreignKey: 'campaign_id' });

db.Brand.hasMany(db.CampaignMediaFile,        { foreignKey: 'uploader_id', constraints: false, scope: { uploader_type: 'brand' } });
db.CampaignMediaFile.belongsTo(db.Brand,      { foreignKey: 'uploader_id', constraints: false });

db.Influencer.hasMany(db.CampaignMediaFile,   { foreignKey: 'uploader_id', constraints: false, scope: { uploader_type: 'influencer' } });
db.CampaignMediaFile.belongsTo(db.Influencer, { foreignKey: 'uploader_id', constraints: false });

/* ---- Campaign ↔ Deliverables ---- */
db.Campaign.hasMany(db.CampaignDeliverable,   { foreignKey: 'campaign_id', as: 'deliverables' });
db.CampaignDeliverable.belongsTo(db.Campaign, { foreignKey: 'campaign_id' });

db.Influencer.hasMany(db.CampaignDeliverable, { foreignKey: 'influencer_id' });
db.CampaignDeliverable.belongsTo(db.Influencer,{ foreignKey: 'influencer_id' });

/* ---- Campaign ↔ Payment / Rating ---- */
db.Campaign.hasOne(db.Payment,                { foreignKey: 'campaign_id' });
db.Payment.belongsTo(db.Campaign,             { foreignKey: 'campaign_id' });

db.Campaign.hasOne(db.Rating,                 { foreignKey: 'campaign_id' });
db.Rating.belongsTo(db.Campaign,              { foreignKey: 'campaign_id' });

/* ---- CollabRequest ↔ Entities ---- */
db.Brand.hasMany(db.CollabRequest,            { foreignKey: 'brand_id' });
db.Influencer.hasMany(db.CollabRequest,       { foreignKey: 'influencer_id' });
db.CollabRequest.belongsTo(db.Brand,          { foreignKey: 'brand_id' });
db.CollabRequest.belongsTo(db.Influencer,     { foreignKey: 'influencer_id' });

/* ---- DriveFile ↔ Campaign / Influencer ---- */
db.Campaign.hasMany(db.DriveFile,             { foreignKey: 'campaign_id', as: 'drive_files' });
db.DriveFile.belongsTo(db.Campaign,           { foreignKey: 'campaign_id' });

db.Influencer.hasMany(db.DriveFile,           { foreignKey: 'influencer_id', as: 'drive_files' });
db.DriveFile.belongsTo(db.Influencer,         { foreignKey: 'influencer_id' });

/* ---- Influencer ↔ Instagram (1:1) ---- */
db.Influencer.hasOne(db.InfluencerInstagramAccount, {
  foreignKey: 'influencer_id',
  as: 'instagramAccount'
});
db.InfluencerInstagramAccount.belongsTo(db.Influencer, {
  foreignKey: 'influencer_id',
  as: 'influencer'
});

/* =========================
 * NEW: Reporting associations (DB-aligned)
 * ========================= */
// ReportThread ↔ Campaign / Brand / Influencer
db.Campaign.hasMany(db.ReportThread,      { foreignKey: 'campaign_id',   as: 'report_threads' });
db.ReportThread.belongsTo(db.Campaign,    { foreignKey: 'campaign_id' });

db.Brand.hasMany(db.ReportThread,         { foreignKey: 'brand_id' });
db.ReportThread.belongsTo(db.Brand,       { foreignKey: 'brand_id' });

db.Influencer.hasMany(db.ReportThread,    { foreignKey: 'influencer_id', as: 'report_threads' });
db.ReportThread.belongsTo(db.Influencer,  { foreignKey: 'influencer_id' });

// ReportThread ↔ ReportEntry (alias: 'entries')
db.ReportThread.hasMany(db.ReportEntry,   { foreignKey: 'thread_id', as: 'entries' });
db.ReportEntry.belongsTo(db.ReportThread, { foreignKey: 'thread_id', as: 'thread' });

// ReportThread ↔ ReportComment (alias: 'comments')
db.ReportThread.hasMany(db.ReportComment, { foreignKey: 'thread_id', as: 'comments' });
db.ReportComment.belongsTo(db.ReportThread,{ foreignKey: 'thread_id', as: 'thread' });

// ⚠️ IMPORTANT: Do NOT add these (their columns don't exist on report_entries):
// db.ReportEntry.belongsTo(db.Influencer, { foreignKey: 'influencer_id' });
// db.ReportEntry.belongsTo(db.Campaign,   { foreignKey: 'campaign_id' });

/* =========================
 * Export
 * ========================= */
module.exports = db;
