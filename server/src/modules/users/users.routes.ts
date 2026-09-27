// Administrator user-management routes (api-spec.md §5).
//
// Mounted in app.ts behind `authorize(["ADMINISTRATOR"])` — every route here
// is Administrator-only (403 for other roles, 401 without a session via the
// global `authenticate` chain). The reset path is `initial-password` only per
// api-spec §5; no `reset-password` alias exists (api-spec §5: "No ...
// advanced recovery endpoint exists").

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

export default usersRouter;
