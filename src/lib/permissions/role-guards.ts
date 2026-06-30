import { ConflictError, ValidationError } from "@/lib/errors/app-error";
import { SYSTEM_ROLES } from "./roles";

export function assertRoleAssignable(roleName: string): void {
  if (roleName === SYSTEM_ROLES.OWNER) {
    throw new ValidationError(
      "The Owner role cannot be assigned through user management",
    );
  }
}

export function assertSystemRolePermissionsEditable(
  isSystem: boolean,
  permissionIds?: string[],
): void {
  if (isSystem && permissionIds !== undefined) {
    throw new ConflictError("Cannot modify permissions of system roles");
  }
}
