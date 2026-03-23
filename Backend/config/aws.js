const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

// Use IAM role credentials automatically
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

const dynamoDB = DynamoDBDocumentClient.from(client);

module.exports = dynamoDB;