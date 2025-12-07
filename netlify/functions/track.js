import mongoose from "mongoose";
import Click from "./models/clicks.js";

let isConnected = false;

async function connectDB() {
  if (!isConnected) {
    // Ensure MONGODB_URI is set in Netlify Environment Variables
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log("MongoDB connected");
  }
}

export async function handler(event, context) {
  // Pull the origin from request headers to support dynamic Vercel preview URLs
  const requestOrigin = event.headers.origin;

  // Required CORS headers
  const commonHeaders = {
    "Access-Control-Allow-Origin": requestOrigin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: ""
    };
  }

  // Restrict to POST methods
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: commonHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    await connectDB();

    if (!event.body) {
      return { 
        statusCode: 400, 
        headers: commonHeaders, 
        body: JSON.stringify({ error: "No body provided" }) 
      };
    }

    const body = JSON.parse(event.body);
    const { page, tag, country, deviceId } = body;

    // Field validation
    if (!page || !tag || !country || !deviceId) {
      return { 
        statusCode: 400, 
        headers: commonHeaders, 
        body: JSON.stringify({ error: "Missing required fields" }) 
      };
    }

    // Geofencing/Allowed Countries logic
    const allowedCountries = [
      "United States", "Canada", "United Kingdom", "Australia", "India"
    ];

    if (!allowedCountries.includes(country)) {
      return { 
        statusCode: 200, 
        headers: commonHeaders, 
        body: JSON.stringify({ success: false, message: "Country not allowed" }) 
      };
    }

    const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"];

    // Check for duplicate click by device
    const existing = await Click.findOne({ page, tag, deviceId });
    if (existing) {
      return { 
        statusCode: 200, 
        headers: commonHeaders, 
        body: JSON.stringify({ success: false, message: "Already clicked once" }) 
      };
    }

    // Upsert the click aggregate count
    const result = await Click.findOneAndUpdate(
      { page, tag },
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    // Create the individual click record
    await Click.create({ page, tag, deviceId, ip });

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ success: true, count: result.count })
    };

// track.js inside the catch block
} catch (err) {
  console.error("Track error:", err); // This prints to the Netlify Function Logs
  return {
    statusCode: 500,
    headers: commonHeaders,
    body: JSON.stringify({ 
      error: "Internal server error", 
      details: err.message, // Add this line to see the error in the browser console
      stack: err.stack 
    })
  };
}
}