// controllers/reporting.controller.js
const { Op } = require('sequelize');
const db = require('../models');

const {
  Campaign,
  CampaignApplication,
  InfluencerInstagramAccount,
  ReportThread,
  ReportEntry,
  ReportComment,
} = db;

/* ===========================
   Helpers
   =========================== */

function parseJSON(maybeJson, def) {
  if (maybeJson === undefined || maybeJson === null) return def;
  if (typeof maybeJson === 'object') return maybeJson;
  try { return JSON.parse(maybeJson); } catch { return def; }
}

async function loadCampaignOrThrow(campaignId) {
  const c = await Campaign.findByPk(campaignId, { attributes: ['id', 'brand_id', 'title'] });
  if (!c) {
    const e = new Error('Campaign not found');
    e.status = 404;
    throw e;
  }
  return c;
}

async function ensureInfluencerApprovedOnCampaign(influencerId, campaignId) {
  const ok = await CampaignApplication.findOne({
    where: {
      influencer_id: influencerId,
      campaign_id: campaignId,
      status: { [Op.in]: ['approved', 'brand_approved'] }
    }
  });
  if (!ok) throw new Error('Not authorized for this campaign');
}

// ✅ brand owns campaign helper
async function ensureBrandOwnsCampaign(brandId, campaignId) {
  const campaign = await Campaign.findOne({ where: { id: campaignId, brand_id: brandId } });
  if (!campaign) {
    const e = new Error('Not authorized for this campaign');
    e.status = 403;
    throw e;
  }
  return campaign;
}

// returns: first entry id (version 1) and latest version/status for a thread
async function getThreadVersionInfo(threadId) {
  const first = await ReportEntry.findOne({
    where: { thread_id: threadId, version: 1 },
    order: [['id', 'ASC']]
  });
  const latest = await ReportEntry.findOne({
    where: { thread_id: threadId },
    order: [['version', 'DESC'], ['created_at', 'DESC']]
  });
  return {
    rootId: first?.id || null,
    latestVersion: latest?.version || 0,
    latestStatus: latest?.status || 'submitted'
  };
}

// expects media.insights.data: [{name, values:[{value}]}...]
function pickMetricsFromIgMedia(m) {
  const out = {};
  const items = m?.insights?.data || [];
  for (const i of items) {
    const raw = Array.isArray(i.values) && i.values[0] ? i.values[0].value : 0;
    const val = typeof raw === 'number' ? raw : Number(raw) || 0;
    out[i.name] = val;
  }
  return out;
}

// create or reuse the unique (campaign, brand, influencer) thread
async function getOrCreateThread({ campaignId, brandId, influencerId, setManual = false, setInstagram = false }) {
  let thread = await ReportThread.findOne({
    where: { campaign_id: campaignId, brand_id: brandId, influencer_id: influencerId }
  });

  if (!thread) {
    thread = await ReportThread.create({
      campaign_id: campaignId,
      brand_id: brandId,
      influencer_id: influencerId,
      has_manual: setManual ? 1 : 0,
      has_instagram: setInstagram ? 1 : 0,
      latest_status: 'submitted',
      latest_version: 0
    });
  } else {
    const updates = {};
    if (setManual && !thread.has_manual) updates.has_manual = 1;
    if (setInstagram && !thread.has_instagram) updates.has_instagram = 1;
    if (Object.keys(updates).length) await thread.update(updates);
  }
  return thread;
}

// map DB thread+entries → UI shape your brand page expects
function mapThreadForBrandUI(threadInstance) {
  const t = threadInstance.get ? threadInstance.get() : threadInstance;

  // derive a thread-level status the UI can display
  const status =
    t.latest_status === 'approved' ? 'closed_approved' :
    t.latest_status === 'rejected' ? 'closed_rejected' :
    t.latest_status === 'requested' ? 'open' : // keep open but it will show request cards
    'open';

  const type = t.has_instagram ? 'instagram' : (t.has_manual ? 'manual' : undefined);

  const files = (t.entries || []).map(e => {
    const entry = e.get ? e.get() : e;
    return {
      id: entry.id,
      version: entry.version,
      status: entry.status,
      notes: entry.notes,
      review_note: entry.review_note,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      // preview / content fields used by UI
      original_name: entry.ig_media_id ? `${entry.ig_media_type || 'POST'} ${entry.ig_media_id}` : (entry.submitted_by_role === 'brand' && entry.status === 'requested' ? 'Change Request' : 'Manual Entry'),
      preview_url: entry.ig_thumbnail || null,
      permalink: entry.ig_permalink || null,
      cover_image: entry.ig_thumbnail || null,
      title: entry.ig_media_type || entry.type || 'Entry',
      metrics: entry.metrics || {}
    };
  });

  return {
    id: t.id,
    title: `Report #${t.id}`,
    status,
    type,
    badge: null,
    history_verified: !!t.has_instagram,
    created_at: t.created_at,
    files
  };
}

/* ===========================
   Influencer: list my report threads in a campaign
   GET /influencer/campaigns/:id/reports
   =========================== */
exports.influencerListThreads = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const campaignId = Number(req.params.id);
    await ensureInfluencerApprovedOnCampaign(influencerId, campaignId);

    const threads = await ReportThread.findAll({
      where: { campaign_id: campaignId, influencer_id: influencerId },
      include: [{
        model: ReportEntry,
        as: 'entries',
        separate: true,
        order: [['version', 'ASC'], ['created_at', 'ASC']],
      }],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: threads });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ===========================
   Brand: list all report threads in a campaign (for review)
   GET /brand/campaigns/:id/reports?influencer_id=30
   =========================== */
exports.brandListThreads = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = Number(req.params.id);

    await ensureBrandOwnsCampaign(brandId, campaignId);

    const where = { campaign_id: campaignId };
    if (req.query.influencer_id) where.influencer_id = Number(req.query.influencer_id);

    const threads = await ReportThread.findAll({
      where,
      include: [{
        model: ReportEntry,
        as: 'entries',
        separate: true,
        order: [['version', 'ASC'], ['created_at', 'ASC']],
      }],
      order: [['created_at', 'DESC']]
    });

    // map to UI shape so brand page renders
    const data = threads.map(mapThreadForBrandUI);

    res.json({ success: true, data });
  } catch (e) {
    res.status(e.status || 400).json({ success: false, message: e.message });
  }
};

/* ===========================
   Submit MANUAL report (payload per your spec)
   POST /influencer/campaigns/:id/reports
   =========================== */
exports.submitManualReport = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const campaignId = Number(req.params.id || req.body.campaign_id);
    if (!campaignId) return res.status(400).json({ success: false, message: 'campaign_id missing' });

    await ensureInfluencerApprovedOnCampaign(influencerId, campaignId);
    const campaign = await loadCampaignOrThrow(campaignId);

    const { thread_id, notes = null, entry } = req.body;
    if (!entry || typeof entry !== 'object') {
      return res.status(400).json({ success: false, message: 'entry object is required' });
    }

    const metricsObj = typeof entry.metrics === 'object' ? entry.metrics : parseJSON(entry.metrics, {});
    const permalink  = entry.permalink || null;
    const coverImage = entry.cover_image || null;

    // Reuse thread if provided & authorized; otherwise use unique thread
    let thread = null;
    if (thread_id) {
      thread = await ReportThread.findByPk(thread_id);
      if (!thread || thread.influencer_id !== influencerId || thread.campaign_id !== campaignId) {
        return res.status(403).json({ success: false, message: 'Not authorized for this thread' });
      }
      if (!thread.has_manual) await thread.update({ has_manual: 1 });
    } else {
      thread = await getOrCreateThread({
        campaignId,
        brandId: campaign.brand_id,
        influencerId,
        setManual: true,
        setInstagram: false
      });
    }

    // Versioning
    const { rootId, latestVersion } = await getThreadVersionInfo(thread.id);
    const version = (latestVersion || 0) + 1;

    const created = await ReportEntry.create({
      thread_id: thread.id,
      parent_entry_id: rootId || null, // self-parent if first
      version,
      submitted_by_role: 'influencer',
      type: 'manual',
      metrics: metricsObj || {},
      notes,
      ig_permalink: permalink,
      ig_thumbnail: coverImage,
      status: 'submitted'
    });

    if (!rootId) await created.update({ parent_entry_id: created.id });

    await thread.update({ latest_version: version, latest_status: 'submitted' });

    return res.json({
      success: true,
      data: {
        thread: {
          id: thread.id,
          campaign_id: thread.campaign_id,
          influencer_id: thread.influencer_id,
          latest_version: thread.latest_version,
          latest_status: thread.latest_status
        },
        entry: created
      }
    });
  } catch (e) {
    const message = e.errors?.map(x => x.message).join('; ') || e.message || 'Validation error';
    res.status(e.status || 400).json({ success: false, message });
  }
};

/* ===========================
   Submit INSTAGRAM report (multiple media or by ids)
   POST /influencer/campaigns/:id/reports/instagram
   =========================== */
exports.submitInstagramReport = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const campaignId = Number(req.params.id || req.body.campaign_id);
    if (!campaignId) return res.status(400).json({ success: false, message: 'campaign_id missing' });

    await ensureInfluencerApprovedOnCampaign(influencerId, campaignId);
    const campaign = await loadCampaignOrThrow(campaignId);

    const { thread_id, notes = null } = req.body;

    // Prefer full "media" array; fallback to "ig_media_ids"
    let mediaArray = Array.isArray(req.body.media) ? req.body.media : null;

    if (!mediaArray || mediaArray.length === 0) {
      const ids = Array.isArray(req.body.ig_media_ids) ? req.body.ig_media_ids : [];
      if (ids.length === 0) {
        return res.status(400).json({ success: false, message: 'media must be a non-empty array' });
      }
      // Resolve from IG cache
      const account = await InfluencerInstagramAccount.findOne({ where: { influencer_id: influencerId } });
      if (!account) return res.status(400).json({ success: false, message: 'Instagram not connected' });

      let cached = account.media_with_insights;
      if (typeof cached === 'string') {
        try { cached = JSON.parse(cached); } catch { cached = []; }
      }
      const allMedia = Array.isArray(cached) ? cached : [];

      mediaArray = ids
        .map(id => allMedia.find(m => String(m.id) === String(id)))
        .filter(Boolean);

      if (mediaArray.length === 0) {
        return res.status(404).json({ success: false, message: 'No media found for provided ids' });
      }
    }

    // Reuse/authorize thread
    let thread = null;
    if (thread_id) {
      thread = await ReportThread.findByPk(thread_id);
      if (!thread || thread.influencer_id !== influencerId || thread.campaign_id !== campaignId) {
        return res.status(403).json({ success: false, message: 'Not authorized for this thread' });
      }
      if (!thread.has_instagram) await thread.update({ has_instagram: 1 });
    } else {
      thread = await getOrCreateThread({
        campaignId,
        brandId: campaign.brand_id,
        influencerId,
        setManual: false,
        setInstagram: true
      });
    }

    // Versioning and creation
    const info = await getThreadVersionInfo(thread.id);
    let version = info.latestVersion || 0;
    let parent_entry_id = info.rootId || null;

    const createdEntries = [];
    const insightsEcho = [];

    for (const m of mediaArray) {
      version += 1;

      const metrics = pickMetricsFromIgMedia(m) || {};
      const entry = await ReportEntry.create({
        thread_id: thread.id,
        parent_entry_id,
        version,
        submitted_by_role: 'influencer',
        type: 'instagram',
        metrics,
        notes,
        ig_media_id: m.id || null,
        ig_permalink: m.permalink || null,
        ig_media_type: m.media_type || null,
        ig_thumbnail: m.thumbnail_url || m.media_url || null,
        status: 'submitted'
      });

      if (!parent_entry_id) {
        await entry.update({ parent_entry_id: entry.id });
        parent_entry_id = entry.id;
      }

      createdEntries.push(entry);
      insightsEcho.push({
        id: m.id || null,
        media_type: m.media_type || null,
        permalink: m.permalink || null,
        metrics
      });
    }

    await thread.update({ latest_version: version, latest_status: 'submitted' });

    return res.json({
      success: true,
      data: {
        thread: {
          id: thread.id,
          campaign_id: thread.campaign_id,
          influencer_id: thread.influencer_id,
          latest_version: thread.latest_version,
          latest_status: thread.latest_status
        },
        entries: createdEntries,
        media_insights: insightsEcho
      }
    });
  } catch (e) {
    const message = e.errors?.map(x => x.message).join('; ') || e.message || 'Validation error';
    res.status(e.status || 400).json({ success: false, message });
  }
};

/* ===========================
   Get a single report thread (entries ordered)
   GET /influencer/reports/:threadId
   =========================== */
exports.getThread = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const threadId = Number(req.params.threadId);
    const thread = await ReportThread.findByPk(threadId);
    if (!thread || thread.influencer_id !== influencerId) {
      return res.status(403).json({ success: false, message: 'Not authorized for this thread' });
    }

    const entries = await ReportEntry.findAll({
      where: { thread_id: threadId },
      order: [['version', 'ASC'], ['created_at', 'ASC']]
    });

    res.json({ success: true, data: { ...thread.get(), entries } });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
};

/* ===========================
   Brand: Review report entries (batch approve/reject/needs_changes)
   (now supports optional spawn_request_card)
   POST /brand/reports/review
   =========================== */
   exports.reviewEntries = async (req, res) => {
    try {
      const brandId = req.user.id;
      const { entry_ids, decision, note = null, spawn_request_card = false } = req.body;
  
      if (!Array.isArray(entry_ids) || entry_ids.length === 0) {
        return res.status(400).json({ success: false, message: 'entry_ids required' });
      }
      if (!['approved', 'needs_changes', 'rejected'].includes(decision)) {
        return res.status(400).json({ success: false, message: 'Invalid decision' });
      }
  
      const entries = await ReportEntry.findAll({ where: { id: { [Op.in]: entry_ids } } });
      if (entries.length === 0) return res.status(404).json({ success: false, message: 'No entries found' });
  
      // Enforce same-thread batch
      const threadIds = [...new Set(entries.map(e => e.thread_id))];
      if (threadIds.length > 1) {
        return res.status(400).json({ success: false, message: 'Entries from multiple threads not allowed' });
      }
  
      const thread = await ReportThread.findByPk(threadIds[0]);
      await ensureBrandOwnsCampaign(brandId, thread.campaign_id);
  
      // 1) Update selected entries with the review decision
      await ReportEntry.update(
        {
          status: decision,
          review_note: note,
          reviewed_at: new Date(),
          reviewed_by: brandId,
        },
        { where: { id: { [Op.in]: entry_ids } } }
      );
  
      // 2) Determine current latest info
      const { rootId, latestVersion } = await (async () => {
        const first = await ReportEntry.findOne({
          where: { thread_id: thread.id, version: 1 },
          order: [['id', 'ASC']]
        });
        const latest = await ReportEntry.findOne({
          where: { thread_id: thread.id },
          order: [['version', 'DESC'], ['created_at', 'DESC']]
        });
        return {
          rootId: first?.id || null,
          latestVersion: latest?.version || 0,
          latestEntryType: latest?.type || 'manual'
        };
      })();
  
      let threadLatestStatus = decision;
      let threadLatestVersion = latestVersion;
  
      // 3) If needs_changes + spawn_request_card => create a follow-up REQUEST entry
      if (decision === 'needs_changes' && spawn_request_card === true) {
        const latestEntry = await ReportEntry.findOne({
          where: { thread_id: thread.id },
          order: [['version', 'DESC'], ['created_at', 'DESC']]
        });
  
        const nextVersion = (latestVersion || 0) + 1;
  
        await ReportEntry.create({
          thread_id: thread.id,
          parent_entry_id: rootId || latestEntry?.parent_entry_id || latestEntry?.id || null,
          version: nextVersion,
          submitted_by_role: 'brand',
          type: latestEntry?.type || 'manual',
          metrics: {},
          notes: note || null,       // use review note as instructions
          status: 'requested',
          review_note: null,
          reviewed_at: null,
          reviewed_by: null
        });
  
        threadLatestStatus = 'requested';
        threadLatestVersion = nextVersion;
      }
  
      // 4) Update thread summary
      await thread.update({
        latest_version: threadLatestVersion,
        latest_status: threadLatestStatus
      });
  
      res.json({
        success: true,
        data: {
          updated_count: entry_ids.length,
          spawned_request: decision === 'needs_changes' && !!spawn_request_card
        }
      });
    } catch (e) {
      res.status(e.status || 400).json({ success: false, message: e.message });
    }
  };
  

/* ===========================
   Replace a report entry → create a new version
   POST /influencer/reports/:entryId/replace
   =========================== */
exports.replaceReportEntry = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const entryId = Number(req.params.entryId);
    const source = await ReportEntry.findByPk(entryId);
    if (!source) return res.status(404).json({ success: false, message: 'Entry not found' });

    const thread = await ReportThread.findByPk(source.thread_id);
    if (!thread || thread.influencer_id !== influencerId) {
      return res.status(403).json({ success: false, message: 'Not authorized for this thread' });
    }

    const { rootId, latestVersion, latestStatus } = await getThreadVersionInfo(thread.id);
    if (latestStatus === 'approved') {
      return res.status(400).json({ success: false, message: 'Latest version approved; cannot replace' });
    }

    const version = (latestVersion || source.version) + 1;
    const newMetrics = req.body.metrics ? parseJSON(req.body.metrics, source.metrics || {}) : (source.metrics || {});
    const newNotes = req.body.notes ?? source.notes;

    const rec = await ReportEntry.create({
      thread_id: thread.id,
      parent_entry_id: rootId || source.parent_entry_id || source.id,
      version,
      submitted_by_role: 'influencer',
      type: source.type,
      metrics: newMetrics,
      notes: newNotes,
      ig_media_id: source.ig_media_id || null,
      ig_permalink: source.ig_permalink || null,
      ig_media_type: source.ig_media_type || null,
      ig_thumbnail: source.ig_thumbnail || null,
      status: 'submitted',
      review_note: null,
      reviewed_at: null,
      reviewed_by: null
    });

    await thread.update({ latest_version: version, latest_status: 'submitted' });

    if (!rootId) await rec.update({ parent_entry_id: rec.id });

    res.json({ success: true, data: rec });
  } catch (e) {
    res.status(e.status || 400).json({ success: false, message: e.message });
  }
};

/* ===========================
   Version chain (unified)
   GET /brand/reports/entries/:entryId/versions
   GET /influencer/reports/entries/:entryId/versions
   =========================== */
exports.getVersionChain = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const entryId = Number(req.params.entryId);
    const entry = await ReportEntry.findByPk(entryId);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });

    const thread = await ReportThread.findByPk(entry.thread_id);

    if (role === 'influencer') {
      if (!thread || thread.influencer_id !== userId) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    } else if (role === 'brand') {
      await ensureBrandOwnsCampaign(userId, thread.campaign_id);
    } else {
      throw new Error('Unauthorized role');
    }

    const versions = await ReportEntry.findAll({
      where: { thread_id: entry.thread_id },
      order: [['version', 'ASC'], ['created_at', 'ASC']]
    });

    const root = versions.find(v => v.version === 1)?.id || null;
    res.json({ success: true, data: { root_id: root, current_id: entry.id, versions } });
  } catch (e) {
    res.status(e.status || 400).json({ success: false, message: e.message });
  }
};

/* ===========================
   Restore a previous version (report)
   POST /influencer/reports/:entryId/restore
   =========================== */
exports.restoreReportVersion = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const entryId = Number(req.params.entryId);
    const source = await ReportEntry.findByPk(entryId);
    if (!source) return res.status(404).json({ success: false, message: 'Entry not found' });

    const thread = await ReportThread.findByPk(source.thread_id);
    if (!thread || thread.influencer_id !== influencerId) {
      return res.status(403).json({ success: false, message: 'Not authorized for this thread' });
    }

    const { rootId, latestVersion, latestStatus } = await getThreadVersionInfo(thread.id);
    if (latestStatus === 'approved') {
      return res.status(400).json({ success: false, message: 'Latest version approved; cannot restore' });
    }

    const rec = await ReportEntry.create({
      thread_id: thread.id,
      parent_entry_id: rootId || source.parent_entry_id || source.id,
      version: (latestVersion || source.version) + 1,
      submitted_by_role: 'influencer',
      type: source.type,
      metrics: source.metrics,
      notes: req.body?.notes ?? source.notes,
      ig_media_id: source.ig_media_id || null,
      ig_permalink: source.ig_permalink || null,
      ig_media_type: source.ig_media_type || null,
      ig_thumbnail: source.ig_thumbnail || null,
      status: 'submitted',
      review_note: null,
      reviewed_at: null,
      reviewed_by: null
    });

    await thread.update({ latest_version: (latestVersion || source.version) + 1, latest_status: 'submitted' });

    if (!rootId) await rec.update({ parent_entry_id: rec.id });

    res.json({ success: true, data: rec });
  } catch (e) {
    res.status(e.status || 400).json({ success: false, message: e.message });
  }
};

/* ===========================
   Comments on a report thread (brand/influencer)
   POST /brand/reports/threads/:threadId/comments
   POST /influencer/reports/threads/:threadId/comments
   =========================== */
exports.addComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role; // 'influencer' or 'brand'
    const threadId = Number(req.params.threadId);
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text required' });
    }

    const thread = await ReportThread.findByPk(threadId);
    if (!thread) return res.status(404).json({ success: false, message: 'Thread not found' });

    if (role === 'influencer') {
      if (thread.influencer_id !== userId) return res.status(403).json({ success: false, message: 'Not authorized' });
    } else if (role === 'brand') {
      await ensureBrandOwnsCampaign(userId, thread.campaign_id);
    } else {
      return res.status(403).json({ success: false, message: 'Unauthorized role' });
    }

    const comment = await ReportComment.create({
      thread_id: threadId,
      author_role: role,
      author_id: userId,
      text: text.trim()
    });

    res.json({ success: true, data: comment });
  } catch (e) {
    res.status(e.status || 400).json({ success: false, message: e.message });
  }
};

/* ===========================
   Brand: Request a new report thread from an influencer
   POST /brand/campaigns/:id/reports/request
   =========================== */
exports.brandRequestReport = async (req, res) => {
  try {
    const brandId = req.user.id; // brand user id
    const campaignId = Number(req.params.id);
    const { influencer_id, notes = null, category = 'manual' } = req.body;

    if (!influencer_id) {
      return res.status(400).json({ success: false, message: 'influencer_id required' });
    }

    // Authorization + brand ownership
    await ensureBrandOwnsCampaign(brandId, campaignId);
    await ensureInfluencerApprovedOnCampaign(influencer_id, campaignId);

    const campaign = await loadCampaignOrThrow(campaignId);

    // Reuse or create the unique thread for (campaign, brand, influencer)
    const thread = await getOrCreateThread({
      campaignId,
      brandId: campaign.brand_id,
      influencerId: influencer_id,
      setManual: category === 'manual',
      setInstagram: category === 'instagram'
    });

    // Determine next version
    const { rootId, latestVersion } = await getThreadVersionInfo(thread.id);
    const version = (latestVersion || 0) + 1;

    // Brand-submitted "request" entry
    const entry = await ReportEntry.create({
      thread_id: thread.id,
      parent_entry_id: rootId || null, // will be self if first
      version,
      submitted_by_role: 'brand',
      type: category, // 'manual' | 'instagram'
      metrics: {},    // influencer will submit data later
      notes: notes || null,
      status: 'requested'
    });

    if (!rootId) await entry.update({ parent_entry_id: entry.id });

    // Update thread summary
    await thread.update({
      latest_version: version,
      latest_status: 'requested'
    });

    // Return mapped UI thread so brand page can render immediately
    const threadWithEntries = await ReportThread.findByPk(thread.id, {
      include: [{ model: ReportEntry, as: 'entries', separate: true, order: [['version','ASC']] }]
    });

    res.json({
      success: true,
      data: mapThreadForBrandUI(threadWithEntries)
    });
  } catch (e) {
    res.status(e.status || 400).json({ success: false, message: e.message });
  }
};

/* ===========================
   Brand: Request changes over a specific entry
   (spawns a new "requested" card at next version)
   POST /brand/reports/entries/:entryId/request
   =========================== */
exports.brandRequestChangesOverEntry = async (req, res) => {
  try {
    const brandId = req.user.id;
    const entryId = Number(req.params.entryId);
    const { note = null } = req.body || {};

    const data = await spawnBrandRequestCardOverEntry(brandId, entryId, note);

    res.json({ success: true, data });
  } catch (e) {
    res.status(e.status || 400).json({ success: false, message: e.message });
  }
};

/* ===== internal: create a new "requested" entry at next version ===== */
async function spawnBrandRequestCardOverEntry(brandId, entryId, note) {
  const source = await ReportEntry.findByPk(entryId);
  if (!source) {
    const e = new Error('Entry not found');
    e.status = 404;
    throw e;
  }

  const thread = await ReportThread.findByPk(source.thread_id);
  if (!thread) {
    const e = new Error('Thread not found');
    e.status = 404;
    throw e;
  }

  await ensureBrandOwnsCampaign(brandId, thread.campaign_id);

  const { rootId, latestVersion } = await getThreadVersionInfo(thread.id);
  const version = (latestVersion || 0) + 1;

  const requestEntry = await ReportEntry.create({
    thread_id: thread.id,
    parent_entry_id: rootId || source.parent_entry_id || source.id,
    version,
    submitted_by_role: 'brand',
    type: source.type,   // keep same type so influencer knows what to respond with
    metrics: {},
    notes: note || null, // brand instruction
    ig_media_id: null,
    ig_permalink: null,
    ig_media_type: null,
    ig_thumbnail: null,
    status: 'requested'
  });

  if (!rootId) await requestEntry.update({ parent_entry_id: requestEntry.id });

  await thread.update({ latest_version: version, latest_status: 'requested' });

  return requestEntry;
}
