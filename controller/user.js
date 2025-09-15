const express = require("express");
const path = require("path");
const router = express.Router();
const User = require("../model/user.js");
const { upload } = require("../multer.js");
const ErrorHandler = require("../utils/ErrorHandler.js");
const fs = require("fs");
const sendMail = require("../utils/sendMail.js");
const jwt = require("jsonwebtoken");
const catchAsyncError = require("../middleware/catchAsyncError.js");
const sendToken = require("../utils/jwtToken.js");
const { isAuthenticated, isAdmin } = require("../middleware/auth.js");
const cloudinary = require("../cloudinary.js");

//create activation token
const createActivationToken = (user) => {
  return jwt.sign(user, process.env.ACTIVATION_SECRET, {
    expiresIn: "15m",
  });
};

router.post("/create-user", upload.single("file"), async (req, res, next) => {
  try {
    console.log(req.body.name);
    const { name, email, password, file } = req.body;
    const userEmail = await User.findOne({ email });

    if (userEmail) {
      return next(new ErrorHandler("User already exists", 400));
    }

    const result = await cloudinary.v2.uploader.upload_stream(
      { folder: "avatars" },
      async (error, result) => {
        if (error) return next(new ErrorHandler(error.message, 500));

        const user = {
          name: name,
          email: email,
          password: password,
          avatar: {
            public_id: result.public_id,
            url: result.secure_url,
          },
        };

        const activationToken = createActivationToken(user);
        const activationUrl = `https://frontend-multivendor.netlify.app/activation/${activationToken}`;

        try {
          await sendMail({
            mail: user.email,
            subject: "Activate your account",
            message: `Hello ${user.name}, please click on the link to activate your account: ${activationUrl}`,
          });

          res.status(201).json({
            message: `Please check your email:- ${user.email} to confirm your account`,
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

//activate user
router.post(
  "/activation",
  catchAsyncError(async (req, res, next) => {
    try {
      const { activation_token } = req.body;

      const newUser = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET
      );

      if (!newUser) {
        console.log("user not verified");
        return next(new ErrorHandler("Inavlid Token", 400));
      }

      const { name, email, password, avatar } = newUser;
      const userEmail = await User.findOne({ email });

      if (userEmail) {
        console.log("account already created");
        return next(new ErrorHandler("User Already Exists", 400));
      }

      let createdUser = await User.create({
        name,
        email,
        password,
        avatar,
      });

      sendToken(createdUser, 201, res);
    } catch (e) {
      console.log("catch error: " + e.message);
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//login
router.post(
  "/login-user",
  catchAsyncError(async (req, res, next) => {
    try {
      console.log("login called");
      const { email, password } = req.body;
      if (!email || !password) {
        return next(new ErrorHandler("Please provide all the fields", 400));
      }

      console.log("working with mongodb");
      const user = await User.findOne({ email }).select("+password");
      console.log("working with mongodb is completed");

      if (!user) {
        return next(new ErrorHandler("User does not exists", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(new ErrorHandler("Invalid Credentials!"));
      }
      console.log(user);

      sendToken(user, 201, res);
    } catch (e) {}
  })
);

//loadUser
router.get(
  "/getuser",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return next(new ErrorHandler("User doesn't exists", 400));
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (e) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//log-out
router.get(
  "/logout",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    try {
      /*
      res.cookie("token", "", {
        expires: new Date(0),
        httpOnly: true,
        sameSite: "None",
        secure: true,
        path: "/"
      });
*/
      res.clearCookie("token", {
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

//update user info
router.put(
  "/update-user-info",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    try {
      const { name, email, password, phoneNumber } = req.body;

      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("User does not exists", 400));
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return next(new ErrorHandler("Invalid Password", 400));
      }

      if (name) user.name = name;
      if (email) user.email = email;
      if (phoneNumber) user.phoneNumber = phoneNumber;

      await user.save();

      res.status(201).json({
        success: true,
        user,
      });
    } catch (e) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//update user avatar
router.put(
  "/update-avatar",
  isAuthenticated,
  upload.single("image"),
  catchAsyncError(async (req, res, next) => {
    try {
      const existsUser = await User.findById(req.user.id);

      if (!existsUser) {
        return next(new ErrorHandler("User does not exists", 400));
      }

      const existAvatarPath = `uploads/${existsUser.avatar}`;

      if (fs.existsSync(existAvatarPath)) {
        fs.unlinkSync(existAvatarPath); // ✅ deletes synchronously and safely
      }

      const fileUrl = req.file.filename;
      const user = await User.findByIdAndUpdate(
        req.user.id,
        { avatar: fileUrl },
        { new: true }
      );

      res.status(200).json({
        success: true,
        user,
      });
    } catch (e) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//update user addresses
router.put(
  "/update-user-addresses",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      console.log(req.body);

      const sameTypeAddress = user.addresses.find(
        (address) => address.addressType === req.body.addressType
      );

      if (sameTypeAddress) {
        return next(
          new ErrorHandler(
            `${req.body.addressType} Address already exists`,
            400
          )
        );
      }

      const existsAddress = user.addresses.find(
        (address) => address._id === req.body._id
      );

      if (existsAddress) {
        Object.assign(existsAddress, req.body);
      } else {
        //add new address
        user.addresses.push(req.body);
      }

      await user.save();

      res.status(200).json({
        success: true,
        user,
      });
    } catch (e) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//delete user address
router.delete(
  "/delete-user-address/:id",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return next(new ErrorHandler("User does not exists", 400));
      }
      const addressId = req.params.id;
      await User.updateOne(
        { _id: req.user.id },
        { $pull: { addresses: { _id: addressId } } }
      );
      const updatedUser = await User.findById(req.user.id);
      res.status(200).json({
        success: true,
        updatedUser,
      });
    } catch (e) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//change password
router.put(
  "/update-password",
  isAuthenticated,
  catchAsyncError(async (req, res, next) => {
    try {
      const { oldPassword, newPassword, confirmPassword } = req.body;
      const user = await User.findById(req.user.id).select("+password");
      if (!user) {
        return next(new ErrorHandler("User does not exist", 400));
      }

      const isOldPasswordValid = await user.comparePassword(oldPassword);
      if (!isOldPasswordValid) {
        return next(new ErrorHandler("Invalid old password", 400));
      }

      if (newPassword !== confirmPassword) {
        return next(
          new ErrorHandler("new and confirm password must be same", 400)
        );
      }

      user.password = newPassword;

      await user.save();

      res.status(200).json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (e) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

//get user information with user id
router.get(
  "/user-info/:id",
  catchAsyncError(async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);

      res.status(201).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler(e.message, 500));
    }
  })
);

// all users --- for admin
router.get(
  "/admin-all-users",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncError(async (req, res, next) => {
    try {
      const users = await User.find().sort({
        createdAt: -1,
      });
      res.status(201).json({
        success: true,
        users,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//delete user ------ admin
router.delete(
  "/delete-user/:id",
  isAuthenticated,
  isAdmin("Admin"),
  catchAsyncError(async (req, res, next) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return next(new ErrorHandler("User does not exist", 400));
      }

      await User.findByIdAndDelete(req.params.id);

      res.status(200).json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
