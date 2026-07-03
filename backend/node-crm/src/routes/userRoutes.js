import { Router } from "express";
import {
  handleCreateUser,
  handleCreateEmployee,
  handleGetUsers,
  handleGetUserStats,
  handleToggleStatus,
} from "../controllers/userController.js";
import { authenticate, authorizeRoles } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.post("/",                     authorizeRoles("super_admin", "admin", "employee"), handleCreateUser);
router.get("/",                      authorizeRoles("super_admin", "admin"), handleGetUsers);
router.get("/stats",                 authorizeRoles("super_admin", "admin"), handleGetUserStats);
router.post("/employees",            authorizeRoles("super_admin", "admin"), handleCreateEmployee);
router.get("/employees",             authorizeRoles("super_admin", "admin"), handleGetUsers);
router.patch("/:id/toggle-status",   authorizeRoles("super_admin"), handleToggleStatus);

export default router;
