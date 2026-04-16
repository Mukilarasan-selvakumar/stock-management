const express = require("express");
const router = express.Router();
const { getPredictionResults, getTopCustomers } = require("../controllers/analyticsController");

router.get("/results", getPredictionResults);
router.get("/top-customers", getTopCustomers);

module.exports = router;
