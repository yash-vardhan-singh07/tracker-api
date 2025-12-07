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
  const commonHeaders = {
    "Access-Control-Allow-Origin": event.headers.origin || "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: commonHeaders, body: "" };

  try {
    await connectDB();
    const { page, tag, country, deviceId } = JSON.parse(event.body);

    // 1. Strict Check: Does this specific device log exist?
    const existingLog = await Click.findOne({ page, tag, deviceId });
    if (existingLog) {
      const currentMaster = await Click.findOne({ page, tag, deviceId: { $exists: false } });
      return { 
        statusCode: 200, 
        headers: commonHeaders, 
        body: JSON.stringify({ success: false, message: "Repeat user blocked", count: currentMaster?.count || 0 }) 
      };
    }

    // 2. Create the Device Log (The "Gatekeeper")
    const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"];
    await Click.create({ page, tag, deviceId, ip, country });

    // 3. Increment Master Counter ONLY after individual log creation is confirmed
    const masterUpdate = await Click.findOneAndUpdate(
      { page, tag, deviceId: { $exists: false } }, 
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ success: true, count: masterUpdate.count })
    };

  } catch (err) {
    // If Mongo prevents a duplicate log via index, fetch the count and return
    if (err.code === 11000) {
      const currentMaster = await Click.findOne({ page, tag, deviceId: { $exists: false } });
      return { 
        statusCode: 200, 
        headers: commonHeaders, 
        body: JSON.stringify({ success: false, message: "Blocked unique index conflict", count: currentMaster?.count }) 
      };
    }

    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ error: err.message }) };
  }
}