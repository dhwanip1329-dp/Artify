const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const { verifyToken } = require("../middleware/authMiddleware");

// Create order
router.post("/", verifyToken, orderController.createOrder);

// Get my orders
router.get("/my", verifyToken, orderController.getMyOrders);

exports.getMyOrders = async (req, res) => {
  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: "Orders",
      })
    );

    const userOrders = result.Items.filter(
      (order) => order.userId === req.user.id
    );

    res.json(userOrders);

  } catch (error) {
    console.error("Fetch Orders Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = router;