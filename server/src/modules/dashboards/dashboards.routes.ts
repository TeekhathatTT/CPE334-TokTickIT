import { Router } from "express";
import { authorize } from "../../middleware/authorize.middleware.js";
import { getRequesterDashboardHandler, getStaffDashboardHandler } from "./dashboards.controller.js";

const router = Router();

router.get("/requester", authorize(["REQUESTER"]), getRequesterDashboardHandler);
router.get("/staff", authorize(["IT_STAFF", "ADMINISTRATOR"]), getStaffDashboardHandler);

export { router as dashboardsRouter };
