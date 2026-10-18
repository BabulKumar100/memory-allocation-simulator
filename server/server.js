import "dotenv/config";
import express from "express";
import cors from "cors";
import simulateRoutes from "./routes/simulateRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import { connectDB } from "./config/db.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "Memory Allocator API" }));
app.use("/api/simulate", simulateRoutes);
app.use("/api/simulations", historyRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Internal server error" });
});

connectDB();
const server = app.listen(PORT, () => console.log(`Memory Allocator API running on http://localhost:${PORT}`));
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the process using it or set a different PORT in server/.env.`);
    process.exit(1);
  }
  throw error;
});