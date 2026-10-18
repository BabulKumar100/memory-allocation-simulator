import Simulation from "../models/Simulation.js";

export async function saveSimulation(req, res) {
  if (Simulation.db.readyState !== 1) return res.status(503).json({ message: "MongoDB is not connected. Configure MONGODB_URI in server/.env." });
  try {
    const saved = await Simulation.create(req.body);
    res.status(201).json(saved);
  } catch (error) { res.status(400).json({ message: error.message }); }
}
export async function listSimulations(_req, res) {
  if (Simulation.db.readyState !== 1) return res.status(503).json({ message: "MongoDB is not connected." });
  const rows = await Simulation.find().sort({ createdAt: -1 }).limit(50).lean();
  res.json(rows);
}
export async function deleteSimulation(req, res) {
  if (Simulation.db.readyState !== 1) return res.status(503).json({ message: "MongoDB is not connected." });
  const deleted = await Simulation.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Simulation not found." });
  res.json({ message: "Simulation deleted." });
}