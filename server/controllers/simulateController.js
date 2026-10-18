import { simulateAllocation, validatePayload } from "../shared/allocation.js";

export function simulate(req, res) {
  const errors = validatePayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors[0], errors });
  try {
    return res.json(simulateAllocation(req.body));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
}