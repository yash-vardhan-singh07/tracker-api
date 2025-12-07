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
  const origin = event.headers.origin;

  const commonHeaders = {
    // Allows your Vercel URL to access this function
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json"
  };

  // 1. MUST return headers for OPTIONS (Pre-flight request)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: ""
    };
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

    /** * IMPORTANT: This query identifies the "Master" aggregate documents.
     * Documents with deviceId are individual logs used for blocking repeats.
     * Documents without deviceId store the actual sum of unique clicks.
     */
    const counterQuery = { deviceId: { $exists: false }, count: { $exists: true } };

    // 1. Get unique count for a single specific offer
    if (page && tag) {
      const record = await Click.findOne({ ...counterQuery, page, tag });
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify(record || { page, tag, count: 0 }) 
      };
    }

    // 2. Summary for a landing page (shows all offer counts for that page)
    if (page) {
      const records = await Click.find({ ...counterQuery, page }).sort({ count: -1 });
      return { statusCode: 200, headers, body: JSON.stringify(records) };
    }

    // 3. Global summary (for the main Admin Dashboard table)
    const all = await Click.find(counterQuery).sort({ page: 1, count: -1 });
    return { statusCode: 200, headers, body: JSON.stringify(all) };

  } catch (err) {
    console.error("Stats aggregation error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to load aggregated data" })
    };
  }
}