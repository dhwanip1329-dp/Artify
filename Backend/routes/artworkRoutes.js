const express = require("express");
const router = express.Router();

const artworkController = require("../controllers/artworkController");
const { verifyToken, isArtist } = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");

// Get all artworks
router.get("/", artworkController.getAllArtworks);

// Create artwork
router.post(
  "/",
  verifyToken,
  isArtist,
  upload.single("image"),
  artworkController.createArtwork
);

// Update artwork
router.put(
  "/:id",
  verifyToken,
  isArtist,
  artworkController.updateArtwork
);

// Delete artwork
router.delete(
  "/:id",
  verifyToken,
  isArtist,
  artworkController.deleteArtwork
);

module.exports = router;
