// Single password implementation for the codebase: scrypt exactly as frozen
// in specification.md BR-08 / api-spec.md §7. Re-exported here so no caller
// reaches for bcrypt/argon2 (no native dependency for this local lab).
export {
  hashPassword,
  meetsPasswordPolicy,
  passwordPolicyMessage,
  verifyPassword,
} from "../modules/auth/auth.service.js";
