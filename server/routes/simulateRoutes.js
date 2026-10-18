import { Router } from "express";
import { simulate } from "../controllers/simulateController.js";

const router = Router();
router.post("/", simulate);
export default router;