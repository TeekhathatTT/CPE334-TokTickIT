// Authentication routes (api-spec.md §1).
//
// POST /api/auth/login            — public (establishes the session)
// POST /api/auth/logout           — valid session (BR-07 invalidation)
// GET  /api/auth/me               — valid session (safe identity, never a hash)
// POST /api/auth/change-password  — valid session, including must-change ones

import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import {
  changePassword,
  getCurrentUser,
  login,
  logout,
} from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/login", login);
authRouter.post("/logout", authenticate, logout);
authRouter.get("/me", authenticate, getCurrentUser);
authRouter.post("/change-password", authenticate, changePassword);

export default authRouter;
