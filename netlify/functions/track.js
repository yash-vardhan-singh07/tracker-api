import mongoose from "mongoose";
import Click from "./models/clicks.js";

let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
  }
}

// 1. Define allowed countries (using ISO codes)
const ALLOWED_COUNTRIES = ["US", "CA", "GB", "AU"];

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

    // 2. Geo-Restriction Check
    // Convert to uppercase to ensure the check is case-insensitive
    if (!country || !ALLOWED_COUNTRIES.includes(country.toUpperCase())) {
      // Find the current master record to return the count anyway (optional)
      const master = await Click.findOne({ page, tag, deviceId: { $exists: false } });
      
      return {
        statusCode: 200, // Return 200 to prevent console errors, but success: false
        headers: commonHeaders,
        body: JSON.stringify({ 
          success: false, 
          message: "Registration restricted to USA, Canada, UK, and Australia",
          count: master ? master.count : 0
        })
      };
    }

    // 3. Prevent Repeat Counting
    const existingLog = await Click.findOne({ page, tag, deviceId });
    if (existingLog) {
      const master = await Click.findOne({ page, tag, deviceId: { $exists: false } });
      return { 
        statusCode: 200, 
        headers: commonHeaders, 
        body: JSON.stringify({ 
          success: false, 
          message: "Already clicked once", 
          count: master ? master.count : 0 
        }) 
      };
    }

    const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"];
    await Click.create({ page, tag, deviceId, ip, country });

    const updatedMaster = await Click.findOneAndUpdate(
      { page, tag, deviceId: { $exists: false } }, 
      { 
        $inc: { count: 1 }, 
        $set: { lastClickAt: new Date(), country } 
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ success: true, count: updatedMaster.count })
    };

  } catch (err) {
    console.error("Track error:", err);
    
    if (err.code === 11000) {
       const master = await Click.findOne({ page, tag, deviceId: { $exists: false } });
       return {
         statusCode: 200,
         headers: commonHeaders,
         body: JSON.stringify({ success: false, message: "Blocked unique index conflict", count: master?.count })
       };
    }

    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ error: "Server update failed", details: err.message })
    };
  }
}