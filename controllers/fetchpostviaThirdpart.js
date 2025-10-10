// src/controllers/fethcPost.controller.js
require("dotenv").config();

/**
 * STRICT REPLAY MODE
 * We send the *exact* payload fields & headers you captured so the signature matches.
 * Frontend sends only { username }. We do not compute times or signature.
 */

const UPSTREAM_URL = "https://anonyig.com/api/v1/instagram/postsV2";

/** ----- Headers: mirror your working request (env overrides allowed) ----- */
const ORIGIN =
  process.env.ANONYIG_ORIGIN || "https://anonyig.com";
const REFERER =
  process.env.ANONYIG_REFERER || "https://anonyig.com/en/instagram-profile-viewer/";
const UA =
  process.env.ANONYIG_UA ||
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
const COOKIE =
  process.env.ANONYIG_COOKIE ||
  '_ga=GA1.1.2048395376.1760084973; uid=f5900961c3eefdef; adsUnderSearchInput=52; errorFallbackPopup=89; FCNEC=%5B%5B%22AKsRol-atwRWOHzK1m7VscYNPGuIVdFX7djhAEgU2mO3fYDZO-C67AMw8ZPRsGTh0zJ_7LgxdAzWdgBLxzya86Nr7UgSn0KTFxvcxoy3wsWbGpEV-_2m9HPk4oMZ0dFvNlIy-i4ZXH_uM3qHfqjle5UqOHojMdGjXw%3D%3D%22%5D%5D; _ga_M1Z17CPHMW=GS2.1.s1760089685$o2$g1$t1760091376$j60$l0$h0';

/** ----- Payload fields: EXACT values from your successful call (env overrides) ----- */
const FIXED_MAX_ID   = process.env.ANONYIG_MAXID  ?? ""; // you used empty string
const FIXED_TS       = Number(process.env.ANONYIG_TS       ?? "1760091377365");
const FIXED__TS      = Number(process.env.ANONYIG__TS      ?? "1759325251915");
const FIXED__TSC     = Number(process.env.ANONYIG__TSC     ?? "0");
const FIXED_SIG      = process.env.ANONYIG_SIG             || "25a071bdfbefcf8361bee304e100407b9f8e11b2a0343e51fb12e3e74713eaa2";

/**
 * Build payload with ONLY the username variable; everything else is the fixed combo
 */
function buildPayloadStrict(username, maxIdFromClient) {
  return {
    username,
    maxId: typeof maxIdFromClient === "string" ? maxIdFromClient : FIXED_MAX_ID,
    ts: FIXED_TS,
    _ts: FIXED__TS,
    _tsc: FIXED__TSC,
    _s: FIXED_SIG,
  };
}

/**
 * Call upstream with strict headers
 */
async function callAnonyIGPostsV2(payload) {
  const res = await fetch(UPSTREAM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: ORIGIN,
      Referer: REFERER,
      "User-Agent": UA,
      Cookie: COOKIE,
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await res.text();

  if (!res.ok) {
    const snippet = text.slice(0, 1200);
    const err = new Error(`Upstream ${res.status} ${res.statusText}: ${snippet}`);
    err.status = res.status;
    err.body = snippet;
    throw err;
  }

  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("Upstream returned non-JSON body");
    err.status = 502;
    err.body = text.slice(0, 1200);
    throw err;
  }
}

/**
 * Optional normalizer (unchanged)
 */
function normalizePostsV2(json) {
  const result = json?.result || {};
  const pageInfo = result?.page_info || {};
  const edges = Array.isArray(result?.edges) ? result.edges : [];

  const items = edges.map(({ node }) => {
    const isVideo = !!node?.is_video || node?.__typename === "GraphVideo";
    const caption = node?.edge_media_to_caption?.edges?.[0]?.node?.text || "";
    const shortcode = node?.shortcode || "";
    const takenAt = node?.taken_at_timestamp ? node.taken_at_timestamp * 1000 : null;

    let imageUrl = node?.display_url || node?.thumbnail_src || "";
    if (!imageUrl && Array.isArray(node?.display_resources) && node.display_resources.length) {
      imageUrl = node.display_resources[node.display_resources.length - 1]?.src || "";
    }

    const videoUrl = node?.video_url || "";
    const likes = node?.edge_media_preview_like?.count ?? null;
    const comments = node?.edge_media_to_comment?.count ?? null;

    return {
      id: node?.id || shortcode || Math.random().toString(36).slice(2),
      isVideo,
      imageUrl,
      videoUrl,
      caption,
      shortcode,
      permalink: shortcode ? `https://www.instagram.com/p/${shortcode}/` : "",
      takenAt,
      likes,
      comments,
      owner: node?.owner?.username || "",
      dims: node?.dimensions || null,
    };
  });

  return {
    items,
    hasNext: !!pageInfo?.has_next_page,
    endCursor: pageInfo?.end_cursor || "",
  };
}

/**
 * Controller: POST /api/instagram/posts
 * Body: { username: string, maxId?: string, normalize?: boolean }
 * (Frontend sends only { username })
 */
async function fetchPostsController(req, res) {
  try {
    const { username, maxId, normalize } = req.body || {};
    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ error: "username is required" });
    }

    const payload = buildPayloadStrict(username.trim(), maxId);
    const upstreamJson = await callAnonyIGPostsV2(payload);

    res.set("Cache-Control", "no-store");

    if (normalize === true) {
      return res.json(normalizePostsV2(upstreamJson));
    }
    return res.json(upstreamJson);
  } catch (err) {
    console.error("fetchPostsController error:", err?.message);
    return res.status(err?.status || 500).json({
      error: "Proxy error",
      message: err?.message || "Unknown error",
      upstream: err?.body || undefined,
    });
  }
}

module.exports = {
  fetchPostsController,
  // helpers (optional)
  buildPayloadStrict,
  callAnonyIGPostsV2,
  normalizePostsV2,
};
