const axios = require('axios');

const BASE = 'https://instrack.app';

/**
 * 💡 NOTE:
 * These are the exact headers + cookies + XSRF token
 * you captured from Chrome DevTools.
 * This will simulate a real browser session to fetch influencer data reliably.
 */
const cookies = `_ga=GA1.1.638173130.1760017246; _gcl_au=1.1.1251828324.1760017247; aws-waf-token=fb6f95d5-09dc-404f-b86e-65822688b1c5:BQoAdJ1hL+VPAAAA:4y2vSiRzQsUlO4tLWT0mH1CKHnY4R+EUNExxsx3QHpqNnun+GR+PiNZ4yEHixAkD15t0VrRHqpRZIUVmGFJqaSqZFFGdc0ezULKiPb6nGGQDvPMK2NULSrJtWUwTCXeO8/7Ygcv4ROYY0TB2JHaquTnjGnz3mvSt/jkst9Oes7DhBvhpjQxLG+zEjcVaIOI=; XSRF-TOKEN=eyJpdiI6IjF0ZC80bENyQU1qMXdITUdKWGxnWGc9PSIsInZhbHVlIjoibSthZ0lTQXBxdEFPeU54L3Q3b1hrZUx0OUFPTkx3MEJReHhUeFl0aXEzendmSzhGK0pNeGZndDkvVnpQS2g1ZXB5VHdGZ2JkTGNoZkFtNFJZZUkwTkhoZExNLzE0M0ZjS2hxZ1Ixbm8wTXAxZFBMYTE3OXlkRzJlN2RNVmlqMlkiLCJtYWMiOiJmYTkwMjg2YjA1M2FjYjA2MWU0ZmI4NTJmNjdlMTAxOWRhNjM2MDBmMzNlNmYzNmQ4YTIxNmZmZjQyNTk1ZWM2IiwidGFnIjoiIn0%3D; instrack_session=eyJpdiI6IjJKZjlzVzJVdUFqb1dvdC9vdlBESVE9PSIsInZhbHVlIjoiT2xab3pPRC9iN2YrTTAzbkxUdnNKSk5sZi8vYWNaZWFKMFEzOVFwdTlXNXN4aHp1bytoSDVGeGsrRCtJZzZmL2VvVkx6TGpLMzBVVVUxeXJjdlZpYzFITzkyb3pPU25WQlZiVUVLOVV3WDVJZlBOcGNHRDJyQUs4YzdUVW9DU2EiLCJtYWMiOiJiY2IxN2JhMTE3NTA1ZmIyNzcyMDg1N2JmMzM5OTgzMTM3NDhlM2ExNjBjNDkzNjRmNDI4M2I2MmVhYThkYTA5IiwidGFnIjoiIn0%3D; _ga_SRX1FS9NRX=GS2.1.s1760017246$o1$g1$t1760018716$j12$l0$h0`;

const xsrfToken = `eyJpdiI6IjF0ZC80bENyQU1qMXdITUdKWGxnWGc9PSIsInZhbHVlIjoibSthZ0lTQXBxdEFPeU54L3Q3b1hrZUx0OUFPTkx3MEJReHhUeFl0aXEzendmSzhGK0pNeGZndDkvVnpQS2g1ZXB5VHdGZ2JkTGNoZkFtNFJZZUkwTkhoZExNLzE0M0ZjS2hxZ1Ixbm8wTXAxZFBMYTE3OXlkRzJlN2RNVmlqMlkiLCJtYWMiOiJmYTkwMjg2YjA1M2FjYjA2MWU0ZmI4NTJmNjdlMTAxOWRhNjM2MDBmMzNlNmYzNmQ4YTIxNmZmZjQyNTk1ZWM2IiwidGFnIjoiIn0=`;

/**
 * ✅ Full browser header simulation
 */
const headers = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  'Referer': 'https://instrack.app/instagram/virat.kohli',
  'Origin': 'https://instrack.app',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cookie': cookies,
  'x-xsrf-token': xsrfToken,
};

/**
 * Create an Axios instance with headers preset
 */
const axiosInstance = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers,
});

/**
 * 🔍 Search for influencers by keyword
 */
async function search(query) {
  const r = await axiosInstance.post('/api/account/search', { query });
  if (r.status !== 200) {
    throw new Error(`Instrack search failed with status ${r.status}`);
  }
  return r.data?.accounts ?? [];
}

/**
 * 👤 Get influencer profile by username
 */
async function getByUsername(username) {
  const r = await axiosInstance.get(`/api/account/${encodeURIComponent(username)}`);
  if (r.status !== 200) {
    throw new Error(`Instrack profile fetch failed with status ${r.status}`);
  }
  return r.data;
}

module.exports = { search, getByUsername };
