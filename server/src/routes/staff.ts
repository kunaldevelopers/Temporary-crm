import { Router, Request, Response, NextFunction } from "express";
import {
  getById,
  getAll,
  create,
  update,
  remove,
  getAssignedClients,
  assignClient,
  removeAssignment,
  getByUserId,
  markClientDelivered,
  markClientUndelivered,
  selectShift,
  getSessionByDate,
  markClientDailyDelivered,
  markClientDailyUndelivered,
  updateAssignedClients,
} from "../controllers/staff";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Helper to wrap async handlers
const asyncHandler =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Apply auth middleware properly using the correct express syntax
router.use(authMiddleware as any);

// Staff lookup routes - these should be first to avoid param conflicts
router.get("/user/:userId", asyncHandler(getByUserId));

// Base routes
router.get("/", asyncHandler(getAll));
router.post("/", asyncHandler(create));

// Staff member specific routes
router.get("/:id", asyncHandler(getById));
router.get("/:id/assigned-clients", asyncHandler(getAssignedClients));
router.put("/:id", asyncHandler(update));
router.delete("/:id", asyncHandler(remove));

// Client assignment routes
router.post("/assign", asyncHandler(assignClient));
router.post("/unassign", asyncHandler(removeAssignment));

// Shift selection routes
router.post("/:id/select-shift", asyncHandler(selectShift));
// Fix: Split into two routes instead of using optional parameter
router.get("/:id/session", asyncHandler(getSessionByDate)); // For today's session
router.get("/:id/session/:date", asyncHandler(getSessionByDate)); // For specific date

// New endpoint for updating assigned clients based on shift
router.post(
  "/:id/update-assigned-clients",
  asyncHandler(updateAssignedClients)
);

// Daily delivery status routes with shift functionality
router.post(
  "/:id/client/:clientId/daily-delivered",
  asyncHandler(markClientDailyDelivered)
);
router.post(
  "/:id/client/:clientId/daily-undelivered",
  asyncHandler(markClientDailyUndelivered)
);

// Legacy delivery status routes (keeping for backward compatibility)
router.post("/client/:id/delivered", asyncHandler(markClientDelivered));
router.post("/client/:id/undelivered", asyncHandler(markClientUndelivered));

export const staffRouter = router;
