require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

/* ===============================
   CORS CONFIG (IMPORTANT FOR S3)
================================= */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.options("/{*any}", cors());

/* ===============================
   MIDDLEWARE
================================= */
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ===============================
   ROUTES
================================= */
const authRoutes = require("./routes/authRoutes");
const artworkRoutes = require("./routes/artworkRoutes");
const orderRoutes = require("./routes/orderRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/artworks", artworkRoutes);
app.use("/api/orders", orderRoutes);

/* ===============================
   ROOT CHECK ROUTE
================================= */
app.get("/", (req, res) => {
  res.send("ARTIFY Backend Running");
});

/* ===============================
   START SERVER
================================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});