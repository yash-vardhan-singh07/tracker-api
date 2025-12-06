import mongoose from "mongoose";
import Click from "./models/clicks.js";

let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
  }
}

export async function handler(event, context) {
  const origin = "https://rewardclaiming.com";

  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "GET only" })
    };
  }

  try {
    await connectDB();

    const params = event.queryStringParameters;
    const page = params?.page;
    const tag = params?.tag;

    if (page && tag) {
      const record = await Click.findOne({ page, tag, count: { $exists: true } });
      return { statusCode: 200, headers, body: JSON.stringify(record || { page, tag, count: 0 }) };
    }

    if (page) {
      const records = await Click.find({ page, count: { $exists: true } }).sort({ count: -1 });
      return { statusCode: 200, headers, body: JSON.stringify(records) };
    }

    const all = await Click.find({ count: { $exists: true } }).sort({ page: 1, count: -1 });
    return { statusCode: 200, headers, body: JSON.stringify(all) };

  } catch (err) {
    console.error("Stats error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
}
