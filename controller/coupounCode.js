const express = require("express");
const Shop = require("../model/shop");
const catchAsyncError = require("../middleware/catchAsyncError");
const ErrorHandler = require("../utils/ErrorHandler");
const Product = require("../model/product");
const router = express.Router();
const CoupounCode = require("../model/coupounCode");
const { isSeller } = require("../middleware/auth");

//create coupounCode

router.post(
  "/create-coupon-code",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {
      const isCoupounCodeExists = await CoupounCode.find({
        name: req.body.name,
      });

      if (isCoupounCodeExists.length != 0) {
        return next(new ErrorHandler("Coupoun Code already exists", 400));
      }

      const newCouponCode = await CoupounCode.create(req.body);

      res.status(201).json({
        success: true,
        newCouponCode,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 400));
    }
  })
);

//get all coupons
router.get(
  "/get-coupon/:id",
  isSeller,
  catchAsyncError(async (req, res, next) => {
    try {

      const couponCodes = await CoupounCode.find({ "shop._id": req.params.id });

      res.status(201).json({
        success: true,
        couponCodes,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

//get coupon value
router.get(
  "/get-coupon-value/:name",
  catchAsyncError(async (req, res, next) => {
    try {
      const couponCode = await CoupounCode.findOne({ name: req.params.name });

      if (!couponCode) {
        return res.status(401).json({
          success: false,
          message: "Coupon Code not found",
        });
      }

      res.status(200).json({
        success: true,
        couponCode,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  })
);

module.exports = router;
