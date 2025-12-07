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

  // Handle pre-flight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: commonHeaders, body: "" };
  }

  try {
    await connectDB();
    const body = JSON.parse(event.body);
    const { page, tag, country, deviceId } = body;

    // 1. Check for existing click by this device to prevent repeat counting
    const existingLog = await Click.findOne({ page, tag, deviceId });
    
    if (existingLog) {
      // Find current master record to return existing count
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

    // 2. Log individual device click proof
    const ip = event.headers["x-forwarded-for"] || event.headers["client-ip"];
    await Click.create({ page, tag, deviceId, ip, country });

    // 3. Increment the Master Aggregate Record
    // Since you deleted the unique index, this will succeed even with the logs present
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
    
    // Handle E11000 race condition (two fast clicks from same device)
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