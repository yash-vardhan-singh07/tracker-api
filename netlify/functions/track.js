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

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: commonHeaders, body: "" };

  try {
    await connectDB();
    const { page, tag, country, deviceId } = JSON.parse(event.body);

    // 1. Check if device has logged a click before
    const existingLog = await Click.findOne({ page, tag, deviceId });
    if (existingLog) {
      const master = await Click.findOne({ page, tag, deviceId: { $exists: false } });
      return { 
        statusCode: 200, 
        headers: commonHeaders, 
        body: JSON.stringify({ success: false, message: "Blocked", count: master?.count || 0 }) 
      };
    }

    // 2. INCREMENT Master Record (No deviceId here)
    const masterUpdate = await Click.findOneAndUpdate(
      { page, tag, deviceId: { $exists: false } }, 
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    // 3. CREATE Device Log (Proof of unique click)
    await Click.create({ 
      page, tag, deviceId, country, 
      ip: event.headers["x-forwarded-for"] || event.headers["client-ip"] 
    });

    return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ success: true, count: masterUpdate.count }) };
  } catch (err) {
    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ error: err.message }) };
  }
}