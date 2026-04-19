const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dir = 'uploads/';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, dir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `symptom-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (/^image\/(jpeg|png|webp|heic)$/.test(file.mimetype)) cb(null, true);
  else cb(new Error('Only JPEG/PNG/WEBP/HEIC images are accepted'));
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});
