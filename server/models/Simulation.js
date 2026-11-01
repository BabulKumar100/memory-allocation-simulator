import mongoose from "mongoose";

const simulationSchema = new mongoose.Schema({
  mode: { type: String, enum: ["contiguous", "paging", "segmentation"], default: "contiguous" },
  algorithm: { type: String, enum: ["firstFit", "bestFit", "worstFit", "nextFit"], required: true },
  // Contiguous mode
  blocks: [{ id: String, size: Number }],
  // Paging mode
  physicalMemory: Number,
  pageSize: Number,
  // Segmentation mode
  processes: [{ id: String, size: Number, segments: [{ name: String, size: Number }] }],
  allocations: [{ type: mongoose.Schema.Types.Mixed }],
  summary: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

export default mongoose.models.Simulation || mongoose.model("Simulation", simulationSchema);
