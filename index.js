const express = require("express");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const ErrorHandler = require("./middleware/error.js");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
dotenv.config(); // load .env

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "https://frontend-multivendor.netlify.app",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);

app.use("/", express.static("uploads"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/test", (req, res) => {
  res.send("hello world");
});

const connectDb = async () => {
  try {
    await mongoose.connect(process.env.NEW_URL);
    console.log("connected with mongodb successfully");
  } catch (e) {
    console.log("cannot connect to mongodb due to: ");
    console.log(e);
  }
};
connectDb().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
  });
});


// Routes
const user = require("./controller/user.js");
const shop = require("./controller/shop.js");
const product = require("./controller/product.js");
const event = require("./controller/event.js");
const coupon = require("./controller/coupounCode.js");
const payment = require("./controller/payment.js");
const order = require("./controller/order.js");
const conversation = require("./controller/conversation.js");
const message = require("./controller/message.js");
const withdraw = require("./controller/withdraw.js");

app.use("/api/v2/user", user);
app.use("/api/v2/shop", shop);
app.use("/api/v2/product", product);
app.use("/api/v2/event", event);
app.use("/api/v2/coupon", coupon);
app.use("/api/v2/payment", payment);
app.use("/api/v2/order", order);
app.use("/api/v2/conversation", conversation);
app.use("/api/v2/message", message);
app.use("/api/v2/withdraw", withdraw);

// Error handling
app.use(ErrorHandler);

// Start Server

module.exports = app;
