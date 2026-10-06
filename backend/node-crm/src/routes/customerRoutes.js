import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  handleCreateCustomer,
  handleDeleteCustomer,
  handleGetCustomerById,
  handleListCustomerSources,
  handleListCustomerStatuses,
  handleListCustomers,
  handleUpdateCustomer,
} from "../controllers/customerController.js";

const router = Router();

router.use(authenticate);
// Support staff only use the VeloxVerse audit log — no access to CRM customer records.
router.use(authorizeRoles("super_admin", "admin", "employee", "agent", "affiliate"));

router.get("/meta/sources", handleListCustomerSources);
router.get("/meta/statuses", handleListCustomerStatuses);
router.post("/", handleCreateCustomer);
router.get("/", handleListCustomers);
router.get("/:id", handleGetCustomerById);
router.patch("/:id", handleUpdateCustomer);
router.delete("/:id", handleDeleteCustomer);

export default router;
