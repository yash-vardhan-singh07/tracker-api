import mongoose from "mongoose";
import Click from "./models/clicks.js";
import Cors from "cors";

// 🟩 Setup CORS for frontend domain
const cors = Cors({
  origin: [
    "https://time-b8qhaeyaw-yash-vardhan-singhs-projects-be014fdb.vercel.app", // Vercel Preview 1
    "https://time-git-main-yash-vardhan-singhs-projects-be014fdb.vercel.app", // Vercel Preview 2
    
    // 👇 ADD THE ACTUAL PRODUCTION FRONTEND DOMAIN
    "https://www.rewardclaiming.com" 
    
  ],
  methods: ["GET", "POST"]
});

// 🟩 Run CORS middleware
function runCors(req, res) {
  return new Promise((resolve, reject) => {
    // Set headers to explicitly allow GET and OPTIONS
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
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
    if (!process.env.MONGODB_URI) {
      throw new Error("Missing MONGODB_URI environment variable.");
    }
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
  }
}

// 🚀 GET /api/stats
export default async function handler(req, res) {
  await runCors(req, res);
  
  // ✅ FIX: Handle CORS Preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    // Respond with 200 OK immediately for the preflight check
    return res.status(200).end(); 
  }

  // Ensure only GET requests are processed after OPTIONS
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Only GET is supported." });
  }
  
  try {
    await connectDB();

    const { page, tag } = req.query;

    // 1. Get stats for a specific page and tag (single record)
    if (page && tag) {
        // Find one record where page and tag match (likely the aggregate count record)
        const record = await Click.findOne({ page, tag, count: { $exists: true } });
        // Return the record or a default 0 count object
        return res.status(200).json(record || { page, tag, count: 0 });
    }

    // 2. Get stats for all tags on a specific page (multiple records)
    if (page) {
        // Find all aggregate records for the page, sorting by count descending
        const records = await Click.find({ page, count: { $exists: true } }).sort({ count: -1 });
        return res.status(200).json(records);
    }

    // 3. Get all aggregate stats (all records)
    // Find all records that contain a 'count' field, ensuring you only fetch aggregate records
    const all = await Click.find({ count: { $exists: true } }).sort({ page: 1, count: -1 });
    return res.status(200).json(all);
    
  } catch (error) {
    console.error("API Handler Error:", error);
    // ⚠️ Catch-all error handler for DB issues or unexpected errors
    return res.status(500).json({ error: "Internal Server Error", detail: error.message });
  }
}