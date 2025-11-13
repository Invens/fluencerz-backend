// services/refluencedDataMapper.js
class RefluencedDataMapper {
  
    /**
     * Map ALL Refluenced data to our Influencer table
     */
    mapCompleteInfluencerData(refluencedData, instagramFeed = null) {
      const user = refluencedData.user || {};
      const graphs = refluencedData.graphs || {};
      
      // Ensure we have valid data for required fields
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'Unknown Influencer';
      const email = this.generateTemporaryEmail(user.username, refluencedData.uuid).substring(0, 255);
      
      return {
        // Basic info - with validation
        full_name: fullName,
        email: email,
        
        // Profile media
        profile_image: refluencedData.picture640 || refluencedData.picture || '',
        profile_picture: refluencedData.picture320 || refluencedData.picture || '',
        
        // Niche & metrics - ensure numbers
        niche: this.extractNicheFromInterests(user.interests) || 'Lifestyle',
        followers_count: parseInt(refluencedData.followers || refluencedData.tiktok_followers || 0),
        engagement_rate: parseFloat(refluencedData.engagement || refluencedData.tiktok_engagement || 0),
        total_reach: this.estimateReach(refluencedData.followers),
        
        // Audience demographics - ensure proper format
        audience_age_group: this.extractPrimaryAgeGroup(graphs.ages || graphs.tiktok_ages) || '18-34',
        audience_gender: this.extractAudienceGender(graphs.genders || graphs.tiktok_genders),
        followers_by_country: this.extractFollowersByCountry(graphs.countries || graphs.tiktok_countries),
        
        // Social platforms - ensure array
        social_platforms: Array.isArray(this.mapAllSocialPlatforms(refluencedData)) 
          ? this.mapAllSocialPlatforms(refluencedData) 
          : [],
        
        // Location
        country: user.country || 'Switzerland',
        
        // Categories from interests - ensure array
        categories: Array.isArray(this.mapInterestsToCategories(user.interests))
          ? this.mapInterestsToCategories(user.interests)
          : ['Lifestyle'],
        
        // Communication channel - ensure object
        communication_channel: typeof this.mapCommunicationChannels(user) === 'object'
          ? this.mapCommunicationChannels(user)
          : {},
        
        // Portfolio from about me
        portfolio: user.aboutme || '',
        
        // Availability based on recent activity
        availability: user.active_recently ? 'available' : 'unavailable',
        is_onboarded: true,
        
        // ========== STORE ALL REFLUENCED DATA IN JSON FIELDS ==========
        
        // Store complete original Refluenced data - ensure object
        refluenced_raw_data: typeof refluencedData === 'object' ? {
          profile: refluencedData,
          user_data: user,
          graphs_data: graphs,
          awards: Array.isArray(refluencedData.awards) ? refluencedData.awards : [],
          images: Array.isArray(refluencedData.images) ? refluencedData.images : [],
          notification_settings: user.notification_settings || {}
        } : {},
        
        // Store Instagram feed/posts data - ensure array
        instagram_posts: Array.isArray(this.compileInstagramPosts(instagramFeed))
          ? this.compileInstagramPosts(instagramFeed)
          : [],
        
        // Store analytics and performance metrics - ensure object
        performance_metrics: typeof this.compilePerformanceMetrics(refluencedData, instagramFeed) === 'object'
          ? this.compilePerformanceMetrics(refluencedData, instagramFeed)
          : {},
        
        // Store audience analytics - ensure object
        audience_analytics: {
          cities: Array.isArray(graphs.cities) ? graphs.cities : [],
          countries: Array.isArray(graphs.countries) ? graphs.countries : [],
          ages: Array.isArray(graphs.ages) ? graphs.ages : [],
          genders: Array.isArray(graphs.genders) ? graphs.genders : [],
          tiktok_cities: Array.isArray(graphs.tiktok_cities) ? graphs.tiktok_cities : [],
          tiktok_countries: Array.isArray(graphs.tiktok_countries) ? graphs.tiktok_countries : [],
          tiktok_genders: Array.isArray(graphs.tiktok_genders) ? graphs.tiktok_genders : [],
          tiktok_ages: Array.isArray(graphs.tiktok_ages) ? graphs.tiktok_ages : []
        },
        
        // Original UUID for reference
        original_uuid: refluencedData.uuid ? refluencedData.uuid.toString() : null,
        
        created_at: new Date(),
        updated_at: new Date()
      };
    }
  
    /**
     * Compile Instagram posts data for storage - ensure array
     */
    compileInstagramPosts(feedData) {
      if (!feedData || !feedData.results || !Array.isArray(feedData.results)) return [];
      
      return feedData.results.map(post => ({
        id: post.id || null,
        media_id: post.media_id || null,
        media_type: post.media_type || 'IMAGE',
        media_product_type: post.media_product_type || 'FEED',
        caption: post.caption || '',
        timestamp: post.timestamp || new Date().toISOString(),
        like_count: parseInt(post.like_count || 0),
        comments_count: parseInt(post.comments_count || 0),
        play_count: parseInt(post.play_count || 0),
        permalink: post.permalink || '',
        thumbnail_url: post.thumbnail_file || '',
        carousel_children: Array.isArray(post.carousel_children) ? post.carousel_children : [],
        engagement_rate: this.calculatePostEngagement(post),
        created: post.created || new Date().toISOString(),
        modified: post.modified || new Date().toISOString()
      })).filter(post => post.id !== null); // Remove posts without ID
    }
  
    /**
     * Compile performance metrics
     */
    compilePerformanceMetrics(refluencedData, instagramFeed) {
      const posts = instagramFeed?.results || [];
      
      // Calculate averages from posts
      const totalLikes = posts.reduce((sum, post) => sum + (post.like_count || 0), 0);
      const totalComments = posts.reduce((sum, post) => sum + (post.comments_count || 0), 0);
      const totalPlays = posts.reduce((sum, post) => sum + (post.play_count || 0), 0);
      const postCount = posts.length;
      
      return {
        // From Refluenced
        rating: refluencedData.rating || 0,
        quality_rating: refluencedData.quality_rating || 0,
        reliability_rating: refluencedData.reliability_rating || 0,
        number_of_orders: refluencedData.number_of_orders || 0,
        cash_earned: refluencedData.cash_earned || 0,
        number_of_ratings: refluencedData.number_of_ratings || 0,
        
        // Calculated from posts
        avg_likes: postCount ? totalLikes / postCount : 0,
        avg_comments: postCount ? totalComments / postCount : 0,
        avg_plays: postCount ? totalPlays / postCount : 0,
        total_posts: postCount,
        
        // Platform specific
        instagram_median_views: refluencedData.instagram_median_views || 0,
        tiktok_median_views: refluencedData.tiktok_median_views || 0,
        tiktok_last_period_video_count: refluencedData.tiktok_last_period_video_count || 0,
        
        // Pricing
        calculated_price_feed: refluencedData.calculated_price_feed || 0,
        calculated_price_story: refluencedData.calculated_price_story || 0
      };
    }
  
    /**
     * Map ALL social platforms data
     */
    mapAllSocialPlatforms(refluencedData) {
      const platforms = [];
      
      // Instagram data
      if (refluencedData.followers) {
        platforms.push({
          platform: 'instagram',
          username: refluencedData.user?.username || '',
          followers: refluencedData.followers,
          engagement: refluencedData.engagement || 0,
          median_views: refluencedData.instagram_median_views || 0,
          is_verified: refluencedData.user?.is_verified || false,
          is_pro: refluencedData.user?.is_instagram_pro || false
        });
      }
      
      // TikTok data
      if (refluencedData.tiktok_followers) {
        platforms.push({
          platform: 'tiktok',
          username: refluencedData.user?.tiktok_username || '',
          followers: refluencedData.tiktok_followers,
          engagement: refluencedData.tiktok_engagement || 0,
          median_views: refluencedData.tiktok_median_views || 0,
          is_verified: refluencedData.user?.tiktok_verified || false,
          verified_date: refluencedData.user?.tiktok_verified_date || null,
          is_pro: refluencedData.user?.is_tiktok_pro || false
        });
      }
      
      return platforms;
    }
  
    /**
     * Map communication channels
     */
    mapCommunicationChannels(user) {
      return {
        instagram: {
          username: user.username || '',
          verified: user.is_verified || false
        },
        tiktok: {
          username: user.tiktok_username || '',
          verified: user.tiktok_verified || false
        },
        last_app_login: user.last_app_login || null,
        active_recently: user.active_recently || false
      };
    }
  
    // ========== HELPER METHODS ==========
    
    extractAudienceGender(genderData) {
      if (!genderData || !Array.isArray(genderData)) {
        return { male: 0, female: 0, other: 0 };
      }
      
      const result = { male: 0, female: 0, other: 0 };
      genderData.forEach(item => {
        if (item.label?.toLowerCase().includes('men')) {
          result.male = item.value || 0;
        } else if (item.label?.toLowerCase().includes('women')) {
          result.female = item.value || 0;
        }
      });
      
      return result;
    }
  
    extractFollowersByCountry(countryData) {
      if (!countryData || !Array.isArray(countryData)) {
        return [];
      }
      
      return countryData.map(country => ({
        country: country.label || '',
        percentage: country.value || 0
      })).slice(0, 5);
    }
  
    extractPrimaryAgeGroup(ageData) {
      if (!ageData || !Array.isArray(ageData) || ageData.length === 0) {
        return '18-34';
      }
      
      const primaryGroup = ageData.reduce((max, current) => 
        (current.value > max.value) ? current : max
      );
      
      return primaryGroup.label || '18-34';
    }
  
    extractNicheFromInterests(interests) {
      const interestMap = {
        1: 'Music', 2: 'Fitness', 4: 'Food', 6: 'Travel', 7: 'Fashion',
        5: 'Sports', 19: 'Lifestyle'
      };
      
      if (!interests || !Array.isArray(interests)) return 'Lifestyle';
      
      const niches = interests.map(id => interestMap[id]).filter(Boolean);
      return niches[0] || 'Lifestyle';
    }
  
    mapInterestsToCategories(interests) {
      const interestMap = {
        1: 'Music', 2: 'Fitness', 4: 'Food', 6: 'Travel', 7: 'Fashion',
        5: 'Sports', 19: 'Lifestyle'
      };
      
      if (!interests || !Array.isArray(interests)) return ['Lifestyle'];
      
      return interests.map(id => interestMap[id]).filter(Boolean);
    }
  
    estimateReach(followers) {
      return Math.floor((followers || 0) * 2);
    }
  
    calculatePostEngagement(post) {
      const engagement = (post.like_count || 0) + (post.comments_count || 0);
      return engagement;
    }
  
    generateTemporaryEmail(username, uuid) {
      // Use UUID + timestamp to ensure uniqueness
      const uniqueId = uuid || Date.now();
      const safeUsername = username ? username.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
      
      return `temp_${safeUsername}_${uniqueId}@refluenced-import.com`;
    }
  }
  
  module.exports = RefluencedDataMapper;