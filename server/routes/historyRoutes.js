import { Router } from "express";
import { saveSimulation, listSimulations, deleteSimulation } from "../controllers/historyController.js";

const router = Router();
router.get("/", listSimulations);
router.post("/", saveSimulation);
router.delete("/:id", deleteSimulation);
export default router;