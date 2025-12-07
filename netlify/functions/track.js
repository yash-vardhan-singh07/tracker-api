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

  try {
    await connectDB();
    const body = JSON.parse(event.body);
    const { page, tag, country, deviceId } = body;

    // 1. PRE-CHECK: Look for this device log
    const existingLog = await Click.findOne({ page, tag, deviceId });
    
    if (existingLog) {
      const master = await Click.findOne({ page, tag, deviceId: { $exists: false } });
      return { 
        statusCode: 200, 
        headers: commonHeaders, 
        body: JSON.stringify({ 
          success: false, 
          message: "Repeat click blocked", 
          count: master ? master.count : 0 
        }) 
      };
    }

    // 2. LOG THE DEVICE FIRST (The "Lock")
    // If you have a unique index on page+tag+deviceId, this prevents duplicates
    const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"];
    await Click.create({ page, tag, deviceId, ip, country });

    // 3. INCREMENT MASTER COUNTER
    // Only happens if step 2 succeeded
    const result = await Click.findOneAndUpdate(
      { page, tag, deviceId: { $exists: false } }, 
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ success: true, count: result.count })
    };

  } catch (err) {
    // If two requests finish step 1 at the same time, step 2 will throw E11000
    if (err.code === 11000) {
       const master = await Click.findOne({ page, tag, deviceId: { $exists: false } });
       return {
         statusCode: 200,
         headers: commonHeaders,
         body: JSON.stringify({ success: false, message: "Duplicate record locked", count: master?.count })
       };
    }

    console.error("Track error:", err);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ error: "Server error", details: err.message })
    };
  }
}