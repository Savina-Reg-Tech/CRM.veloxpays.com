import { Router } from "express";
import { authenticate, authorizeRoles } from "../middleware/auth.js";
import {
  handleCreateForm,
  handleListForms,
  handleGetForm,
  handleUpdateForm,
  handleDeleteForm,
  handleGetEmbedCodes,
  handleListFormSubmissions,
  handleExportSubmissions,
  handleGetFormAnalytics,
  handleGetGlobalStats,
} from "../controllers/formController.js";
import {
  handleListLeads,
  handleGetLead,
  handleUpdateLeadStatus,
  handleGetLeadStats,
} from "../controllers/leadController.js";
import {
  handleListDomains,
  handleAddDomain,
  handleDeleteDomain,
} from "../controllers/emailDomainController.js";

const router = Router();

// All form builder routes require authentication + admin role
router.use(authenticate);
router.use(authorizeRoles("super_admin", "admin"));

// ── Global stats ──────────────────────────────────────────────────
router.get("/stats", handleGetGlobalStats);

// ── Forms CRUD ────────────────────────────────────────────────────
router.post("/", handleCreateForm);
router.get("/", handleListForms);
router.get("/:id", handleGetForm);
router.patch("/:id", handleUpdateForm);
router.delete("/:id", handleDeleteForm);
router.get("/:id/embed", handleGetEmbedCodes);
router.get("/:id/submissions", handleListFormSubmissions);
router.get("/:id/submissions/export", handleExportSubmissions);
router.get("/:id/analytics", handleGetFormAnalytics);

// ── Leads ─────────────────────────────────────────────────────────
router.get("/leads/all", handleListLeads);
router.get("/leads/stats", handleGetLeadStats);
router.get("/leads/:id", handleGetLead);
router.patch("/leads/:id/status", handleUpdateLeadStatus);

// ── Blocked email domains ─────────────────────────────────────────
router.get("/email-domains/list", handleListDomains);
router.post("/email-domains", handleAddDomain);
router.delete("/email-domains/:id", handleDeleteDomain);

export default router;
