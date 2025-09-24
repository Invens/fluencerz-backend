// utils/reportPdf.js
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

/**
 * Produce a simple HTML for the campaign report.
 * You can replace with a proper template engine (ejs/handlebars) if you prefer.
 */
async function renderCampaignReportHTML(data) {
  const { campaign, totals, deliverables, byInfluencer } = data;

  const css = `
    body { font-family: Inter, Arial, sans-serif; color: #111; }
    h1,h2,h3 { margin: 0.3rem 0; }
    .muted { color: #666; font-size: 12px; }
    .section { margin-top: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px; }
    th { background: #f8f8f8; text-align: left; }
    .chip { display:inline-block; background:#eef; border:1px solid #cdd; border-radius:12px; padding:2px 8px; margin:2px; font-size: 10px; }
  `;

  const rows = deliverables.map(d => {
    const tags = Array.isArray(d.tags) ? d.tags.map(t => `<span class="chip">${t}</span>`).join(' ') : '';
    return `
      <tr>
        <td>${d.id}</td>
        <td>${d.Influencer?.full_name || '—'}</td>
        <td>${d.platform}</td>
        <td>${d.media_type}</td>
        <td>${d.permalink ? `<a href="${d.permalink}">${d.permalink}</a>` : '—'}</td>
        <td>${d.metrics?.reach ?? 0}</td>
        <td>${d.metrics?.likes ?? 0}</td>
        <td>${d.metrics?.comments ?? 0}</td>
        <td>${d.metrics?.views ?? 0}</td>
        <td>${d.metrics?.impressions ?? 0}</td>
        <td>${tags}</td>
        <td>${d.status}</td>
      </tr>
    `;
  }).join('');

  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Campaign Report</title>
<style>${css}</style>
</head>
<body>
  <h1>${campaign.title}</h1>
  <div class="muted">Status: ${campaign.status} • Created: ${new Date(campaign.created_at).toLocaleString()}</div>

  <div class="section">
    <h2>Overview</h2>
    <table>
      <tr><th>Total Deliverables</th><td>${totals.deliverables}</td></tr>
      <tr><th>Total Reach</th><td>${totals.reach}</td></tr>
      <tr><th>Total Impressions</th><td>${totals.impressions}</td></tr>
      <tr><th>Total Views</th><td>${totals.views}</td></tr>
      <tr><th>Total Likes</th><td>${totals.likes}</td></tr>
      <tr><th>Total Comments</th><td>${totals.comments}</td></tr>
      <tr><th>Total Saves</th><td>${totals.saves}</td></tr>
      <tr><th>Total Shares</th><td>${totals.shares}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Deliverables</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th><th>Influencer</th><th>Platform</th><th>Type</th>
          <th>Permalink</th><th>Reach</th><th>Likes</th><th>Comments</th>
          <th>Views</th><th>Impr.</th><th>Tags</th><th>Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>
`;
}

/** Render PDF from HTML using Puppeteer */
async function pdfFromHTML(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ format: 'A4', printBackground: true });
  } finally {
    await browser.close();
  }
}

module.exports = { renderCampaignReportHTML, pdfFromHTML };
