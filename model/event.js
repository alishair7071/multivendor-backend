const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter your event product name!"],
  },

  description: {
    type: String,
    required: [true, "Please enter your event product description!"],
  },

  category: {
    type: String,
    required: [true, "Please enter your event product category"],
  },

  start_date: {
    type: Date,
    required: true,
  },

  finish_date: {
    type: Date,
    required: true,
  },

  status: {
    type: String,
    default: "Running",
  },

  tags: {
    type: String,
    required: [true, "Please enter your event product tags!"],
  },

  originalPrice: {
    type: String,
  },

  discountPrice: {
    type: String,
    required: [true, "Please enter your event product discount price!"],
  },

  stock: {
    type: String,
    required: [true, "Please enter your event product stock!"],
  },
  images: [
    {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
  ],

  shopId: {
    type: String,
    required: true,
  },

  shop: {
    type: Object,
    required: true,
  },

  sold_out: {
    type: Number,
    default: 0,
  },

  createdAt: {
    type: Date,
    default: Date.now(),
  },
});

module.exports = mongoose.model("Event", eventSchema);
