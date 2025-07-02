const db = require('../models');

// 📤 Brand sends request to influencer
exports.sendRequest = async (req, res) => {
  try {
    const brand_id = req.user.id;
    const { influencer_id, request_message } = req.body;

    if (!brand_id || !influencer_id) {
      return res.status(400).json({ message: 'Missing brand or influencer ID' });
    }

    // Check for existing request
    const exists = await db.CollabRequest.findOne({
      where: { brand_id, influencer_id, status: 'pending' }
    });

    if (exists) {
      return res.status(400).json({ message: 'Request already sent and pending.' });
    }

    const newRequest = await db.CollabRequest.create({
      brand_id,
      influencer_id,
      request_message
    });

    res.status(201).json({ message: 'Request sent successfully.', request: newRequest });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 👑 Admin approves or rejects the request
exports.updateRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_response } = req.body;

    const request = await db.CollabRequest.findByPk(id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    request.status = status;
    request.admin_response = admin_response;
    await request.save();

    // 📩 Send notification to influencer
    await db.Notification.create({
      user_type: 'influencer',
      user_id: request.influencer_id,
      message: `Your collaboration request has been ${status}.`
    });

    res.json({ message: `Request ${status} successfully.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 👑 Admin fetches all collab requests
exports.getAllRequests = async (req, res) => {
  try {
    const requests = await db.CollabRequest.findAll({
      include: [
        { model: db.Brand, attributes: ['company_name'] },
        { model: db.Influencer, attributes: ['full_name', 'email'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
