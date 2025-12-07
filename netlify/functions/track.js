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

    // 1. ATTEMPT TO CREATE THE UNIQUE LOG FIRST
    // The unique index blocks any deviceId that already exists for this page/tag.
    const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"];
    
    // This line is the "Gatekeeper". If it fails, nothing below runs.
    await Click.create({ page, tag, deviceId, ip, country });

    // 2. INCREMENT COUNTER (Only if Step 1 succeeded)
    const updatedMaster = await Click.findOneAndUpdate(
      { page, tag, deviceId: { $exists: false } }, 
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ success: true, count: updatedMaster.count })
    };

  } catch (err) {
    // 3. CATCH THE REPEAT USER
    if (err.code === 11000) {
       // Silently fetch existing count and tell the user they are already counted
       const master = await Click.findOne({ page, tag, deviceId: { $exists: false } });
       return {
         statusCode: 200,
         headers: commonHeaders,
         body: JSON.stringify({ 
            success: false, 
            message: "User already logged. No changes made.", 
            count: master ? master.count : 0 
         })
       };
    }

    return { statusCode: 500, headers: commonHeaders, body: JSON.stringify({ error: err.message }) };
  }
}