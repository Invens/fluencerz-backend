// controllers/refluencedImportController.js
const RefluencedScraper = require('../services/refluencedScraper');
const RefluencedDataMapper = require('../services/refluencedDataMapper');
const db = require('../models');

const scraper = new RefluencedScraper();
const mapper = new RefluencedDataMapper();

/**
 * Main import function with automatic pagination
 */
exports.importInfluencersFromRefluenced = async (req, res) => {
  console.log('📥 INCOMING REQUEST: importInfluencersFromRefluenced');
  console.log('📍 Request Body:', JSON.stringify(req.body, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  console.log('🌐 Request IP:', req.ip);
  console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
  
  try {
    const { 
      maxInfluencers = 0,
      includeFeed = true, 
      authToken,
      autoFetchAll = true,
      maxPages = 0,
      maxPostsPerInfluencer = 100,
      skipOnError = true
    } = req.body;
    
    console.log('🚀 Starting Refluenced data import with auto-pagination...');
    console.log('⚙️  Configuration:', {
      maxInfluencers: maxInfluencers || 'No limit',
      includeFeed,
      autoFetchAll,
      maxPages: maxPages || 'No limit',
      maxPostsPerInfluencer,
      skipOnError
    });
    
    // Update auth token if provided
    if (authToken) {
      console.log('🔑 Updating auth token...');
      scraper.setAuthToken(authToken);
    } else {
      console.log('🔑 Using default auth token');
    }
    
    // Step 1: Fetch ALL influencers with automatic pagination
    console.log('🔍 Fetching all influencers with auto-pagination...');
    const allInfluencers = await scraper.fetchAllInfluencers(autoFetchAll, maxPages);
    
    console.log('📊 Influencers fetch completed:', {
      totalFetched: allInfluencers.length,
      sample: allInfluencers.slice(0, 3).map(inf => ({
        name: `${inf.user?.first_name} ${inf.user?.last_name}`,
        username: inf.user?.username,
        uuid: inf.uuid
      }))
    });
    
    // Apply maxInfluencers limit if specified
    const influencersToImport = maxInfluencers > 0 
      ? allInfluencers.slice(0, maxInfluencers)
      : allInfluencers;
    
    console.log(`📥 Processing ${influencersToImport.length} influencers...`);
    
    const importResults = {
      total: influencersToImport.length,
      successful: 0,
      failed: 0,
      total_posts_imported: 0,
      details: []
    };

    // Step 2: Process each influencer
    for (const [index, refluencedInfluencer] of influencersToImport.entries()) {
      console.log(`\n🎯 PROCESSING INFLUENCER ${index + 1}/${influencersToImport.length}`);
      console.log('📋 Raw influencer data:', {
        uuid: refluencedInfluencer.uuid,
        username: refluencedInfluencer.user?.username,
        name: `${refluencedInfluencer.user?.first_name} ${refluencedInfluencer.user?.last_name}`,
        followers: refluencedInfluencer.followers,
        engagement: refluencedInfluencer.engagement
      });
      
      try {
        const username = refluencedInfluencer.user?.username || 'unknown';
        const uuid = refluencedInfluencer.uuid;
        
        // Fetch Instagram feed if requested
        let instagramFeed = null;
        let postsImported = 0;
        
        if (includeFeed && uuid) {
          console.log(`   📸 Fetching ALL Instagram posts for ${username}...`);
          instagramFeed = await scraper.fetchAllInstagramFeed(
            uuid, 
            autoFetchAll, 
            maxPostsPerInfluencer
          );
          postsImported = instagramFeed?.results?.length || 0;
          importResults.total_posts_imported += postsImported;
          console.log(`   📊 Found ${postsImported} Instagram posts for ${username}`);
        } else {
          console.log(`   ⚠️ Skipping Instagram feed fetch`);
        }
        
        // Map ALL data to our Influencer table with validation
        let influencerData;
        console.log('   🗺️  Mapping data to our schema...');
        try {
          influencerData = mapper.mapCompleteInfluencerData(refluencedInfluencer, instagramFeed);
          
          // Validate required fields
          if (!influencerData.full_name || !influencerData.email) {
            throw new Error('Missing required fields: full_name or email');
          }
          
          console.log('   ✅ Data mapping successful');
          console.log('   📋 Mapped data sample:', {
            full_name: influencerData.full_name,
            email: influencerData.email,
            followers_count: influencerData.followers_count,
            niche: influencerData.niche,
            posts_count: influencerData.instagram_posts?.length || 0
          });
          
        } catch (mappingError) {
          console.error(`   ❌ Data mapping failed: ${mappingError.message}`);
          throw new Error(`Data mapping failed: ${mappingError.message}`);
        }
        
        // Apply emergency validation fixes
        console.log('   🚑 Applying emergency validation fixes...');
        influencerData = applyEmergencyValidationFixes(influencerData);
        
        // Check if influencer already exists
        console.log('   🔍 Checking if influencer exists in database...');
        const existingInfluencer = await db.Influencer.findOne({
          where: {
            [db.Sequelize.Op.or]: [
              { original_uuid: uuid },
              { full_name: influencerData.full_name }
            ]
          }
        });

        console.log('   📊 Database check result:', {
          exists: !!existingInfluencer,
          original_uuid: uuid,
          full_name: influencerData.full_name
        });

        let savedInfluencer;
        if (existingInfluencer) {
          console.log('   🔄 Updating existing influencer...');
          const updatedData = mergeInfluencerData(existingInfluencer, influencerData);
          console.log('   📝 Update data prepared');
          await existingInfluencer.update(updatedData);
          savedInfluencer = existingInfluencer;
          console.log(`✅ Updated existing influencer: ${influencerData.full_name}`);
        } else {
          console.log('   ➕ Creating new influencer...');
          console.log('   💾 Attempting to save to database...');
          savedInfluencer = await db.Influencer.create(influencerData);
          console.log(`✅ Created new influencer: ${influencerData.full_name} (ID: ${savedInfluencer.id})`);
        }

        importResults.successful++;
        importResults.details.push({
          name: influencerData.full_name,
          username: username,
          status: 'success',
          followers: influencerData.followers_count,
          posts_imported: postsImported,
          platform: 'instagram',
          uuid: uuid
        });

        console.log(`   🎉 Successfully processed influencer ${index + 1}`);

     // In the importAllData function, update the error handling section:

} catch (error) {
  console.error(`❌ Failed to process influencer:`, error.message);
  
  // ADD THIS DETAILED ERROR LOGGING:
  console.error('   🔍 Error details:', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  
  // Log detailed validation errors
  if (error.name === 'SequelizeValidationError') {
    console.error('   🚨 VALIDATION ERRORS:');
    error.errors.forEach((err) => {
      console.error(`      - ${err.path}: ${err.message} (Value: ${JSON.stringify(err.value)})`);
    });
  }
  
  if (error.name === 'SequelizeUniqueConstraintError') {
    console.error('   🚨 UNIQUE CONSTRAINT ERROR:', error.message);
    console.error('   📋 Constraint details:', error.errors);
  }
  
  if (error.name === 'SequelizeDatabaseError') {
    console.error('   🚨 DATABASE ERROR:', error.message);
    console.error('   📋 SQL details:', error.sql);
  }

  importResults.failed++;
  importResults.details.push({
    name: refluencedInfluencer.user?.username || 'Unknown',
    status: 'failed',
    error: error.message
  });
}

      // Rate limiting between influencer processing
      console.log('   ⏳ Waiting 500ms before next influencer...');
      await scraper.delay(500);
    }

    // Final summary
    console.log(`\n🎉 IMPORT COMPLETED!`);
    console.log(`📊 FINAL SUMMARY:`);
    console.log(`   ✅ Successful: ${importResults.successful}`);
    console.log(`   ❌ Failed: ${importResults.failed}`);
    console.log(`   📸 Total Posts: ${importResults.total_posts_imported}`);
    console.log(`   👥 Total Influencers: ${importResults.total}`);
    console.log(`   📈 Success Rate: ${((importResults.successful / importResults.total) * 100).toFixed(2)}%`);
    
    console.log('📤 Sending response to client...');
    res.json({
      success: true,
      message: `Imported ${importResults.successful} influencers with ${importResults.total_posts_imported} posts`,
      data: importResults
    });

  } catch (error) {
    console.error('❌ IMPORT PROCESS FAILED:', error);
    console.error('🔍 Final error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message: 'Import process failed',
      error: error.message
    });
  }
};

/**
 * Test connection to Refluenced API
 */
exports.testConnection = async (req, res) => {
  console.log('📥 INCOMING REQUEST: testConnection');
  console.log('📍 Query Params:', JSON.stringify(req.query, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    console.log('🧪 Testing Refluenced API connection...');
    
    // Test with minimal parameters
    const testData = await scraper.fetchInfluencers({
      location: 'Switzerland',
      followers_start: 1000,
      followers_end: 5000,
      page_size: 2
    });
    
    console.log('✅ Refluenced API connection successful!');
    console.log('📊 Test results:', {
      total_influencers: testData.count,
      sample_influencers: testData.results.length
    });
    
    res.json({
      success: true,
      message: '✅ Refluenced API connection successful!',
      data: {
        total_influencers: testData.count,
        sample_influencers: testData.results.length,
        sample_data: testData.results.map(influencer => ({
          name: `${influencer.user?.first_name} ${influencer.user?.last_name}`,
          username: influencer.user?.username,
          followers: influencer.followers,
          engagement: influencer.engagement,
          uuid: influencer.uuid
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Refluenced API test failed:', error.message);
    console.error('🔍 Error details:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      message: 'Refluenced API test failed',
      error: error.message
    });
  }
};

/**
 * Test Instagram feed API
 */
exports.testInstagramFeed = async (req, res) => {
  console.log('📥 INCOMING REQUEST: testInstagramFeed');
  console.log('📍 Query Params:', JSON.stringify(req.query, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    const { influencerId } = req.query;
    console.log(`🧪 Testing Instagram feed for ID: ${influencerId}`);
    
    const feedData = await scraper.fetchInstagramFeed(influencerId, 5);
    
    console.log('✅ Instagram feed test successful!');
    console.log('📊 Feed results:', {
      posts_found: feedData?.results?.length || 0,
      has_next_page: !!feedData?.next
    });
    
    res.json({
      success: true,
      data: {
        influencer_id: influencerId,
        feed_data: feedData
      }
    });
  } catch (error) {
    console.error('❌ Instagram feed test failed:', error.message);
    console.error('🔍 Error details:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      message: 'Instagram feed test failed',
      error: error.message
    });
  }
};

/**
 * Test automatic pagination
 */
exports.testAutoPagination = async (req, res) => {
  console.log('📥 INCOMING REQUEST: testAutoPagination');
  console.log('📍 Query Params:', JSON.stringify(req.query, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    const { maxPages = 2 } = req.query;
    
    console.log('🧪 Testing auto-pagination...');
    
    const influencers = await scraper.fetchAllInfluencers(true, parseInt(maxPages));
    
    console.log('✅ Auto-pagination test successful!');
    console.log('📊 Pagination results:', {
      total_influencers: influencers.length,
      pages_processed: maxPages
    });
    
    res.json({
      success: true,
      message: `Auto-pagination test completed`,
      data: {
        total_influencers: influencers.length,
        influencers_sample: influencers.slice(0, 3).map(inf => ({
          name: `${inf.user?.first_name} ${inf.user?.last_name}`,
          username: inf.user?.username,
          followers: inf.followers,
          uuid: inf.uuid
        }))
      }
    });
  } catch (error) {
    console.error('❌ Auto-pagination test failed:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Auto-pagination test failed',
      error: error.message
    });
  }
};

/**
 * Fetch all data without limits - complete automation
 */
exports.importAllData = async (req, res) => {
  console.log('📥 INCOMING REQUEST: importAllData');
  console.log('📍 Request Body:', JSON.stringify(req.body, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    console.log('🚀 Starting COMPLETE data import (all pages, all posts)...');
    
    const { authToken } = req.body;
    
    if (authToken) {
      console.log('🔑 Using provided auth token');
      scraper.setAuthToken(authToken);
    }
    
    // Fetch ALL influencers with no limits
    const allInfluencers = await scraper.fetchAllInfluencers(true, 0);
    
    console.log(`📥 Processing ALL ${allInfluencers.length} influencers...`);
    
    const importResults = {
      total: allInfluencers.length,
      successful: 0,
      failed: 0,
      total_posts_imported: 0,
      details: []
    };

    // Process each influencer
    for (const [index, refluencedInfluencer] of allInfluencers.entries()) {
      console.log(`\n🔄 [${index + 1}/${allInfluencers.length}] Processing influencer...`);
      
      try {
        const username = refluencedInfluencer.user?.username;
        const uuid = refluencedInfluencer.uuid;
        
        // Fetch ALL Instagram posts
        let instagramFeed = null;
        let postsImported = 0;
        
        if (uuid) {
          console.log(`   📸 Fetching ALL Instagram posts for ${username}...`);
          instagramFeed = await scraper.fetchAllInstagramFeed(uuid, true, 0);
          postsImported = instagramFeed?.results?.length || 0;
          importResults.total_posts_imported += postsImported;
          console.log(`   📊 Found ${postsImported} Instagram posts`);
        }
        
        // Map data to our Influencer table
        const influencerData = mapper.mapCompleteInfluencerData(refluencedInfluencer, instagramFeed);
        
        // Apply emergency validation fixes
        console.log('   🚑 Applying emergency validation fixes...');
        const fixedInfluencerData = applyEmergencyValidationFixes(influencerData);
        
        // Check if influencer already exists
        const existingInfluencer = await db.Influencer.findOne({
          where: {
            [db.Sequelize.Op.or]: [
              { original_uuid: uuid },
              { full_name: fixedInfluencerData.full_name }
            ]
          }
        });

        if (existingInfluencer) {
          const updatedData = mergeInfluencerData(existingInfluencer, fixedInfluencerData);
          await existingInfluencer.update(updatedData);
          console.log(`✅ Updated existing influencer: ${fixedInfluencerData.full_name}`);
        } else {
          await db.Influencer.create(fixedInfluencerData);
          console.log(`✅ Created new influencer: ${fixedInfluencerData.full_name}`);
        }

        importResults.successful++;
        importResults.details.push({
          name: fixedInfluencerData.full_name,
          username: username,
          status: 'success',
          followers: fixedInfluencerData.followers_count,
          posts_imported: postsImported
        });

    // In the importAllData function, update the error handling section:

} catch (error) {
  console.error(`❌ Failed to process influencer:`, error.message);
  
  // ADD THIS DETAILED ERROR LOGGING:
  console.error('   🔍 Error details:', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  
  // Log detailed validation errors
  if (error.name === 'SequelizeValidationError') {
    console.error('   🚨 VALIDATION ERRORS:');
    error.errors.forEach((err) => {
      console.error(`      - ${err.path}: ${err.message} (Value: ${JSON.stringify(err.value)})`);
    });
  }
  
  if (error.name === 'SequelizeUniqueConstraintError') {
    console.error('   🚨 UNIQUE CONSTRAINT ERROR:', error.message);
    console.error('   📋 Constraint details:', error.errors);
  }
  
  if (error.name === 'SequelizeDatabaseError') {
    console.error('   🚨 DATABASE ERROR:', error.message);
    console.error('   📋 SQL details:', error.sql);
  }

  importResults.failed++;
  importResults.details.push({
    name: refluencedInfluencer.user?.username || 'Unknown',
    status: 'failed',
    error: error.message
  });
}

      await scraper.delay(500);
    }

    console.log(`\n🎉 COMPLETE IMPORT FINISHED!`);
    console.log(`📊 Final Summary:`);
    console.log(`   ✅ Successful: ${importResults.successful}`);
    console.log(`   ❌ Failed: ${importResults.failed}`);
    console.log(`   📸 Total Posts: ${importResults.total_posts_imported}`);
    
    res.json({
      success: true,
      message: `Complete import finished! ${importResults.successful} influencers with ${importResults.total_posts_imported} posts`,
      data: importResults
    });

  } catch (error) {
    console.error('❌ Complete import failed:', error);
    res.status(500).json({
      success: false,
      message: 'Complete import failed',
      error: error.message
    });
  }
};

/**
 * Get imported influencers with their data
 */
exports.getImportedInfluencers = async (req, res) => {
  console.log('📥 INCOMING REQUEST: getImportedInfluencers');
  console.log('📍 Query Params:', JSON.stringify(req.query, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    console.log('🔍 Fetching imported influencers from database...');
    
    const influencers = await db.Influencer.findAndCountAll({
      where: { original_uuid: { [db.Sequelize.Op.ne]: null } },
      attributes: [
        'id',
        'full_name',
        'profile_image',
        'niche',
        'followers_count',
        'engagement_rate',
        'country',
        'performance_metrics',
        'instagram_posts',
        'created_at'
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    console.log('✅ Database query successful:', {
      total: influencers.count,
      returned: influencers.rows.length,
      page: parseInt(page),
      totalPages: Math.ceil(influencers.count / limit)
    });

    res.json({
      success: true,
      data: {
        influencers: influencers.rows,
        total: influencers.count,
        page: parseInt(page),
        totalPages: Math.ceil(influencers.count / limit)
      }
    });
  } catch (error) {
    console.error('❌ Failed to fetch imported influencers:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch imported influencers',
      error: error.message
    });
  }
};

/**
 * Get specific influencer with all imported data
 */
exports.getInfluencerWithFullData = async (req, res) => {
  console.log('📥 INCOMING REQUEST: getInfluencerWithFullData');
  console.log('📍 Params:', JSON.stringify(req.params, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    const { id } = req.params;

    console.log(`🔍 Fetching influencer with ID: ${id}...`);

    const influencer = await db.Influencer.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!influencer) {
      console.log('❌ Influencer not found');
      return res.status(404).json({
        success: false,
        message: 'Influencer not found'
      });
    }

    console.log('✅ Influencer found:', {
      id: influencer.id,
      name: influencer.full_name,
      posts: influencer.instagram_posts?.length || 0
    });

    res.json({
      success: true,
      data: influencer
    });
  } catch (error) {
    console.error('❌ Failed to fetch influencer data:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch influencer data',
      error: error.message
    });
  }
};

/**
 * Get import statistics
 */
exports.getImportStats = async (req, res) => {
  console.log('📥 INCOMING REQUEST: getImportStats');
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    console.log('📊 Calculating import statistics...');

    const totalImported = await db.Influencer.count({
      where: { original_uuid: { [db.Sequelize.Op.ne]: null } }
    });

    const totalInfluencers = await db.Influencer.count();

    // Get influencers with posts count
    const influencersWithPosts = await db.Influencer.findAll({
      where: { original_uuid: { [db.Sequelize.Op.ne]: null } },
      attributes: ['id', 'full_name', 'instagram_posts']
    });

    const totalPosts = influencersWithPosts.reduce((sum, influencer) => {
      return sum + (Array.isArray(influencer.instagram_posts) ? influencer.instagram_posts.length : 0);
    }, 0);

    const influencersWithPostsCount = influencersWithPosts.filter(influencer => 
      Array.isArray(influencer.instagram_posts) && influencer.instagram_posts.length > 0
    ).length;

    const stats = {
      imported_influencers: totalImported,
      total_influencers: totalInfluencers,
      total_posts_imported: totalPosts,
      influencers_with_posts: influencersWithPostsCount,
      import_coverage: totalImported > 0 ? ((totalImported / totalInfluencers) * 100).toFixed(2) + '%' : '0%'
    };

    console.log('✅ Statistics calculated:', stats);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('❌ Failed to get import statistics:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get import statistics',
      error: error.message
    });
  }
};

/**
 * Delete imported data (for testing/reset)
 */
exports.deleteImportedData = async (req, res) => {
  console.log('📥 INCOMING REQUEST: deleteImportedData');
  console.log('📍 Request Body:', JSON.stringify(req.body, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    const { confirm } = req.body;
    
    if (!confirm) {
      console.log('❌ Delete confirmation required but not provided');
      return res.status(400).json({
        success: false,
        message: 'Confirmation required. Send { "confirm": true } in request body.'
      });
    }

    console.log('🗑️  Deleting all imported influencers...');

    const deletedCount = await db.Influencer.destroy({
      where: { original_uuid: { [db.Sequelize.Op.ne]: null } }
    });

    console.log(`✅ Deleted ${deletedCount} imported influencers`);

    res.json({
      success: true,
      message: `Deleted ${deletedCount} imported influencers`,
      data: { deleted_count: deletedCount }
    });
  } catch (error) {
    console.error('❌ Error deleting imported data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete imported data',
      error: error.message
    });
  }
};

/**
 * Debug individual influencer
 */
exports.debugInfluencer = async (req, res) => {
  console.log('📥 INCOMING REQUEST: debugInfluencer');
  console.log('📍 Query Params:', JSON.stringify(req.query, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    const { influencerId } = req.query;
    
    console.log(`🐛 Debugging influencer ID: ${influencerId}`);
    
    // Fetch the specific influencer
    const testData = await scraper.fetchInfluencers({
      page_size: 1,
    });
    
    if (!testData.results || testData.results.length === 0) {
      console.log('❌ Influencer not found in Refluenced API');
      return res.status(404).json({
        success: false,
        message: 'Influencer not found'
      });
    }
    
    const influencer = testData.results[0];
    console.log('📋 Raw influencer data received');
    
    // Try to map the data
    const mappedData = mapper.mapCompleteInfluencerData(influencer, null);
    console.log('✅ Data mapping completed');
    
    // Apply emergency fixes
    console.log('🚑 Applying emergency validation fixes...');
    const fixedData = applyEmergencyValidationFixes(mappedData);
    
    // Try to save it
    try {
      console.log('💾 Attempting to save to database...');
      const saved = await db.Influencer.create(fixedData);
      console.log('✅ Successfully saved to database');
      
      res.json({
        success: true,
        message: 'Influencer processed successfully',
        data: {
          raw_data: influencer,
          mapped_data: mappedData,
          fixed_data: fixedData,
          saved_id: saved.id
        }
      });
      
    } catch (saveError) {
      console.error('❌ Save error:', saveError.message);
      if (saveError.name === 'SequelizeValidationError') {
        console.error('🚨 VALIDATION ERRORS:');
        saveError.errors.forEach((err) => {
          console.error(`   - ${err.path}: ${err.message} (Value: ${JSON.stringify(err.value)})`);
        });
      }
      
      res.status(400).json({
        success: false,
        message: 'Failed to save influencer',
        error: saveError.message,
        validation_errors: saveError.errors || []
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message
    });
  }
};

/**
 * Debug failing influencer by UUID
 */
exports.debugFailingInfluencer = async (req, res) => {
  console.log('📥 INCOMING REQUEST: debugFailingInfluencer');
  console.log('📍 Query Params:', JSON.stringify(req.query, null, 2));
  console.log('👤 Request User:', req.user ? req.user.id : 'No user');
  
  try {
    const { uuid } = req.query;
    
    console.log(`🐛 Debugging failing influencer with UUID: ${uuid}`);
    
    // Fetch the specific influencer
    const allInfluencers = await scraper.fetchAllInfluencers(true, 1);
    const influencer = allInfluencers.find(inf => inf.uuid == uuid);
    
    if (!influencer) {
      return res.status(404).json({
        success: false,
        message: 'Influencer not found'
      });
    }
    
    console.log('📋 Raw influencer data:', JSON.stringify(influencer, null, 2));
    
    // Try to map the data
    const mappedData = mapper.mapCompleteInfluencerData(influencer, null);
    console.log('📋 Mapped data:', JSON.stringify(mappedData, null, 2));
    
    // Apply emergency fixes
    const fixedData = applyEmergencyValidationFixes(mappedData);
    console.log('📋 Fixed data:', JSON.stringify(fixedData, null, 2));
    
    // Check field lengths
    console.log('📏 Field lengths check:');
    Object.keys(fixedData).forEach(key => {
      if (typeof fixedData[key] === 'string') {
        console.log(`   - ${key}: ${fixedData[key].length} chars`);
      }
    });
    
    // Try to save it
    try {
      const saved = await db.Influencer.create(fixedData);
      console.log('✅ Successfully saved to database');
      
      res.json({
        success: true,
        message: 'Influencer processed successfully',
        data: {
          saved_id: saved.id,
          field_lengths: Object.keys(fixedData).reduce((acc, key) => {
            if (typeof fixedData[key] === 'string') {
              acc[key] = fixedData[key].length;
            }
            return acc;
          }, {})
        }
      });
      
    } catch (saveError) {
      console.error('❌ Save error:', saveError.message);
      if (saveError.name === 'SequelizeValidationError') {
        console.error('🚨 VALIDATION ERRORS:');
        saveError.errors.forEach((err) => {
          console.error(`   - ${err.path}: ${err.message} (Value: ${JSON.stringify(err.value)})`);
        });
      }
      
      res.status(400).json({
        success: false,
        message: 'Failed to save influencer',
        error: saveError.message,
        validation_errors: saveError.errors || []
      });
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error.message
    });
  }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Apply emergency validation fixes to influencer data
 */
// Replace the current emergency validation fixes function with this improved version:

/**
 * Apply emergency validation fixes to influencer data
 */
function applyEmergencyValidationFixes(influencerData) {
  console.log('   🚑 Applying emergency validation fixes...');
  
  const fixesApplied = [];
  
  // Fix 1: Ensure email is not too long
  if (influencerData.email && influencerData.email.length > 255) {
    const originalLength = influencerData.email.length;
    influencerData.email = influencerData.email.substring(0, 255);
    fixesApplied.push(`email: ${originalLength} → 255`);
  }
  
  // Fix 2: Ensure full_name is not too long
  if (influencerData.full_name && influencerData.full_name.length > 255) {
    const originalLength = influencerData.full_name.length;
    influencerData.full_name = influencerData.full_name.substring(0, 255);
    fixesApplied.push(`full_name: ${originalLength} → 255`);
  }
  
  // Fix 3: Ensure niche is not too long
  if (influencerData.niche && influencerData.niche.length > 100) {
    const originalLength = influencerData.niche.length;
    influencerData.niche = influencerData.niche.substring(0, 100);
    fixesApplied.push(`niche: ${originalLength} → 100`);
  }
  
  // Fix 4: Ensure country is not too long
  if (influencerData.country && influencerData.country.length > 100) {
    const originalLength = influencerData.country.length;
    influencerData.country = influencerData.country.substring(0, 100);
    fixesApplied.push(`country: ${originalLength} → 100`);
  }
  
  // Fix 5: Ensure phone is not too long
  if (influencerData.phone && influencerData.phone.length > 50) {
    const originalLength = influencerData.phone.length;
    influencerData.phone = influencerData.phone.substring(0, 50);
    fixesApplied.push(`phone: ${originalLength} → 50`);
  }
  
  // Fix 6: Ensure skype is not too long
  if (influencerData.skype && influencerData.skype.length > 100) {
    const originalLength = influencerData.skype.length;
    influencerData.skype = influencerData.skype.substring(0, 100);
    fixesApplied.push(`skype: ${originalLength} → 100`);
  }
  
  // Fix 7: Ensure portfolio is not too long
  if (influencerData.portfolio && influencerData.portfolio.length > 1000) {
    const originalLength = influencerData.portfolio.length;
    influencerData.portfolio = influencerData.portfolio.substring(0, 1000);
    fixesApplied.push(`portfolio: ${originalLength} → 1000`);
  }
  
  // Fix 8: Ensure profile_image URLs are not too long
  if (influencerData.profile_image && influencerData.profile_image.length > 500) {
    const originalLength = influencerData.profile_image.length;
    influencerData.profile_image = influencerData.profile_image.substring(0, 500);
    fixesApplied.push(`profile_image: ${originalLength} → 500`);
  }
  
  if (influencerData.profile_picture && influencerData.profile_picture.length > 500) {
    const originalLength = influencerData.profile_picture.length;
    influencerData.profile_picture = influencerData.profile_picture.substring(0, 500);
    fixesApplied.push(`profile_picture: ${originalLength} → 500`);
  }
  
  if (fixesApplied.length > 0) {
    console.log('   ✅ Applied fixes:', fixesApplied);
  } else {
    console.log('   ✅ No fixes needed');
  }
  
  return influencerData;
}

/**
 * Merge existing influencer data with new data - FIXED
 */
function mergeInfluencerData(existingInfluencer, newData) {
  console.log('   🔄 Merging influencer data...');
  
  // Ensure all JSON fields are properly formatted
  const existingPosts = Array.isArray(existingInfluencer.instagram_posts) 
    ? existingInfluencer.instagram_posts 
    : [];
  
  const existingPlatforms = Array.isArray(existingInfluencer.social_platforms) 
    ? existingInfluencer.social_platforms 
    : [];

  const newPosts = Array.isArray(newData.instagram_posts) 
    ? newData.instagram_posts 
    : [];
  
  const newPlatforms = Array.isArray(newData.social_platforms) 
    ? newData.social_platforms 
    : [];

  console.log('   📊 Merge stats:', {
    existing_posts: existingPosts.length,
    new_posts: newPosts.length,
    existing_platforms: existingPlatforms.length,
    new_platforms: newPlatforms.length
  });

  return {
    ...newData,
    
    // Merge social platforms (avoid duplicates) - with array validation
    social_platforms: mergeSocialPlatforms(existingPlatforms, newPlatforms),
    
    // Merge Instagram posts (append new posts) - with array validation
    instagram_posts: mergeInstagramPosts(existingPosts, newPosts),
    
    // Update performance metrics with latest data
    performance_metrics: typeof newData.performance_metrics === 'object' 
      ? newData.performance_metrics 
      : {},
    
    // Keep the original creation date
    created_at: existingInfluencer.created_at
  };
}

/**
 * Merge social platforms without duplicates - FIXED
 */
function mergeSocialPlatforms(existingPlatforms, newPlatforms) {
  // Ensure both are arrays
  const existing = Array.isArray(existingPlatforms) ? existingPlatforms : [];
  const newOnes = Array.isArray(newPlatforms) ? newPlatforms : [];
  
  const merged = [...existing];
  
  newOnes.forEach(newPlatform => {
    // Ensure platform has required properties
    if (newPlatform && newPlatform.platform) {
      const existingIndex = merged.findIndex(p => p.platform === newPlatform.platform);
      if (existingIndex >= 0) {
        // Update existing platform data
        merged[existingIndex] = { ...merged[existingIndex], ...newPlatform };
      } else {
        // Add new platform
        merged.push(newPlatform);
      }
    }
  });
  
  return merged;
}

/**
 * Merge Instagram posts (avoid duplicates by post ID) - FIXED
 */
function mergeInstagramPosts(existingPosts, newPosts) {
  // Ensure both are arrays
  const existing = Array.isArray(existingPosts) ? existingPosts : [];
  const newOnes = Array.isArray(newPosts) ? newPosts : [];
  
  const postMap = new Map();
  
  // Add all existing posts to map
  existing.forEach(post => {
    if (post && post.id) {
      postMap.set(post.id, post);
    }
  });
  
  // Add or update with new posts
  newOnes.forEach(post => {
    if (post && post.id) {
      postMap.set(post.id, post);
    }
  });
  
  const mergedPosts = Array.from(postMap.values());
  
  // Sort by timestamp, handling invalid dates
  return mergedPosts.sort((a, b) => {
    try {
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      return dateB - dateA;
    } catch {
      return 0;
    }
  });
}