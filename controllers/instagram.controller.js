const axios = require('axios');

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

// Randomized Delays function
function randomDelay(min = 3000, max = 8000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`⏳ Waiting ${delay}ms before next request...`);
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Exponential backoff delay
function exponentialBackoff(attempt, baseDelay = 2000, maxDelay = 30000) {
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    const jitter = delay * 0.2 * Math.random(); // Add 20% jitter
    const totalDelay = delay + jitter;
    console.log(`📈 Exponential backoff: ${Math.round(totalDelay)}ms (attempt ${attempt})`);
    return totalDelay;
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
        console.log(`🧹 Cleaned ${cleanedCount} expired cache entries`);
    }
}

// Main function to fetch Instrack data without proxy
async function fetchInstrackDirect(username, headerIndex = 0, attempt = 0) {
    const url = `https://instrack.app/api/account/${username}`;
    
    // Better Logging
    console.log(`[Attempt ${attempt + 1}] Trying direct connection with header set ${headerIndex + 1}`);
    
    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: headerConfigs[headerIndex % headerConfigs.length],
            // Status Code Handling - only reject on server errors
            validateStatus: function (status) {
                return status < 500;
            }
        });

        // Better Error Handling for 429 responses
        if (response.status === 429) {
            console.log(`❌ Rate limited (429) - Too many requests`);
            return { 
                success: false, 
                rateLimited: true, 
                status: 429
            };
        }

        if (response.status === 200 && response.data) {
            console.log(`✅ Success with direct connection`);
            return { 
                success: true, 
                data: response.data,
                headerSet: headerIndex + 1
            };
        }

        if (response.status === 404) {
            console.log(`❌ User not found (404) - ${username}`);
            return { 
                success: false, 
                userNotFound: true,
                status: 404
            };
        }

        console.log(`⚠️  Request failed with status ${response.status}`);
        return { 
            success: false, 
            status: response.status
        };

    } catch (err) {
        // Better Error Handling
        if (err.code === 'ECONNABORTED') {
            console.log(`⏰ Timeout on direct connection`);
        } else if (err.code === 'ECONNREFUSED') {
            console.log(`🔌 Connection refused`);
        } else if (err.code === 'ENOTFOUND') {
            console.log(`🌐 DNS lookup failed`);
        } else {
            console.log(`❌ Error:`, err.message);
        }
        
        return { 
            success: false, 
            error: err.message,
            code: err.code
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

    let successData = null;
    let rateLimitedCount = 0;
    const maxRetries = 4; // Multiple Retry Attempts

    console.log(`🔄 Starting direct requests for username: ${username}`);

    // Main retry loop with Multiple Retry Attempts
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        console.log(`\n🔄 Attempt ${attempt + 1}/${maxRetries} for username: ${username}`);
        
        // Request Spacing - initial delay between attempts
        if (attempt > 0) {
            const backoffDelay = exponentialBackoff(attempt);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }

        // Try with different header configurations
        const headerIndex = attempt % headerConfigs.length;
        
        const result = await fetchInstrackDirect(username, headerIndex, attempt);
        
        if (result.success) {
            successData = result.data;
            console.log(`🎉 Success on attempt ${attempt + 1} with header set ${result.headerSet}`);
            break;
        } else if (result.rateLimited) {
            rateLimitedCount++;
            console.log(`🚫 Rate limit count: ${rateLimitedCount}`);
            
            // More aggressive backoff for rate limits
            if (rateLimitedCount >= 1) {
                const rateLimitDelay = exponentialBackoff(rateLimitedCount + 1, 3000, 20000);
                console.log(`⏳ Rate limit backoff: waiting ${Math.round(rateLimitDelay)}ms`);
                await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
            }
        } else if (result.userNotFound) {
            // If user not found, no need to retry
            console.log(`❌ User ${username} not found, stopping retries`);
            return res.status(404).json({ 
                error: "User not found",
                username: username
            });
        }
        
        // Request Spacing - wait between attempts if not the last one
        if (attempt < maxRetries - 1 && !successData) {
            await randomDelay(4000, 10000);
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
    console.log(`💥 All ${maxRetries} direct attempts failed for username: ${username}`);
    return res.status(429).json({ 
        error: "Unable to fetch data after multiple attempts. Instrack rate limiting is active.",
        attempts: maxRetries,
        suggestion: "Try again in a few minutes or use fewer requests.",
        timestamp: new Date().toISOString()
    });
};

// Additional endpoint for health check
exports.healthCheck = async (req, res) => {
    const cacheSize = requestCache.size;
    cleanupCache();
    
    return res.json({
        status: 'healthy',
        cache_size: cacheSize,
        header_configs: headerConfigs.length,
        timestamp: new Date().toISOString()
    });
};

// Optional: Periodic cache cleanup
setInterval(cleanupCache, 600000); // Clean every 10 minutes

console.log("🔄 Instrack service started with enhanced anti-rate-limiting features (Direct Mode)");