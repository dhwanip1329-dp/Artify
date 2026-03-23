const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dynamoDB = require("../config/aws");
const { ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");

/* ======================================================
   REGISTER USER
====================================================== */

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({
        message: "Name, email and password are required",
      });
    }

    /* -------- CHECK IF USER EXISTS -------- */

    const scanParams = {
      TableName: "Users",
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": normalizedEmail,
      },
    };

    const existingUser = await dynamoDB.send(
      new ScanCommand(scanParams)
    );

    if (existingUser.Items && existingUser.Items.length > 0) {
      return res.status(400).json({
        message: "Email already registered",
      });
    }

    /* -------- HASH PASSWORD -------- */

    const hashedPassword = await bcrypt.hash(password, 10);

    /* -------- CREATE USER -------- */

    const newUser = {
      id: Date.now().toString(),
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: role || "customer",
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: "Users",
        Item: newUser,
      })
    );

    res.status(201).json({
      message: "User registered successfully",
    });

  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};


/* ======================================================
   LOGIN USER
====================================================== */

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    /* -------- FIND USER -------- */

    const scanParams = {
      TableName: "Users",
      FilterExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": normalizedEmail,
      },
    };

    const result = await dynamoDB.send(
      new ScanCommand(scanParams)
    );

    if (!result.Items || result.Items.length === 0) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const user = result.Items[0];

    /* -------- CHECK PASSWORD -------- */

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    /* -------- CREATE TOKEN -------- */

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      role: user.role,
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};