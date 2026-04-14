const s3 = require("../config/s3");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");

const dynamoDB = require("../config/aws");
const {
  ScanCommand,
  PutCommand,
  DeleteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

// =======================
// GET ALL ARTWORKS
// =======================
exports.getAllArtworks = async (req, res) => {
  console.log("🔥 Fetching artworks...");

  try {
    const result = await dynamoDB.send(
      new ScanCommand({
        TableName: "Artworks", // check this
      })
    );

    console.log("✅ RESULT:", result);

    res.json(result.Items || []);
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};
// =======================
// CREATE ARTWORK
// =======================
exports.createArtwork = async (req, res) => {
 console.log("BODY:", req.body); 
 
 try {
    const { title, description, price, category } = req.body;

    let imageUrl = "";

    if (req.file) {
      const fileContent = fs.readFileSync(req.file.path);

      const uploadParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `artworks/${Date.now()}-${req.file.originalname}`,
        Body: fileContent,
        ContentType: req.file.mimetype,
      };

      await s3.send(new PutObjectCommand(uploadParams));

      imageUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadParams.Key}`;

      fs.unlinkSync(req.file.path);
    }

    const newArtwork = {
      id: Date.now().toString(),
      title,
      description,
      price: Number(price),
      category,
      image: imageUrl,
      artistId: req.user.id,
    };

    await dynamoDB.send(
      new PutCommand({
        TableName: "Artworks",
        Item: newArtwork,
      })
    );

    res.status(201).json({
      message: "Artwork created successfully",
    });

  } catch (error) {
    console.error("Create Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// =======================
// DELETE ARTWORK
// =======================
exports.deleteArtwork = async (req, res) => {
  try {
    const { id } = req.params;

    await dynamoDB.send(
      new DeleteCommand({
        TableName: "Artworks",
        Key: { id },
      })
    );

    res.json({ message: "Artwork deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// =======================
// UPDATE ARTWORK
// =======================
exports.updateArtwork = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, category } = req.body;

    await dynamoDB.send(
      new UpdateCommand({
        TableName: "Artworks",
        Key: { id },
        UpdateExpression:
          "set title = :t, description = :d, price = :p, category = :c",
        ExpressionAttributeValues: {
          ":t": title,
          ":d": description,
          ":p": Number(price),
          ":c": category,
        },
      })
    );

    res.json({ message: "Artwork updated successfully" });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

