// controllers/drive.controller.js
const { DriveFile, Campaign, CampaignApplication, Influencer } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

async function ensureInfluencerApprovedOnCampaign(influencerId, campaignId) {
  const row = await CampaignApplication.findOne({
    where: {
      influencer_id: influencerId,
      campaign_id: campaignId,
      status: { [Op.in]: ['approved', 'brand_approved'] }
    }
  });
  if (!row) throw new Error('Not authorized for this campaign');
}

async function ensureBrandOwnsCampaign(brandId, campaignId) {
  const ok = await Campaign.findOne({ where: { id: campaignId, brand_id: brandId } });
  if (!ok) throw new Error('Not authorized');
}

function categoryFromMime(mime) {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime === 'application/zip' || mime === 'application/x-zip-compressed') return 'zip';
  if (mime === 'application/pdf') return 'pdf';
  if (mime?.includes('word') || mime?.includes('msword')) return 'doc';
  if (mime?.includes('excel') || mime?.includes('spreadsheet')) return 'sheet';
  if (mime?.startsWith('text/')) return 'text';
  return 'asset';
}

/* ===========================
   INFLUENCER UPLOAD / REPLACE
   =========================== */

// POST /influencer/campaigns/:id/drive (multi)
exports.uploadAssets = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const campaignId = Number(req.params.id);
    await ensureInfluencerApprovedOnCampaign(influencerId, campaignId);

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const bundleId = uuidv4();
    const title = req.body.title || 'Assets';
    const caption = req.body.caption || null;
    const tags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : (() => { try { return JSON.parse(req.body.tags); } catch { return []; } })()) : [];
    const notes = req.body.notes || null;

    let isFirst = true;
    const created = [];
    for (const file of req.files) {
      const last = await DriveFile.findOne({
        where: {
          campaign_id: campaignId,
          influencer_id: influencerId,
          title,
          original_name: file.originalname
        },
        order: [['version', 'DESC']]
      });

      const version = last ? last.version + 1 : 1;
      const parent_file_id = last ? (last.parent_file_id || last.id) : null;

      const rec = await DriveFile.create({
        campaign_id: campaignId,
        influencer_id: influencerId,
        uploaded_by_role: 'influencer',
        bundle_id: bundleId,
        title,
        original_name: file.originalname,
        file_path: file.path.replace(/\\/g, '/').replace(/^.*uploads/, '/uploads'),
        mime_type: file.mimetype,
        file_size: file.size,
        version,
        parent_file_id,
        category: categoryFromMime(file.mimetype),
        caption,
        tags,
        notes,
        status: 'submitted',
        is_root: isFirst,
        thread_status: 'open'
      });
      created.push(rec);
      isFirst = false;
    }

    res.json({ success: true, data: { bundle_id: bundleId, files: created } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// POST /influencer/drive/:fileId/replace
exports.replaceAsset = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const fileId = Number(req.params.fileId);
    const existing = await DriveFile.findByPk(fileId);
    if (!existing) return res.status(404).json({ success: false, message: 'File not found' });

    await ensureInfluencerApprovedOnCampaign(influencerId, existing.campaign_id);

    if (existing.influencer_id && existing.influencer_id !== influencerId) {
      return res.status(403).json({ success: false, message: 'Not authorized for this file' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    if (!existing.influencer_id) {
      // normally shouldn't happen now that brand must select an influencer
      existing.influencer_id = influencerId;
      await existing.save();
    }

    const last = await DriveFile.findOne({
      where: {
        campaign_id: existing.campaign_id,
        influencer_id: influencerId,
        title: existing.title,
        original_name: existing.original_name,
        [Op.or]: [{ id: existing.parent_file_id || existing.id }, { parent_file_id: existing.parent_file_id || existing.id }]
      },
      order: [['version','DESC']]
    });

    const version = last ? last.version + 1 : (existing.version + 1);
    const parent_file_id = existing.parent_file_id || existing.id;

    const rec = await DriveFile.create({
      campaign_id: existing.campaign_id,
      influencer_id: influencerId,
      uploaded_by_role: 'influencer',
      bundle_id: existing.bundle_id,
      parent_file_id,
      version,
      title: existing.title,
      original_name: existing.original_name,
      file_path: req.file.path.replace(/\\/g, '/').replace(/^.*uploads/, '/uploads'),
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      category: categoryFromMime(req.file.mimetype),
      caption: req.body.caption ?? existing.caption,
      tags: existing.tags,
      notes: req.body.notes ?? existing.notes,
      status: 'submitted',
      review_note: null,
      reviewed_at: null,
      reviewed_by: null,
      is_root: false,
      thread_status: existing.thread_status
    });

    res.json({ success: true, data: rec });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ===========================
   BRAND: INFLUENCERS & LISTING
   =========================== */

// GET /brand/campaigns/:id/drive/influencers
exports.listCampaignInfluencers = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = Number(req.params.id);
    await ensureBrandOwnsCampaign(brandId, campaignId);

    const apps = await CampaignApplication.findAll({
      where: { campaign_id: campaignId, status: { [Op.in]: ['approved', 'brand_approved'] } },
      include: [{ model: Influencer }]
    });

    const infs = apps
      .map(a => a.Influencer)
      .filter(Boolean)
      .map(i => ({
        id: i.id,
        full_name: i.full_name,
        niche: i.niche,
        profile_image: i.profile_image || null,
      }))
      // dedupe in case of duplicates
      .reduce((acc, cur) => (acc.find(x => x.id === cur.id) ? acc : acc.concat(cur)), []);

    res.json({ success: true, data: infs });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// Enhanced: GET /brand/campaigns/:id/drive?influencer_id=123[&status=...&category=...&q=...&thread_status=...]
exports.listAssets = async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const role = req.user.role;

    if (role === 'brand') {
      await ensureBrandOwnsCampaign(req.user.id, campaignId);
      // BRAND: influencer_id is REQUIRED
      const infParam = req.query.influencer_id;
      if (!infParam) {
        return res.status(400).json({ success: false, message: 'influencer_id is required' });
      }
    } else if (role === 'influencer') {
      await ensureInfluencerApprovedOnCampaign(req.user.id, campaignId);
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { q, status, category, page = 1, size = 20, influencer_id, thread_status } = req.query;
    const where = { campaign_id: campaignId };

    if (role === 'brand') {
      where.influencer_id = Number(influencer_id);
    } else if (role === 'influencer') {
      // influencer sees only their own
      where.influencer_id = req.user.id;
    }

    if (status) where.status = status;
    if (category) where.category = category;
    if (thread_status) where.thread_status = thread_status;
    if (q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${q}%` } },
        { original_name: { [Op.like]: `%${q}%` } }
      ];
    }

    const offset = (Number(page) - 1) * Number(size);
    const { rows: allFiles, count: totalFiles } = await DriveFile.findAndCountAll({
      where,
      include: [{ model: Influencer }], // ensure model association exists (no alias), or set alias accordingly
      order: [['created_at', 'DESC']],
      limit: Number(size),
      offset
    });

    // Group by thread (bundle_id), add badges/history summary
    const threads = allFiles.reduce((acc, file) => {
      const threadId = file.bundle_id;
      if (!acc[threadId]) {
        acc[threadId] = {
          id: threadId,
          title: file.title,
          status: file.thread_status,
          files: [],
          history_verified: file.thread_status === 'verified',
          badge: file.thread_status === 'closed_approved' ? 'approved' : 
                 file.thread_status === 'closed_rejected' ? 'rejected' : 
                 file.status === 'needs_changes' ? 'changes' : null,
          created_at: file.created_at
        };
      }
      acc[threadId].files.push(file);
      return acc;
    }, {});

    const threadList = Object.values(threads).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const paginated = threadList.slice(offset, offset + Number(size));

    res.json({ 
      success: true, 
      data: paginated, 
      total: threadList.length, // Threads total
      total_files: totalFiles,
      page: Number(page) 
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ===========================
   BRAND: REQUEST (REQUIRES INFLUENCER)
   =========================== */

// POST /brand/campaigns/:id/drive/request
exports.requestAsset = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = Number(req.params.id);

    await ensureBrandOwnsCampaign(brandId, campaignId);

    const { title = 'Requested Asset', notes, category = 'asset', tags = [], influencer_id } = req.body;

    // REQUIRE influencer_id
    if (influencer_id === undefined || influencer_id === null || influencer_id === '' || isNaN(Number(influencer_id))) {
      return res.status(400).json({ success: false, message: 'influencer_id is required' });
    }
    const targetInfluencerId = Number(influencer_id);
    await ensureInfluencerApprovedOnCampaign(targetInfluencerId, campaignId);

    const bundleId = uuidv4();

    const createData = {
      campaign_id: campaignId,
      influencer_id: targetInfluencerId,
      uploaded_by_role: 'brand',
      bundle_id: bundleId,
      title,
      original_name: `${title}.requested`,
      file_path: '/requested-placeholder', // dummy path; influencer will upload actual file
      mime_type: null,
      file_size: 0,
      version: 1,
      parent_file_id: null,
      category,
      caption: null,
      tags: Array.isArray(tags) ? tags : (() => { try { return JSON.parse(tags || '[]'); } catch { return []; } })(),
      notes,
      status: 'submitted',
      is_root: true,
      thread_status: 'open'
    };

    const rec = await DriveFile.create(createData);
    const responseData = { ...rec.get(), file_path: null }; // hide placeholder path
    res.json({ success: true, data: responseData });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ===========================
   REVIEW & VERSIONS & THREADS
   =========================== */

exports.reviewAssets = async (req, res) => {
  try {
    const brandId = req.user.id;
    const { file_ids = [], decision, note, spawn_new_thread = false } = req.body;
    if (!Array.isArray(file_ids) || file_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'file_ids required' });
    }
    const allowed = new Set(['approved','needs_changes','rejected']);
    if (!allowed.has(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid decision' });
    }

    const files = await DriveFile.findAll({ 
      where: { id: file_ids },
      include: [{ model: Influencer }]
    });
    if (files.length === 0) return res.status(404).json({ success: false, message: 'Files not found' });

    const bundleId = files[0].bundle_id; // Assume all in same thread
    for (const f of files) {
      await ensureBrandOwnsCampaign(brandId, f.campaign_id);
      const now = new Date();
      await f.update({ 
        status: decision, 
        review_note: note || null, 
        reviewed_by: brandId, 
        reviewed_at: now 
      });
    }

    // Thread logic
    let threadStatus = 'open';
    let newThreadData = null;
    if (decision === 'approved') {
      threadStatus = 'closed_approved';
      if (spawn_new_thread) {
        // Auto-create new thread: Copy root, increment title (e.g., "v2"), new bundle_id
        const rootFile = files.find(f => f.is_root) || files[0];
        const newBundleId = uuidv4();
        const newTitle = `${rootFile.title} - v${files.length + 1}`;
        const newRec = await DriveFile.create({
          ...rootFile.get({ plain: true }), // Copy metadata
          id: undefined, // New ID
          bundle_id: newBundleId,
          title: newTitle,
          is_root: true,
          version: 1,
          parent_file_id: null,
          status: 'submitted', // Fresh
          thread_status: 'open',
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
          created_at: new Date(),
          updated_at: new Date()
        });
        newThreadData = { bundle_id: newBundleId, file: newRec };
      }
    } else if (decision === 'rejected') {
      threadStatus = 'closed_rejected';
    } else if (decision === 'needs_changes') {
      // Show changes: Note is already set; thread stays open
    }
    await DriveFile.update({ thread_status: threadStatus }, { where: { bundle_id: bundleId } });

    // Trigger verification for whole thread
    const verified = await DriveFile.verifiedThread(bundleId);

    res.json({ success: true, data: { files, thread_status: threadStatus, verified, new_thread: newThreadData } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

async function authorizeVersionView(user, file) {
  if (!file) throw new Error('File not found');

  if (user.role === 'brand') {
    await ensureBrandOwnsCampaign(user.id, file.campaign_id);
    return;
  }

  if (user.role === 'influencer') {
    await ensureInfluencerApprovedOnCampaign(user.id, file.campaign_id);
    if (file.influencer_id && file.influencer_id !== user.id) throw new Error('Not authorized');
    return;
  }
  throw new Error('Not authorized');
}

exports.getVersionChain = async (req, res) => {
  try {
    const fileId = Number(req.params.fileId);
    const file = await DriveFile.findByPk(fileId);
    await authorizeVersionView(req.user, file);

    const rootId = file.parent_file_id || file.id;
    const versions = await DriveFile.findAll({
      where: { [Op.or]: [{ id: rootId }, { parent_file_id: rootId }] },
      order: [['version', 'ASC'], ['created_at','ASC']]
    });

    res.json({ success: true, data: { root_id: rootId, current_id: file.id, versions } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

exports.restoreVersion = async (req, res) => {
  try {
    const fileId = Number(req.params.fileId);
    const source = await DriveFile.findByPk(fileId);
    await authorizeVersionView(req.user, source);

    if (req.user.role !== 'influencer') throw new Error('Only influencer can restore');
    if (source.influencer_id && source.influencer_id !== req.user.id) throw new Error('Not authorized for this file');

    const rootId = source.parent_file_id || source.id;
    const latest = await DriveFile.findOne({
      where: { [Op.or]: [{ id: rootId }, { parent_file_id: rootId }] },
      order: [['version','DESC']]
    });
    if (latest.status === 'approved') throw new Error('Latest version approved; cannot restore');

    const rec = await DriveFile.create({
      campaign_id: source.campaign_id,
      influencer_id: source.influencer_id,
      uploaded_by_role: 'influencer',
      bundle_id: source.bundle_id,
      parent_file_id: rootId,
      version: latest.version + 1,
      title: source.title,
      original_name: source.original_name,
      file_path: source.file_path,
      mime_type: source.mime_type,
      file_size: source.file_size,
      category: source.category,
      caption: source.caption,
      tags: source.tags,
      notes: (req.body?.notes ?? source.notes),
      status: 'submitted',
      review_note: null,
      reviewed_at: null,
      reviewed_by: null,
      is_root: false,
      thread_status: source.thread_status
    });

    res.json({ success: true, data: rec });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

// New: GET /drive/thread/:bundleId (full thread view with history)
exports.getThread = async (req, res) => {
  try {
    const bundleId = req.params.bundleId;
    const thread = await DriveFile.findAll({
      where: { bundle_id: bundleId },
      include: [{ model: Influencer }],
      order: [['version', 'ASC'], ['created_at', 'ASC']]
    });
    if (thread.length === 0) return res.status(404).json({ success: false, message: 'Thread not found' });

    // Authorize via first file
    await authorizeVersionView(req.user, thread[0]);

    // Compute overall status/badges
    const verified = await DriveFile.verifiedThread(bundleId);
    const history = thread.map(f => ({
      ...f.get(),
      badge: f.status === 'approved' ? 'approved' : f.status === 'rejected' ? 'rejected' : f.review_note ? 'changes' : 'submitted'
    }));

    res.json({ 
      success: true, 
      data: { 
        thread_id: bundleId, 
        status: thread[0].thread_status,
        verified,
        history 
      } 
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};