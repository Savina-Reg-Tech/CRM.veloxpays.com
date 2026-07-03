import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { handleListServices } from "../controllers/serviceController.js";

const router = Router();

router.use(authenticate);

router.get("/", handleListServices);

export default router;
