// services/refluencedScraper.js - UPDATED WITH AUTO PAGINATION
const axios = require('axios');

class RefluencedScraper {
  constructor(baseURL = 'https://refluenced.ch/api') {
    this.baseURL = baseURL;
    this.authToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzY0NDg5ODM2LCJpYXQiOjE3NjAxNjk4MzYsImp0aSI6ImQyY2NmM2RiOWE5NzRiOGVhOTA4NmIyOGJjMzU3YjVjIiwidXNlcl9pZCI6NDkwNjksInN1Yl9icmFuZF9pZHMiOls4Njc1XSwiYWdlbmN5X2lkcyI6WzI2NjhdLCJhY2Nlc3NfbGV2ZWwiOiJTSU5HTEVfQlJBTkQifQ.1mD3W-Db4Dy1brA5tHRAbAlAtugLBHHM36psWEd77Z0';
    
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://refluenced.de/',
      'Origin': 'https://refluenced.de',
      'Authorization': `Bearer ${this.authToken}`
    };
  }

  /**
   * Fetch ALL influencers with automatic pagination
   */
  async fetchAllInfluencers(autoFetchAll = true, maxPages = 0) {
    let allInfluencers = [];
    let nextUrl = null;
    let pageCount = 1; // Start from 1 since we fetch page 1 first

    try {
      console.log('🔍 Starting to fetch influencers...');
      
      // Fetch first page
      const firstPage = await this.fetchInfluencers();
      allInfluencers = firstPage.results || [];
      nextUrl = firstPage.next;
      
      console.log(`✅ Page 1: Found ${firstPage.results?.length || 0} influencers (Total: ${firstPage.count})`);

      // If autoFetchAll is true, fetch all subsequent pages
      if (autoFetchAll && nextUrl) {
        console.log('🔄 Auto-pagination enabled, fetching all pages...');
        
        while (nextUrl) {
          // Check if we've reached the max pages limit
          if (maxPages > 0 && pageCount >= maxPages) {
            console.log(`⏹️ Reached maximum pages limit (${maxPages}), stopping pagination`);
            break;
          }
          
          pageCount++;
          console.log(`📄 Fetching page ${pageCount}...`);
          
          try {
            const response = await axios.get(nextUrl, { 
              headers: this.headers,
              timeout: 30000 
            });
            
            const pageResults = response.data.results || [];
            allInfluencers = [...allInfluencers, ...pageResults];
            nextUrl = response.data.next;
            
            console.log(`✅ Page ${pageCount}: Found ${pageResults.length} influencers (Total so far: ${allInfluencers.length})`);
            
            // Rate limiting between pages
            await this.delay(800);
            
          } catch (pageError) {
            console.error(`❌ Error fetching page ${pageCount}:`, pageError.message);
            // Continue with what we have instead of failing completely
            break;
          }
        }
      } else if (nextUrl) {
        console.log('ℹ️ Auto-pagination disabled, only first page fetched');
      }

      console.log(`🎉 Completed! Fetched ${allInfluencers.length} influencers across ${pageCount} pages`);
      return allInfluencers;
      
    } catch (error) {
      console.error('❌ Error in fetchAllInfluencers:', error.message);
      // Return whatever we managed to fetch
      return allInfluencers;
    }
  }

  /**
   * Fetch Instagram feed with automatic pagination
   */
  async fetchAllInstagramFeed(influencerId, autoFetchAll = true, maxPosts = 0) {
    let allPosts = [];
    let nextUrl = null;
    let pageCount = 1;

    try {
      console.log(`📸 Starting to fetch Instagram feed for influencer: ${influencerId}`);
      
      // Fetch first page
      const firstPage = await this.fetchInstagramFeed(influencerId, 50); // Larger page size for efficiency
      allPosts = firstPage?.results || [];
      nextUrl = firstPage?.next;
      
      console.log(`✅ Page 1: Found ${allPosts.length} posts`);

      // If autoFetchAll is true, fetch all subsequent pages
      if (autoFetchAll && nextUrl) {
        console.log('🔄 Auto-pagination enabled for Instagram feed, fetching all pages...');
        
        while (nextUrl) {
          // Check if we've reached the max posts limit
          if (maxPosts > 0 && allPosts.length >= maxPosts) {
            console.log(`⏹️ Reached maximum posts limit (${maxPosts}), stopping pagination`);
            break;
          }
          
          pageCount++;
          console.log(`📄 Fetching Instagram feed page ${pageCount}...`);
          
          try {
            const response = await axios.get(nextUrl, { 
              headers: this.headers,
              timeout: 30000 
            });
            
            const pageResults = response.data.results || [];
            allPosts = [...allPosts, ...pageResults];
            nextUrl = response.data.next;
            
            console.log(`✅ Page ${pageCount}: Found ${pageResults.length} posts (Total so far: ${allPosts.length})`);
            
            // Rate limiting between pages
            await this.delay(600);
            
          } catch (pageError) {
            console.error(`❌ Error fetching Instagram feed page ${pageCount}:`, pageError.message);
            break;
          }
        }
      }

      console.log(`🎉 Completed! Fetched ${allPosts.length} Instagram posts across ${pageCount} pages`);
      
      return {
        count: allPosts.length,
        results: allPosts,
        next: null, // Since we fetched everything
        previous: null
      };
      
    } catch (error) {
      console.error(`❌ Error in fetchAllInstagramFeed for ${influencerId}:`, error.message);
      return {
        count: allPosts.length,
        results: allPosts,
        next: null,
        previous: null
      };
    }
  }

  async fetchInfluencers(params = {}) {
    try {
      const url = `${this.baseURL}/influencer/`;
      
      const response = await axios.get(url, {
        params: {
          location: 'United Kingdom',
          followers_start: 1000,
          followers_end: 50000,
          engagement_start: 1,
          engagement_end: 100,
          type: 'instagram',
          recommended: true,
          ...params
        },
        headers: this.headers,
        timeout: 30000
      });
      
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching influencers:', error.message);
      throw error;
    }
  }

  async fetchInstagramFeed(influencerId, pageSize = 50) {
    try {
      const url = `${this.baseURL}/harvest/instagram_feed/`;
      
      const response = await axios.get(url, {
        params: {
          influencer_id: influencerId,
          page_size: pageSize
        },
        headers: this.headers,
        timeout: 30000
      });
      
      return response.data;
    } catch (error) {
      console.error(`❌ Error fetching feed for influencer ${influencerId}:`, error.message);
      return null;
    }
  }

  setAuthToken(token) {
    this.authToken = token;
    this.headers.Authorization = `Bearer ${token}`;
    console.log('🔑 Auth token updated');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RefluencedScraper;