const dynamoDB = require("./config/aws");
const { ListTablesCommand } = require("@aws-sdk/client-dynamodb");

async function test() {
  try {
    const command = new ListTablesCommand({});
    const result = await dynamoDB.send(command);

    console.log("Connected Successfully ✅");
    console.log("Tables:", result.TableNames);
  } catch (error) {
    console.error("Connection Failed ❌");
    console.error(error);
  }
}

test();