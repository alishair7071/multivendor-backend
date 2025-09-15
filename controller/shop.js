const express = require("express");
const path = require("path");
const router = express.Router();
const fs = require("fs");
const sendMail = require("../utils/sendMail.js");
const jwt = require("jsonwebtoken");
const sendToken = require("../utils/jwtToken.js");
const { isAuthenticated, isSeller, isAdmin } = require("../middleware/auth.js");
const { upload } = require("../multer.js");
const Shop = require("../model/shop.js");
const catchAsyncError = require("../middleware/catchAsyncError.js");
const ErrorHandler = require("../utils/ErrorHandler.js");
const sendShopToken = require("../utils/shopToken.js");
const cloudinary = require("../cloudinary.js");


//create activation token
const createActivationToken = (user) => {
  return jwt.sign(user, process.env.ACTIVATION_SECRET, {
    expiresIn: "15m",
  });
};

router.post("/create-shop", upload.single("file"), async (req, res, next) => {
  try {
    const { email } = req.body;
    const sellerEmail = await Shop.findOne({ email });

    if (sellerEmail) {
      return next(new ErrorHandler("User already exists", 400));
    }

    const result = await cloudinary.v2.uploader.upload_stream(
      { folder: "avatars" },
      async (error, result) => {
        if (error) return next(new ErrorHandler(error.message, 500));

        const seller = {
          shopName: req.body.shopName,
          email: email,
          password: req.body.password,
          avatar: {
            public_id: result.public_id,
            url: result.secure_url,
          },
          address: req.body.address,
          phoneNumber: req.body.phoneNumber,
          zipCode: req.body.zipCode,
        };

        const activationToken = createActivationToken(seller);
        const activationUrl = `https://frontend-multivendor.netlify.app/seller/activation/${activationToken}`;

        try {
          await sendMail({
            mail: seller.email,
            subject: "Activate your Shop",
            message: `Hello ${seller.shopName}, please click on the link to activate your shop: ${activationUrl}`,
          });

          res.status(201).json({
            message: `Please check your email:- ${seller.email} to confirm your shop`,
          });
        } catch (e) {
          return next(new ErrorHandler(e.message, 500));
        }
      }
    );

    // Pipe the buffer to cloudinary
    result.end(req.file.buffer);
  } catch (e) {
    return next(new ErrorHandler(e.message, 500));
  }
});

//activate seller
router.post(
  "/activation",
  catchAsyncError(async (req, res, next) => {
    try {
      const { activation_token } = req.body;
      console.log(activation_token);

      const newSeller = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET
      );

      if (!newSeller) {
        console.log("user not verified");
        return next(new ErrorHandler("Inavlid Token", 400));
      }

      const {
        shopName,
        email,
        password,
        avatar,
        zipCode,
        address,
        phoneNumber,
      } = newSeller;
      const userEmail = await Shop.findOne({ email });

      if (userEmail) {
        console.log("account already created");
        return next(new ErrorHandler("User Already Exists", 400));
      }

      let createdSeller = await Shop.create({
        shopName,
        email,
        password,
        avatar,
        zipCode,
        address,
        phoneNumber,
      });

      console.log(createdSeller);
      console.log(createdSeller.email);

      sendShopToken(createdSeller, 201, res);
    } catch (e) {
      console.log("catch error: " + e.message);
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//login seller
router.post(
  "/login-shop",
  catchAsyncError(async (req, res, next) => {
    try {
      console.log("login called");
      const { email, password } = req.body;
      if (!email || !password) {
        return next(new ErrorHandler("Please provide all the fields", 400));
      }

      const user = await Shop.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User does not exists", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(new ErrorHandler("Invalid Credentials!"));
      }

      sendShopToken(user, 201, res);
    } catch (e) {}
  })
);

//loadShop
router.get(
  "/getSeller",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const seller = await Shop.findById(req.seller._id);
      if (!seller) {
        return next(new ErrorHandler("User doesn't exists", 400));
      }

      res.status(200).json({
        success: true,
        seller,
      });
    } catch (e) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//log-out shop
router.get(
  "/logout",
  catchAsyncError(async (req, res, next) => {
    try {
      /*  res.cookie("seller_token", "", {
        expires: new Date(0),
        httpOnly: true,
        sameSite: "None",
        secure: true,
        path: "/",
      });
*/

      res.clearCookie("seller_token", {
        httpOnly: true,
        sameSite: "None",
        secure: true,
        path: "/",
      });

      res.status(200).json({
        success: true,
        message: "Log out successful!",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// get shop info
router.get(
  "/get-shop-info/:id",
  catchAsyncError(async (req, res, next) => {
    try {
      const shop = await Shop.findById(req.params.id);

      res.status(201).json({
        success: true,
        shop,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update shop profile picture
router.put(
  "/update-shop-avatar",
  isSeller,
  upload.single("image"),
  catchAsyncError(async (req, res, next) => {
    try {
      let existsSeller = await Shop.findById(req.seller._id);

      if (!existsSeller) {
        return next(new ErrorHandler("User does not exists", 400));
      }

      const existAvatarPath = `uploads/${existsSeller.avatar}`;

      if (fs.existsSync(existAvatarPath)) {
        fs.unlinkSync(existAvatarPath); // ✅ deletes synchronously and safely
      }

      console.log(req.seller);

      const fileUrl = req.file.filename;
      const seller = await Shop.findByIdAndUpdate(
        req.seller._id,
        { avatar: fileUrl },
        { new: true }
      );

      res.status(200).json({
        success: true,
        seller: seller,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// update seller info
router.put(
  "/update-seller-info",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const { shopName, description, address, phoneNumber, zipCode } = req.body;

      const shop = await Shop.findOne(req.seller._id);

      if (!shop) {
        return next(new ErrorHandler("User not found", 400));
      }

      shop.shopName = shopName;
      shop.description = description;
      shop.address = address;
      shop.phoneNumber = phoneNumber;
      shop.zipCode = zipCode;

      await shop.save();

      res.status(201).json({
        success: true,
        shop,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//get seller information with user id
router.get(
  "/user-info/:id",
  catchAsyncError(async (req, res, next) => {
    try {
      const user = await Shop.findById(req.params.id);

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

// all sellers --- for admin
router.get(
  "/admin-all-sellers",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncError(async (req, res, next) => {
    try {
      const sellers = await Shop.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        sellers,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//delete seller ------ admin
router.delete(
  "/delete-seller/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncError(async (req, res, next) => {
    try {
      const seller = await Shop.findById(req.params.id);
      if (!seller) {
        return next(new ErrorHandler("Seller does not exist", 400));
      }

      await Shop.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        message: "Seller deleted successfully",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//update withdraw method ----- seller
router.put(
  "/update-withdraw-method",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const { withdrawMethod } = req.body;

      const seller = await Shop.findByIdAndUpdate(req.seller._id, {
        withdrawMethod,
      });

      res.status(201).json({
        success: true,
        seller,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

// delete withdraw method ------ seller
router.delete(
  "/delete-withdraw-method",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const seller = await Shop.findById(req.seller._id);

      if (!seller) {
        return next(new ErrorHandler("User does not exists", 400));
      }

      seller.withdrawMethod = null;

      await seller.save();

      res.status(200).json({
        success: true,
        message: "Withdraw method deleted successfully",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
