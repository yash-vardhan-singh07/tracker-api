import mongoose from "mongoose";
import Click from "./models/clicks.js";
import Cors from "cors";

// 🟩 Allowed Production Origin
const allowedOrigin = "https://rewardclaiming.com";

const cors = Cors({
  origin: allowedOrigin,
  methods: ["GET", "POST", "OPTIONS"]
});

function runCors(req, res) {
  return new Promise((resolve, reject) => {
    cors(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// 🟩 MongoDB connection for Vercel
let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    if (!process.env.MONGODB_URI) {
      throw new Error("Missing MONGODB_URI");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
  }
}

export default async function handler(req, res) {
  // 🟩 CORS headers (most important for browser)
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  await runCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

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
    console.error("Track error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
