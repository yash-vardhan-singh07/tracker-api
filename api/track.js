import mongoose from "mongoose";
import Click from "./models/clicks.js";
import Cors from "cors";

// 🟩 Setup CORS for frontend domain
const cors = Cors({
  origin: ["https://www.rewardclaiming.com"], 
  methods: ["GET", "POST", "OPTIONS"]
});

// 🟩 Run CORS Middleware
function runCors(req, res) {
  return new Promise((resolve, reject) => {
    cors(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// 🟩 MongoDB Connect (Optimize for Vercel)
let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    if (!process.env.MONGODB_URI) {
      throw new Error("Missing MONGODB_URI environment variable.");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
  }
}

// 🚀 MAIN POST HANDLER
export default async function handler(req, res) {
  // 🟩 Required Headers for All Requests
  res.setHeader("Access-Control-Allow-Origin", "https://www.rewardclaiming.com");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  await runCors(req, res);

  // 🟩 Allow Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    await connectDB();

    const { page, tag, country, deviceId } = req.body;

    if (!page || !tag || !country || !deviceId) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const allowedCountries = [
      "United States", "Canada", "United Kingdom", "Australia", "India"
    ];
    if (!allowedCountries.includes(country)) {
      return res.json({ success: false, message: "Country not allowed" });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const existing = await Click.findOne({ page, tag, deviceId });
    if (existing) {
      return res.json({ success: false, message: "Already clicked once" });
    }

    const result = await Click.findOneAndUpdate(
      { page, tag },
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    await Click.create({ page, tag, deviceId, ip });

    return res.json({ success: true, count: result.count });

  } catch (error) {
    console.error("Track API Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
