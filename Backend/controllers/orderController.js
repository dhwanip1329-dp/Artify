const dynamoDB = require("../config/aws");
const { PutCommand, ScanCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

// ==========================
// CREATE ORDER
// ==========================
exports.createOrder = async (req, res) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (rawItems.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    let totalAmount = 0;
    const normalizedItems = [];

    for (const item of rawItems) {
      const artworkId = String(item?.id || item?.artworkId || item?._id || "").trim();
      if (!artworkId) continue;

      const quantity = Math.max(1, Number(item?.quantity || 1));
      let unitPrice = null;

      // Prefer trusted price from DB.
      const result = await dynamoDB.send(
        new GetCommand({
          TableName: "Artworks",
          Key: { id: artworkId }
        })
      );

      if (result?.Item) {
        const dbPrice = Number(result.Item.price);
        if (Number.isFinite(dbPrice) && dbPrice >= 0) {
          unitPrice = dbPrice;
        }
      }

      // Fallback to request payload price when DB record has no valid price.
      if (unitPrice === null) {
        const bodyPrice = Number(item?.price);
        if (Number.isFinite(bodyPrice) && bodyPrice >= 0) {
          unitPrice = bodyPrice;
        }
      }

      if (unitPrice === null) continue;

      totalAmount += unitPrice * quantity;
      normalizedItems.push({ id: artworkId, quantity, price: unitPrice });
    }

    totalAmount = Number(totalAmount.toFixed(2));
    if (!Number.isFinite(totalAmount)) totalAmount = 0;

    const newOrder = {
      id: `order_${Date.now()}`,
      userId: req.user.id,
      items: normalizedItems,
      totalAmount,
      status: "Placed",
      createdAt: new Date().toISOString(),
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: "Orders",
        Item: newOrder,
      })
    );

    res.status(201).json({
      message: "Order placed successfully",
      totalAmount,
    });
  } catch (error) {
    console.error("Order Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ==========================
// GET USER ORDERS
// ==========================
exports.getMyOrders = async (req, res) => {
  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: "Orders"
      })
    );

    const userOrders = (result.Items || []).filter(
      (order) => order.userId === req.user.id
    );

    res.json(userOrders);
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
