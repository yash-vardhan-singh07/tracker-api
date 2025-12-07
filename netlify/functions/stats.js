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
  const requestOrigin = event.headers.origin;

  const headers = {
    "Access-Control-Allow-Origin": requestOrigin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed. Use GET." })
    };
  }

  try {
    await connectDB();

    const params = event.queryStringParameters;
    const page = params?.page;
    const tag = params?.tag;

    // Filter to exclude individual click logs (docs with deviceId) 
    // and only include the counter documents.
    const counterQuery = { deviceId: { $exists: false }, count: { $exists: true } };

    // 1. Specific stat for a single offer tag on a specific page
    if (page && tag) {
      const record = await Click.findOne({ ...counterQuery, page, tag });
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify(record || { page, tag, count: 0 }) 
      };
    }

    // 2. Summary for a specific landing page
    if (page) {
      const records = await Click.find({ ...counterQuery, page }).sort({ count: -1 });
      return { statusCode: 200, headers, body: JSON.stringify(records) };
    }

    // 3. Global summary for all pages
    const all = await Click.find(counterQuery).sort({ page: 1, count: -1 });
    return { statusCode: 200, headers, body: JSON.stringify(all) };

  } catch (err) {
    console.error("Stats fetching error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to load stats" })
    };
  }
}