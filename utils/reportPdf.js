// utils/reportPdf.js
const path = require('path');
const fs = require('fs/promises');
const puppeteer = require('puppeteer'); // or Playwright

exports.renderCampaignReportHTML = async (data) => {
  // Simple server-side template. In prod, render a full HTML using your brand styles.
  const { campaign, totals, byInfluencer } = data;
  const rows = Object.values(byInfluencer).map(({ influencer, items, subtotals }) => `
    <h3>${influencer?.full_name || 'Unknown'}</h3>
    <p>Niche: ${influencer?.niche || '-'}</p>
    <p>Followers: ${influencer?.followers_count || 0}</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0">
      <thead><tr>
        <th align="left">Type</th><th align="left">Permalink</th><th align="right">Reach</th><th align="right">Likes</th><th align="right">Comments</th><th align="right">Views</th>
      </tr></thead>
      <tbody>
        ${items.map(d => `
          <tr>
            <td>${d.media_type}</td>
            <td>${d.permalink ? `<a href="${d.permalink}">${d.permalink}</a>` : '-'}</td>
            <td align="right">${d.metrics?.reach || 0}</td>
            <td align="right">${d.metrics?.likes || 0}</td>
            <td align="right">${d.metrics?.comments || 0}</td>
            <td align="right">${d.metrics?.views || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p><b>Subtotals</b> — Reach: ${subtotals.reach}, Views: ${subtotals.views}, Likes: ${subtotals.likes}, Comments: ${subtotals.comments}</p>
    <hr/>
  `).join('');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${campaign.title} – Report</title>
      <style>
        body { font-family: Inter, system-ui, Arial; padding: 24px; color: #111; }
        h1 { margin-bottom: 4px; }
        .kpi { display:inline-block; margin-right:16px; background:#f5f5f5; padding:8px 12px; border-radius:8px; }
        a { color:#2563eb; text-decoration: none; }
        th, td { padding:6px 8px; border-bottom: 1px solid #eee; font-size: 12px;}
      </style>
    </head>
    <body>
      <h1>Campaign Report</h1>
      <h2>${campaign.title}</h2>
      <div style="margin:12px 0">
        <span class="kpi">Deliverables: ${totals.deliverables}</span>
        <span class="kpi">Reach: ${totals.reach}</span>
        <span class="kpi">Impressions: ${totals.impressions}</span>
        <span class="kpi">Views: ${totals.views}</span>
        <span class="kpi">Likes: ${totals.likes}</span>
        <span class="kpi">Comments: ${totals.comments}</span>
      </div>
      ${rows}
      <p style="margin-top:24px;color:#666">Generated at ${new Date().toLocaleString()}</p>
    </body>
  </html>`;
};

exports.pdfFromHTML = async (html) => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm' } });
  await browser.close();
  return pdf;
};
