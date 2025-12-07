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

  // Handle pre-flight request
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  // Restrict to GET method
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
    const { page, tag } = params || {};

    /** * IMPORTANT: The Query Filter
     * masterQuery looks for the aggregate document that stores the sum.
     * It specifically looks for docs where deviceId IS NOT present.
     */
    const masterQuery = { deviceId: { $exists: false }, count: { $exists: true } };

    // 1. Fetch statistics for a specific offer
    if (page && tag) {
      const record = await Click.findOne({ ...masterQuery, page, tag });
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify(record || { page, tag, count: 0 }) 
      };
    }

    // 2. Fetch all counts for a specific landing page
    if (page) {
      const records = await Click.find({ ...masterQuery, page }).sort({ count: -1 });
      return { statusCode: 200, headers, body: JSON.stringify(records) };
    }

    // 3. Global Stats: Get all aggregated counts for the admin table
    const all = await Click.find(masterQuery).sort({ page: 1, count: -1 });
    
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify(all) 
    };

  } catch (err) {
    console.error("Stats fetching error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Database query failed", details: err.message })
    };
  }
}