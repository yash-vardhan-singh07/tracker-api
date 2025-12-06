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
  const origin = "https://rewardclaiming.com";

  // Required CORS headers
  const commonHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: commonHeaders,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: commonHeaders,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    await connectDB();
    const body = JSON.parse(event.body);
    const { page, tag, country, deviceId } = body;

    if (!page || !tag || !country || !deviceId) {
      return { statusCode: 400, headers: commonHeaders, body: "Missing fields" };
    }

    const allowedCountries = [
      "United States", "Canada", "United Kingdom", "Australia", "India"
    ];

    if (!allowedCountries.includes(country)) {
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ success: false, message: "Country not allowed" }) };
    }

    const ip = event.headers["x-forwarded-for"];

    const existing = await Click.findOne({ page, tag, deviceId });
    if (existing) {
      return { statusCode: 200, headers: commonHeaders, body: JSON.stringify({ success: false, message: "Already clicked once" }) };
    }

    const result = await Click.findOneAndUpdate(
      { page, tag },
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    await Click.create({ page, tag, deviceId, ip });

    return {
      statusCode: 200,
      headers: commonHeaders,
      body: JSON.stringify({ success: true, count: result.count })
    };

  } catch (err) {
    console.error("Track error:", err);
    return {
      statusCode: 500,
      headers: commonHeaders,
      body: JSON.stringify({ error: err.message })
    };
  }
}
