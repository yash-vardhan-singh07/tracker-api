import mongoose from "mongoose";

const clickSchema = new mongoose.Schema({
  page: { type: String, required: true },
  tag: { type: String, required: true },
  country: String,
  deviceId: String, // Individual logs will have this; master record will NOT.
  ip: String,
  count: { type: Number, default: 0 },
  lastClickAt: { type: Date, default: Date.now }
});

// Important: Prevents model recompilation during hot-reloads on Serverless environments
export default mongoose.models.Click || mongoose.model("Click", clickSchema);