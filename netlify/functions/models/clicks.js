import mongoose from "mongoose";

const clickSchema = new mongoose.Schema({
  page: String,
  tag: String,
  country: String,
  deviceId: String,
  ip: String,
  count: { type: Number, default: 0 },
  lastClickAt: Date
});

// Prevent model recompilation on Vercel Serverless
export default mongoose.models.Click || mongoose.model("Click", clickSchema);
