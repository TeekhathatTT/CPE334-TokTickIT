import { useAuth } from "./useAuth";
import type { CurrentUser } from "../api";

/**
 * Thin accessor for the authenticated identity (id, name, email, role,
 * mustChangePassword). Requester screens source the "current requester"
 * from here — never from selector state or local storage (BR-03).
 */
export function useCurrentUser(): CurrentUser | null {
  return useAuth().user;
}
