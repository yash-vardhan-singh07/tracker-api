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
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: commonHeaders, body: "" };
  }

  try {
    await connectDB();
    const body = JSON.parse(event.body);
    const { page, tag, country, deviceId } = body;

    // 1. Check for existing click by this specific device to prevent double-counting
    const existing = await Click.findOne({ page, tag, deviceId });
    if (existing) {
      return { 
        statusCode: 200, 
        headers: commonHeaders, 
        body: JSON.stringify({ success: false, message: "Already clicked once" }) 
      };
    }

    // 2. Increment the Total Counter
    // Note: This relies on a document that holds the aggregate count.
    // We filter by deviceId: { $exists: false } to only update the "master" count record.
    const result = await Click.findOneAndUpdate(
      { page, tag, deviceId: { $exists: false } }, 
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    // 3. Log the individual click
    // We add deviceId here, making this document distinct from the aggregate one.
    const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"];
    await Click.create({ page, tag, deviceId, ip, country });

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ success: true, count: result.count })
    };

  } catch (err) {
    console.error("Track error:", err);
    
    // Specifically handle the Duplicate Key Error so the user doesn't see a 500 error
    if (err.code === 11000) {
      return {
        statusCode: 200,
        headers: commonHeaders,
        body: JSON.stringify({ success: false, message: "Duplicate record ignored" })
      };
    }

    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ error: "Internal server error", details: err.message })
    };
  }
}