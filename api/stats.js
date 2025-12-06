import mongoose from "mongoose";
import Click from "./models/clicks.js";
import Cors from "cors";

const allowedOrigin = "https://rewardclaiming.com";

const cors = Cors({
  origin: allowedOrigin,
  methods: ["GET", "OPTIONS"]
});

function runCors(req, res) {
  return new Promise((resolve, reject) => {
    cors(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      resolve(result);
    });
  });
}

let isConnected = false;
async function connectDB() {
  if (!isConnected) {
    if (!process.env.MONGODB_URI) throw new Error("Missing MONGODB_URI");
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
  }
}

export default async function handler(req, res) {
  console.log("Incoming request", req.method, "Origin:", req.headers.origin);
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  await runCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  try {
    await connectDB();
    const { page, tag } = req.query;

    if (page && tag) {
      const record = await Click.findOne({ page, tag, count: { $exists: true } });
      return res.json(record || { page, tag, count: 0 });
    }

    if (page) {
      const records = await Click.find({ page, count: { $exists: true } }).sort({ count: -1 });
      return res.json(records);
    }

    const all = await Click.find({ count: { $exists: true } }).sort({ page: 1, count: -1 });
    return res.json(all);

  } catch (error) {
    console.error("Stats error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
