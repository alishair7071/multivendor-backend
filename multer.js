const multer = require("multer");

// Store file in memory (RAM), not disk
const storage = multer.memoryStorage();

exports.upload = multer({ storage });
