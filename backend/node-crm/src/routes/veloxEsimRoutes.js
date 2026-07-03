import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import { VELOX_ESIM_VIEW_ROLES } from "../integrations/veloxEsim/config.js";
import {
  handleGetVeloxEsimCustomerById,
  handleListVeloxEsimCustomers,
  handleVeloxEsimHealth,
} from "../controllers/veloxEsimController.js";

const router = Router();

router.use(authenticate);
router.use(authorizeRoles(...VELOX_ESIM_VIEW_ROLES));

router.get("/health", handleVeloxEsimHealth);
router.get("/customers", handleListVeloxEsimCustomers);
router.get("/customers/:id", handleGetVeloxEsimCustomerById);

export default router;
