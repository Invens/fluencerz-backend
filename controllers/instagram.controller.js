const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const PROXY_API_TOKEN = "aafu53k1x9fxahwwxd06ljen1106dsk4jyc8gmo1";

const staticHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'X-Requested-With': 'XMLHttpRequest',
    'x-xsrf-token': 'eyJpdiI6IkdGWTYrRkQ5cHp1bTlOM0wrcVNncGc9PSIsInZhbHVlIjoiOUNwZHJpY0ludXF5amNCMFN2WFNDYlVRenc2V0V4Yk1ZTTlWRXptdUtsaWtJbnRWQVpUSkY0WDcvWWxWSmUvQWhsRnU3aHI2V0NkT05RYytFK2ZaY0xRUkJMTDcvZDJYd1dmWVV2bFUyYmdsQXpGUTE1N050YlJoTFBDNDhHbGkiLCJtYWMiOiIxZjIzMjYyMzhlMWFmM2JlNmE5MTExMGUzZmNjMjRjMGE0YTRhMDYwMmQ1ZjdhMTI4ZDZmNTlmOGU2YzkxZmViIiwidGFnIjoiIn0',
    'Referer': 'https://instrack.app/',
    'Cookie': '_ga=GA1.1.1175536375.1750850480; _gcl_au=1.1.460405039.1750850480; aws-waf-token=87937c09-a5ab-46e6-a13e 9b0c5b7fe441:BQoAbsA56ycwAAAA:lyDeCIWGkwoWWL7miQhzqKhzbIIF/qAHaxTBpoZBr0fSMQd7BszDjA56COcmIUCKCHtDtJvYO2A+xlllcfQ1sJ87n7FYFrRciiNjVKpk9iYZXBVvxd3dR5oZTDQRGqmv9OloFW3R9TqmupoFmgeCaaMqfRr6ygDmxAYoesTC3npLe4dydYJVin6ekpyjhrg=; XSRF-TOKEN=eyJpdiI6IloxbGhzZUJ5RUZqNHFjT0kzOFgxcEE9PSIsInZhbHVlIjoicFlLWmY2Y21Ealo1OTB6cDZoSURVWE9KU05qTVBoWmhJamx0YXFwek5ldkovNjJzVnlQK2RlM2tGZWFkR2RWaHB5bzRVM2NUUEhJeVJDOGxvNElnL3N4U1hPakFHYm16aStOZEZZQ1picU82bEdOdFM3MkV2R0VKd25mNmFvSlUiLCJtYWMiOiJhOWQ0YWIxZGNlOTE5MDBhNGYyMzI0YTk3Zjg2NjhjMWI2Nzg0MmRkMjgzYmU4N2M2NjY2ZjY5NjFmNTM4NjY1IiwidGFnIjoiIn0%3D; instrack_session=eyJpdiI6Img3WldzbGlVL2lJWnEvdXN1N21DbUE9PSIsInZhbHVlIjoiQ0FwUTJ2YXU1ZWsyR2QzbzRwcEkwQzVoekd0ZnRWRVdCOXlFMWRKZERLUHJYbjZTdzFGdkF6b0xuZzVoNHBES1pwSSsrMTlKRjdkN3JWZjBIaHJrRi94MFRKK2piU3Z4OFRXNjRtRTNQWUdTZ0llTXNmVnpPeGd0eEJnY0Fic1QiLCJtYWMiOiJmZjhkNDBlYjRkN2JlMDYzNWIzOTIwMTdmNTc0OWI5OGM4OWQ5NTE4ZDdmYTk1NTViNDdlYWIzNTcwYmY0NzU1IiwidGFnIjoiIn0%3D;_ga_SRX1FS9NRX=GS2.1.s1751358550$o3$g1$t1751358567$j43$l0$h0'
};

async function fetchProxies({ mode = "direct", page = 1, page_size = 10 } = {}) {
    const url = `https://proxy.webshare.io/api/v2/proxy/list/?mode=${mode}&page=${page}&page_size=${page_size}`;
    try {
        const res = await axios.get(url, {
            headers: {
                Authorization: `Token ${PROXY_API_TOKEN}`
            }
        });
        if (!res.data.results) throw new Error("No results in proxy response");
        return res.data.results;
    } catch (err) {
        console.error("Proxy API fetch error:", err.response ? err.response.data : err.message);
        throw err;
    }
}

async function fetchInstrackWithProxy(username, proxyData) {
    const proxyUrl = `http://${proxyData.username}:${proxyData.password}@${proxyData.proxy_address}:${proxyData.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);

    const url = `https://instrack.app/api/account/${username}`;
    try {
        const response = await axios.get(url, {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 15000,
            headers: staticHeaders
        });
        return response.data;
    } catch (err) {
        return null;
    }
}

exports.getInstrackData = async (req, res) => {
    const username = req.params.username;
    if (!username) return res.status(400).json({ error: "Username is required" });

    let proxies = [];
    try {
        proxies = await fetchProxies({ page_size: 10 });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch proxies" });
    }

    for (const proxy of proxies) {
        const data = await fetchInstrackWithProxy(username, proxy);
        if (data) {
            return res.json(data); // Return on first successful proxy
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    return res.status(429).json({ error: "All proxies failed or rate-limited by Instrack" });
};
