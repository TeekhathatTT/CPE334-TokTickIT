// Administrator user-management routes (api-spec.md §5).
//
// Mounted in app.ts behind `authorize(["ADMINISTRATOR"])` — every route here
// is Administrator-only (403 for other roles, 401 without a session via the
// global `authenticate` chain). Canonical reset path is `initial-password`
// per api-spec §5; `reset-password` is a compatibility alias for the
// feature prompt's naming with identical behavior.

import { Router } from "express";
import {
  createUser,
  listUsers,
  setInitialPassword,
  updateUser,
} from "./users.controller.js";

export const usersRouter = Router();

usersRouter.get("/", listUsers);
usersRouter.post("/", createUser);
usersRouter.patch("/:id", updateUser);
usersRouter.post("/:id/initial-password", setInitialPassword);
// Prompt-compat alias (see controller header for the spec-gap note).
usersRouter.post("/:id/reset-password", setInitialPassword);

export default usersRouter;
