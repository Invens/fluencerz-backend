// utils/metrics.js
const mediaMetricMap = {
    POST:    ['reach','impressions','likes','comments','saves','shares'],
    REEL:    ['reach','impressions','likes','comments','saves','shares','views','watch_time'],
    STORY:   ['reach','impressions','replies','shares','profile_visits','taps_forward','taps_back'],
    VIDEO:   ['reach','impressions','likes','comments','shares','views','avg_view_duration'],
    CAROUSEL:['reach','impressions','likes','comments','saves','shares'],
    OTHER:   [], // free-form
  };
  
  function validateMetrics(mediaType, metrics) {
    if (!metrics || typeof metrics !== 'object') return {};
    const allowed = new Set((mediaMetricMap[mediaType] ?? []).concat(Object.keys(metrics)));
    const cleaned = {};
    for (const [k, v] of Object.entries(metrics)) {
      if (!allowed.has(k)) continue;
      const num = Number(v);
      cleaned[k] = Number.isFinite(num) ? num : 0;
    }
    return cleaned;
  }
  
  module.exports = { mediaMetricMap, validateMetrics };
  