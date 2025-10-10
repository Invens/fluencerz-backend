// middleware/uploadDrive.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED = [
  // images
  'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml',
  // video
  'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm',
  // archives/docs
  'application/zip', 'application/x-zip-compressed',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const campaignId = String(req.params.id || req.body.campaign_id || 'misc');
    const userId = String(req.user?.id || 'unknown');
    const dir = path.join(__dirname, '..', 'uploads', 'drive', campaignId, userId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${unique}-${file.originalname}`);
  }
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED.includes(file.mimetype)) {
    return cb(new Error('File type not allowed'), false);
  }
  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 800 * 1024 * 1024 } // 800MB
});
