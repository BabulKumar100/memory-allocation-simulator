import mongoose from "mongoose";

const simulationSchema = new mongoose.Schema({
  algorithm: { type: String, enum: ["firstFit", "bestFit", "worstFit", "nextFit"], required: true },
  blocks: [{ id: String, size: Number }],
  processes: [{ id: String, size: Number }],
  allocations: [{ processId: String, processSize: Number, blockId: String, remainingInBlock: Number, allocated: Boolean, largestFreeBlock: Number }],
  summary: {
    allocatedProcesses: Number,
    processedProcesses: Number,
    successRate: Number,
    freeMemory: Number,
    utilization: Number,
    failedProcesses: [{ processId: String, processSize: Number }]
  }
}, { timestamps: true });

export default mongoose.models.Simulation || mongoose.model("Simulation", simulationSchema);