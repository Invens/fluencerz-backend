// utils/metrics.js
const MEDIA_METRIC_WHITELIST = {
  IMAGE: ['reach','impressions','likes','comments','saves','shares','profile_visits'],
  POST:  ['reach','impressions','likes','comments','saves','shares','profile_visits'],
  VIDEO: ['reach','impressions','likes','comments','saves','shares','views','profile_visits'],
  REEL:  ['reach','impressions','likes','comments','saves','shares','views','profile_visits'],
  STORY: ['reach','impressions','replies','shares','profile_visits'],
  CAROUSEL: ['reach','impressions','likes','comments','saves','shares','profile_visits'],
  OTHER: []
};

function toUpperSafe(v) { return (v || '').toString().trim().toUpperCase(); }

/**
 * Validate & normalize metrics for a media type.
 * Strips unknown keys, forces numeric values (non-numeric -> 0).
 */
function validateMetrics(mediaType, metricsObj = {}) {
  const type = toUpperSafe(mediaType);
  const allow = MEDIA_METRIC_WHITELIST[type] || [];
  const cleaned = {};
  for (const key of allow) {
    const val = metricsObj[key];
    cleaned[key] = Number.isFinite(Number(val)) ? Number(val) : 0;
  }
  // Preserve common keys even if not in whitelist (optional):
  const common = ['ctr','cpc','cpm','engagement_rate'];
  for (const k of common) {
    if (metricsObj[k] != null) cleaned[k] = Number(metricsObj[k]) || 0;
  }
  return cleaned;
}

function safeParseJSON(str, fallback) {
  if (str == null) return fallback;
  if (typeof str === 'object') return str;
  try { return JSON.parse(str); } catch { return fallback; }
}

module.exports = { validateMetrics, safeParseJSON, MEDIA_METRIC_WHITELIST };
