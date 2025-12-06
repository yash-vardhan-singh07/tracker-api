import mongoose from "mongoose";
import Click from "./models/clicks.js";
import Cors from "cors";

// 🟩 Setup CORS for frontend domain
const cors = Cors({
  origin: [
    "https://time-b8qhaeyaw-yash-vardhan-singhs-projects-be014fdb.vercel.app",
    "https://time-git-main-yash-vardhan-singhs-projects-be014fdb.vercel.app"
  ],
  methods: ["GET", "POST"] // Added GET here for completeness, though POST is the focus
});

// 🟩 Run CORS middleware
function runCors(req, res) {
  return new Promise((resolve, reject) => {
    // Setting the response header here ensures the browser knows which methods are allowed
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    cors(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// 🟩 Connect DB once (Vercel optimization)
let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    // Ensure MONGODB_URI is available before connecting
    if (!process.env.MONGODB_URI) {
      throw new Error("Missing MONGODB_URI environment variable.");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
  }
}

// 🟩 MAIN API HANDLER
export default async function handler(req, res) {
  await runCors(req, res); // 🔥 MUST COME FIRST

  // ✅ FIX: Handle CORS Preflight request (OPTIONS) 
  // This is the primary fix for the 405 error when using POST with CORS.
  if (req.method === "OPTIONS") {
    // Respond with 200 OK immediately for the preflight check
    return res.status(200).end(); 
  }
  
  try {
    await connectDB();

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { page, tag, country, deviceId } = req.body;

    if (!page || !tag || !country || !deviceId) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const allowedCountries = [
      "United States",
      "Canada",
      "United Kingdom",
      "Australia",
      "India" 
    ];

    if (!allowedCountries.includes(country)) {
      // Keep status 200 as per your original logic, but 403 Forbidden might be more appropriate
      return res.json({ success: false, message: "Country not allowed" });
    }

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Use findOne to check existence (as before)
    const existing = await Click.findOne({ page, tag, deviceId });
    if (existing) {
      return res.json({
        success: false,
        message: "Already clicked once"
      });
    }

    // Aggregate the click count (upsert)
    const result = await Click.findOneAndUpdate(
      { page, tag },
      { $inc: { count: 1 }, $set: { lastClickAt: new Date(), country } },
      { new: true, upsert: true }
    );

    // Log the individual click event
    await Click.create({ page, tag, deviceId, ip });

    return res.json({ success: true, count: result.count });
    
  } catch (error) {
    console.error("API Handler Error:", error);
    // ⚠️ Add a catch-all error handler for unexpected issues (e.g., DB connection problems)
    return res.status(500).json({ error: "Internal Server Error", detail: error.message });
  }
}