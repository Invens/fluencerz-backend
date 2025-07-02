const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 🔧 Utility to create folder dynamically based on userType
const getFolder = (userType) => {
  const base = './uploads';
  const folder = userType === 'brand' ? 'brands' : 'influencers';
  const fullPath = path.join(base, folder);

  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }

  return fullPath;
};

// ⚙️ Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userType = req.user?.userType || req.body.userType; // from token or body
    const folderPath = getFolder(userType);
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${file.fieldname}${ext}`;
    cb(null, uniqueName);
  }
});

// ✅ File type check
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    return cb(new Error('Only JPG, JPEG, PNG files allowed'), false);
  }
  cb(null, true);
};

// 📦 Final upload instance
const upload = multer({ storage, fileFilter });

module.exports = upload;
