const ErrorHandler = require("../utils/ErrorHandler");
const express = require("express");
const router = express.Router();
const catchAsyncError = require("../middleware/catchAsyncError");
const Messages = require("../model/messages");
const { upload } = require("../multer");
const cloudinary = require("../cloudinary.js");

// Create new message
router.post(
  "/create-new-message",
  upload.single("images"),
  catchAsyncError(async (req, res, next) => {
    try {
      const messageData = {};

      //if message comes image
      if (req.file) {
        // Upload image to Cloudinary
        const uploadStream = cloudinary.v2.uploader.upload_stream(
          { folder: "messages_image" },
          async (error, result) => {
            if (error) return next(new ErrorHandler(error.message, 500));

            // Store uploaded image info
            const uploadedImage = {
              public_id: result.public_id,
              url: result.secure_url,
            };

            // Build message data
            messageData.images = uploadedImage;
            messageData.conversationId = req.body.conversationId;
            messageData.sender = req.body.sender;
            messageData.text = req.body.text;

            // Save message in DB
            const message = new Messages(messageData);
            await message.save();

            // Send response
            res.status(201).json({
              success: true,
              message,
            });
          }
        );
        // Pipe the buffer to cloudinary (starts upload)
        uploadStream.end(req.file.buffer);
      } else {
        //if message comes without image
        messageData.conversationId = req.body.conversationId;
        messageData.sender = req.body.sender;
        messageData.text = req.body.text;

        // Save message in DB
        const message = new Messages(messageData);
        await message.save();

        // Send response
        res.status(201).json({
          success: true,
          message,
        });
      }
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//get all messages with conversation id
router.get(
  "/get-all-messages/:id",
  catchAsyncError(async (req, res, next) => {
    try {
      const messages = await Messages.find({
        conversationId: req.params.id,
      });

      res.status(201).json({
        success: true,
        messages,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message), 500);
    }
  })
);

module.exports = router;
