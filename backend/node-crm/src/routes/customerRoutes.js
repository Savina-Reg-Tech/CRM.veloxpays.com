import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
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

router.get("/meta/sources", handleListCustomerSources);
router.get("/meta/statuses", handleListCustomerStatuses);
router.post("/", handleCreateCustomer);
router.get("/", handleListCustomers);
router.get("/:id", handleGetCustomerById);
router.patch("/:id", handleUpdateCustomer);
router.delete("/:id", handleDeleteCustomer);

export default router;
