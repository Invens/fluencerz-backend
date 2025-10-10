// models/DriveFile.js
module.exports = (sequelize, DataTypes) => {
  const DriveFile = sequelize.define('DriveFile', {
    campaign_id: { type: DataTypes.BIGINT, allowNull: false, index: true },
    influencer_id: { type: DataTypes.BIGINT, allowNull: false, index: true },
    uploaded_by_role: {
      type: DataTypes.ENUM('influencer','brand'),
      allowNull: false,
      defaultValue: 'influencer'
    },

    // Bundle & version chain
    bundle_id: { type: DataTypes.STRING },         // all files uploaded in one go share this
    parent_file_id: { type: DataTypes.BIGINT },    // version chain root
    version: { type: DataTypes.INTEGER, defaultValue: 1 },

    // File info
    title: { type: DataTypes.STRING, allowNull: false },
    original_name: { type: DataTypes.STRING, allowNull: false },
    file_path: { type: DataTypes.STRING, allowNull: false },
    mime_type: { type: DataTypes.STRING },
    file_size: { type: DataTypes.BIGINT },

    // Labels and metadata (free-form)
    category: { type: DataTypes.STRING, defaultValue: 'asset' }, // image, video, doc, zip, etc
    caption: { type: DataTypes.TEXT },
    tags: { type: DataTypes.JSON, defaultValue: [] },            // ["first-draft","hero"]
    notes: { type: DataTypes.TEXT },

    // Review lifecycle
    status: {
      type: DataTypes.ENUM('submitted','needs_changes','approved','rejected'),
      defaultValue: 'submitted'
    },
    review_note: { type: DataTypes.TEXT },
    reviewed_by: { type: DataTypes.BIGINT },
    reviewed_at: { type: DataTypes.DATE },

    // Thread enhancements
    is_root: { type: DataTypes.BOOLEAN, defaultValue: false }, // True for first file in thread
    thread_status: {
      type: DataTypes.ENUM('open', 'closed_approved', 'closed_rejected', 'verified'),
      defaultValue: 'open'
    },

    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      onUpdate: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_at: { type: DataTypes.DATE },
  }, {
    tableName: 'DriveFiles',
    underscored: true,
    paranoid: true,
    timestamps: false,
  });

  DriveFile.associate = (models) => {
    DriveFile.belongsTo(models.Campaign, { foreignKey: 'campaign_id' });
    DriveFile.belongsTo(models.Influencer, { foreignKey: 'influencer_id' });
  };

  // New: Class method to verify thread
  DriveFile.verifiedThread = async (bundleId) => {
    const threadFiles = await DriveFile.findAll({ where: { bundle_id: bundleId } });
    const hasOpenChanges = threadFiles.some(f => f.status === 'needs_changes' || f.status === 'rejected');
    const allApproved = threadFiles.every(f => f.status === 'approved' || f.status === 'rejected');
    if (!hasOpenChanges && allApproved) {
      await DriveFile.update({ thread_status: 'verified' }, { where: { bundle_id: bundleId } });
      return true;
    }
    return false;
  };

  return DriveFile;
};