const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const PROXY_API_TOKEN = "aafu53k1x9fxahwwxd06ljen1106dsk4jyc8gmo1";

// Multiple Header Configurations for rotation
const headerConfigs = [
    {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-Requested-With': 'XMLHttpRequest',
        'x-xsrf-token': 'eyJpdiI6IkdGWTYrRkQ5cHp1bTlOM0wrcVNncGc9PSIsInZhbHVlIjoiOUNwZHJpY0ludXF5amNCMFN2WFNDYlVRenc2V0V4Yk1ZTTlWRXptdUtsaWtJbnRWQVpUSkY0WDcvWWxWSmUvQWhsRnU3aHI2V0NkT05RYytFK2ZaY0xRUkJMTDcvZDJYd1dmWVV2bFUyYmdsQXpGUTE1N050YlJoTFBDNDhHbGkiLCJtYWMiOiIxZjIzMjYyMzhlMWFmM2JlNmE5MTExMGUzZmNjMjRjMGE0YTRhMDYwMmQ1ZjdhMTI4ZDZmNTlmOGU2YzkxZmViIiwidGFnIjoiIn0',
        'Referer': 'https://instrack.app/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Cookie': '_ga=GA1.1.1175536375.1750850480; _gcl_au=1.1.460405039.1750850480; aws-waf-token=87937c09-a5ab-46e6-a13e 9b0c5b7fe441:BQoAbsA56ycwAAAA:lyDeCIWGkwoWWL7miQhzqKhzbIIF/qAHaxTBpoZBr0fSMQd7BszDjA56COcmIUCKCHtDtJvYO2A+xlllcfQ1sJ87n7FYFrRciiNjVKpk9iYZXBVvxd3dR5oZTDQRGqmv9OloFW3R9TqmupoFmgeCaaMqfRr6ygDmxAYoesTC3npLe4dydYJVin6ekpyjhrg=; XSRF-TOKEN=eyJpdiI6IloxbGhzZUJ5RUZqNHFjT0kzOFgxcEE9PSIsInZhbHVlIjoicFlLWmY2Y21Ealo1OTB6cDZoSURVWE9KU05qTVBoWmhJamx0YXFwek5ldkovNjJzVnlQK2RlM2tGZWFkR2RWaHB5bzRVM2NUUEhJeVJDOGxvNElnL3N4U1hPakFHYm16aStOZEZZQ1picU82bEdOdFM3MkV2R0VKd25mNmFvSlUiLCJtYWMiOiJhOWQ0YWIxZGNlOTE5MDBhNGYyMzI0YTk3Zjg2NjhjMWI2Nzg0MmRkMjgzYmU4N2M2NjY2ZjY5NjFmNTM4NjY1IiwidGFnIjoiIn0%3D; instrack_session=eyJpdiI6Img3WldzbGlVL2lJWnEvdXN1N21DbUE9PSIsInZhbHVlIjoiQ0FwUTJ2YXU1ZWsyR2QzbzRwcEkwQzVoekd0ZnRWRVdCOXlFMWRKZERLUHJYbjZTdzFGdkF6b0xuZzVoNHBES1pwSSsrMTlKRjdkN3JWZjBIaHJrRi94MFRKK2piU3Z4OFRXNjRtRTNQWUdTZ0llTXNmVnpPeGd0eEJnY0Fic1QiLCJtYWMiOiJmZjhkNDBlYjRkN2JlMDYzNWIzOTIwMTdmNTc0OWI5OGM4OWQ5NTE4ZDdmYTk1NTViNDdlYWIzNTcwYmY0NzU1IiwidGFnIjoiIn0%3D;_ga_SRX1FS9NRX=GS2.1.s1751358550$o3$g1$t1751358567$j43$l0$h0'
    },
    {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-GB,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://instrack.app/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
    },
    {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://instrack.app/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
    },
    {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://instrack.app/'
    },
    {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://instrack.app/'
    }
];

// Request Caching implementation
const requestCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

// Proxy Shuffling - Fisher-Yates shuffle algorithm
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Randomized Delays function
function randomDelay(min = 2000, max = 5000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`Waiting ${delay}ms before next request...`);
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Exponential backoff delay
function exponentialBackoff(attempt, baseDelay = 1000, maxDelay = 30000) {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = delay * 0.1 * Math.random(); // Add 10% jitter
    return delay + jitter;
}

// Cache cleanup function
function cleanupCache() {
    const now = Date.now();
    let cleanedCount = 0;
    for (const [key, value] of requestCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            requestCache.delete(key);
            cleanedCount++;
        }
    }
    if (cleanedCount > 0) {
        console.log(`Cleaned ${cleanedCount} expired cache entries`);
    }
}

// Fetch proxies with Proxy Validation
async function fetchProxies({ mode = "direct", page = 1, page_size = 25 } = {}) {
    const url = `https://proxy.webshare.io/api/v2/proxy/list/?mode=${mode}&page=${page}&page_size=${page_size}`;
    try {
        console.log(`Fetching ${page_size} proxies from WebShare API...`);
        const res = await axios.get(url, {
            headers: {
                Authorization: `Token ${PROXY_API_TOKEN}`
            },
            timeout: 10000
        });
        
        if (!res.data.results) {
            throw new Error("No results in proxy response");
        }
        
        // Proxy Validation - filter only valid and working proxies
        const workingProxies = res.data.results.filter(proxy => 
            proxy.valid && 
            proxy.last_verification && 
            proxy.last_verification.success
        );
        
        console.log(`Retrieved ${res.data.results.length} proxies, ${workingProxies.length} are valid and working`);
        
        // Proxy Shuffling
        const shuffledProxies = shuffleArray(workingProxies);
        
        return shuffledProxies;
    } catch (err) {
        console.error("Proxy API fetch error:", err.response ? err.response.data : err.message);
        throw err;
    }
}

// Main function to fetch Instrack data with proxy
async function fetchInstrackWithProxy(username, proxyData, headerIndex = 0, attempt = 0) {
    const proxyUrl = `http://${proxyData.username}:${proxyData.password}@${proxyData.proxy_address}:${proxyData.port}`;
    const agent = new HttpsProxyAgent(proxyUrl);

    const url = `https://instrack.app/api/account/${username}`;
    
    // Better Logging
    console.log(`[Attempt ${attempt + 1}] Trying proxy: ${proxyData.proxy_address}:${proxyData.port} with header set ${headerIndex + 1}`);
    
    try {
        const response = await axios.get(url, {
            httpAgent: agent,
            httpsAgent: agent,
            timeout: 15000,
            headers: headerConfigs[headerIndex % headerConfigs.length],
            // Status Code Handling - only reject on server errors
            validateStatus: function (status) {
                return status < 500;
            }
        });

        // Better Error Handling for 429 responses
        if (response.status === 429) {
            console.log(`❌ Rate limited (429) on proxy ${proxyData.proxy_address}`);
            return { 
                success: false, 
                rateLimited: true, 
                status: 429,
                proxy: proxyData.proxy_address
            };
        }

        if (response.status === 200 && response.data) {
            console.log(`✅ Success with proxy ${proxyData.proxy_address}`);
            return { 
                success: true, 
                data: response.data,
                proxy: proxyData.proxy_address,
                headerSet: headerIndex + 1
            };
        }

        console.log(`⚠️  Request failed with status ${response.status} on proxy ${proxyData.proxy_address}`);
        return { 
            success: false, 
            status: response.status,
            proxy: proxyData.proxy_address
        };

    } catch (err) {
        // Better Error Handling
        if (err.code === 'ECONNABORTED') {
            console.log(`⏰ Timeout on proxy ${proxyData.proxy_address}`);
        } else if (err.code === 'ECONNREFUSED') {
            console.log(`🔌 Connection refused on proxy ${proxyData.proxy_address}`);
        } else {
            console.log(`❌ Error on proxy ${proxyData.proxy_address}:`, err.message);
        }
        
        return { 
            success: false, 
            error: err.message,
            code: err.code,
            proxy: proxyData.proxy_address
        };
    }
}

// Main exported function
exports.getInstrackData = async (req, res) => {
    const username = req.params.username?.toLowerCase().trim();
    if (!username) {
        return res.status(400).json({ error: "Username is required" });
    }

    // Request Caching check
    const cacheKey = `instrack_${username}`;
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`✅ Serving cached data for username: ${username}`);
        return res.json({
            ...cached.data,
            cached: true,
            timestamp: new Date(cached.timestamp).toISOString()
        });
    }

    let proxies = [];
    try {
        // Get more proxies for better rotation
        proxies = await fetchProxies({ page_size: 25 });
        if (proxies.length === 0) {
            return res.status(500).json({ error: "No working proxies available" });
        }
        console.log(`🔄 Starting request with ${proxies.length} shuffled proxies`);
    } catch (err) {
        console.error("Failed to fetch proxies:", err.message);
        return res.status(500).json({ error: "Failed to fetch proxies" });
    }

    let successData = null;
    let rateLimitedCount = 0;
    const maxRetries = 3; // Multiple Retry Attempts

    // Main retry loop with Multiple Retry Attempts
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        console.log(`\n🔄 Attempt ${attempt + 1}/${maxRetries} for username: ${username}`);
        
        // Request Spacing - initial delay between attempts
        if (attempt > 0) {
            const backoffDelay = exponentialBackoff(attempt);
            console.log(`⏳ Exponential backoff: waiting ${Math.round(backoffDelay)}ms before next attempt`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

        // Try each proxy in shuffled order
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            // Rotate headers for each request
            const headerIndex = (attempt * proxies.length + i) % headerConfigs.length;
            
            const result = await fetchInstrackWithProxy(username, proxy, headerIndex, attempt);
            
            if (result.success) {
                successData = result.data;
                console.log(`🎉 Success on attempt ${attempt + 1} with proxy ${result.proxy} and header set ${result.headerSet}`);
                break;
            } else if (result.rateLimited) {
                rateLimitedCount++;
                console.log(`🚫 Rate limit count: ${rateLimitedCount}`);
                
                // Exponential backoff for rate limits
                if (rateLimitedCount >= 2) {
                    const rateLimitDelay = exponentialBackoff(rateLimitedCount, 2000, 15000);
                    console.log(`⏳ Rate limit backoff: waiting ${Math.round(rateLimitDelay)}ms`);
                    await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
                }
            }
            
            // Request Spacing - wait between proxy attempts (except the last one)
            if (i < proxies.length - 1 && !successData) {
                await randomDelay(1500, 4000);
            }
        }
        
        if (successData) break;
        
        // If no success in this attempt, reshuffle proxies for next attempt
        if (attempt < maxRetries - 1) {
            console.log(`❌ Attempt ${attempt + 1} failed, reshuffling proxies for next attempt`);
            proxies = shuffleArray(proxies);
        }
    }

    if (successData) {
        // Cache successful response
        requestCache.set(cacheKey, {
            data: successData,
            timestamp: Date.now()
        });
        
        // Clean old cache entries periodically
        if (Math.random() < 0.1) { // 10% chance to clean cache
            cleanupCache();
        }
        
        return res.json({
            ...successData,
            cached: false,
            timestamp: new Date().toISOString(),
            success: true
        });
    }

    // Final error response
    console.log(`💥 All ${maxRetries} attempts failed for username: ${username}`);
    return res.status(429).json({ 
        error: "Unable to fetch data after multiple attempts. Instrack rate limiting is active.",
        attempts: maxRetries,
        proxies_tried: proxies.length,
        suggestion: "Try again in a few minutes or use fewer requests.",
        timestamp: new Date().toISOString()
    });
};

// Optional: Periodic cache cleanup
setInterval(cleanupCache, 600000); // Clean every 10 minutes

console.log("🔄 Instrack service started with enhanced anti-rate-limiting features");