import mongoose from "mongoose";
import Click from "./models/clicks.js";

let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    // Uses the connection string from Netlify Environment Variables
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
  }
}

export async function handler(event, context) {
  // Pull dynamic origin to support Vercel preview and production domains
  const requestOrigin = event.headers.origin;

  const headers = {
    "Access-Control-Allow-Origin": requestOrigin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Restrict to GET method for statistics
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

    // 1. Get specific stats for a single tag on a page
    if (page && tag) {
      const record = await Click.findOne({ page, tag, count: { $exists: true } });
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify(record || { page, tag, count: 0 }) 
      };
    }

    // 2. Get all tags for a specific page sorted by highest count
    if (page) {
      const records = await Click.find({ page, count: { $exists: true } }).sort({ count: -1 });
      return { statusCode: 200, headers, body: JSON.stringify(records) };
    }

    // 3. Global summary: Get all tracked counts sorted by page
    const all = await Click.find({ count: { $exists: true } }).sort({ page: 1, count: -1 });
    return { statusCode: 200, headers, body: JSON.stringify(all) };

  } catch (err) {
    console.error("Stats aggregation error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to fetch stats" })
    };
  }
}