const express = require("express");

const app = express();

const customerRoutes = require("./routes/customerRoutes");
const planRoutes = require("./routes/planRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const usageRoutes = require("./routes/usageRoutes");
const billingRoutes = require("./routes/billingRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

app.use(express.json());


//Homepage
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Welcome to TokenMeter API"
  });
  });


  //Customer routes
  app.use("/api/customers", customerRoutes);

//Plan routes
app.use("/api/plans", planRoutes);

//Subscription routes
app.use("/api/subscriptions", subscriptionRoutes);

//Usage routes
app.use("/api/usage", usageRoutes);

//Billing routes
app.use("/api/billing", billingRoutes);

//Payment routes
app.use("/api/payments", paymentRoutes);

module.exports = app;