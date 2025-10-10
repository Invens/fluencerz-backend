const router = require('express').Router();
const ctl = require('../controllers/influencer.autoimport.controller');

// 1) Search using Instrack, show candidates
router.post('/search', ctl.search);

// 2) Add a single influencer by username
router.post('/add-by-username', ctl.addByUsername);

// 3) Bulk add (array of usernames)
router.post('/bulk-add',  ctl.bulkAdd);

// 4) Import by full Instrack payload (JSON blob you fetch server-side)
router.post('/import-by-payload', ctl.importByPayload);

module.exports = router;
