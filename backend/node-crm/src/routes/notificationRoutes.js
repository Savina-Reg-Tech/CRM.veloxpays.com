import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import {
  handleListNotifications,
  handleUnreadCount,
  handleMarkRead,
  handleMarkAllRead,
} from "../controllers/notificationController.js";

const router = Router();

router.use(authenticate);

router.get("/", handleListNotifications);
router.get("/unread-count", handleUnreadCount);
router.patch("/:id/read", handleMarkRead);
router.patch("/read-all", handleMarkAllRead);

export default router;
