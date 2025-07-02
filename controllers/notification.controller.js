const db = require('../models');

// 📥 Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const { userType, id } = req.user; // coming from JWT middleware

    const notifications = await db.Notification.findAll({
      where: {
        user_type: userType,
        user_id: id
      },
      order: [['created_at', 'DESC']]
    });

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await db.Notification.findByPk(id);
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });

    notification.is_read = true;
    await notification.save();

    res.json({ message: 'Marked as read.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
