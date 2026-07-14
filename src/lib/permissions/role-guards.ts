import { ValidationError } from "@/lib/errors/app-error";
import { SYSTEM_ROLES } from "./roles";

export function assertRoleAssignable(roleName: string): void {
  if (roleName === SYSTEM_ROLES.OWNER) {
    throw new ValidationError(
      "The Owner role cannot be assigned through user management",
    );
  }
}

/** System roles keep a fixed name; permissions/description may be edited. */
export function assertSystemRoleRenameAllowed(
  isSystem: boolean,
  currentName: string,
  nextName?: string,
): void {
  if (isSystem && nextName != null && nextName !== currentName) {
    throw new ValidationError("Cannot rename system roles");
  }
}
