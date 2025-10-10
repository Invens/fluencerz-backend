const express = require('express');
const cors = require('cors');
const db = require('./models');
const app = express();
require('dotenv').config();
const authRoutes = require('./routes/auth.routes');
const COllabRoutes  = require('./routes/collab.routes');
const influencerRoutes = require('./routes/influencer.routes');
const adminRoutes = require('./routes/admin.routes');
const campaignRoutes = require('./routes/campaign.routes');
const BrandRequest = require('./routes/brand.routes');
const InstagramRoutes = require('./routes/instagram.routes');
const InstagramInsights = require('./routes/InstagramInsight.routes');
const InfluencerAutoImport = require('./routes/influencer.autoimport.routes');


app.use(cors({
  origin: '*', 
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
  res.send('Influencer Collab Backend is Live 🔥');
});

app.use('/api/auth', authRoutes);
app.use('/api/collab', COllabRoutes);
app.use('/api/influencer', influencerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campaign', campaignRoutes);
app.use('/api/instagram/', InstagramRoutes);
app.use('/api/brand', BrandRequest);
app.use('/connect', InstagramInsights);

app.use('/api/auto-import', InfluencerAutoImport);



// ✅ Just authenticate (DO NOT sync)
db.sequelize.authenticate()
  .then(() => console.log('✅ Connected to existing database.'))
  .catch(err => console.error('❌ DB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
