import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  handleAssignApprovalRequest,
  handleCreateApprovalRequest,
  handleGetApprovalRequestById,
  handleGetPendingApprovalsCount,
  handleListApprovalMetaKinds,
  handleListApprovalMetaStatuses,
  handleListApprovalRequests,
  handleTransitionApprovalRequest,
} from "../controllers/approvalController.js";

const router = Router();

router.use(authenticate);

router.get("/meta/kinds", handleListApprovalMetaKinds);
router.get("/meta/statuses", handleListApprovalMetaStatuses);
router.get("/meta/pending-count", handleGetPendingApprovalsCount);
router.post("/", handleCreateApprovalRequest);
router.get("/", handleListApprovalRequests);
router.get("/:id", handleGetApprovalRequestById);
router.patch("/:id/status", handleTransitionApprovalRequest);
router.patch("/:id/assign", handleAssignApprovalRequest);

export default router;
