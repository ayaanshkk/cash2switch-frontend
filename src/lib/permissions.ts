/**
 * Shared permission utilities for consistent access control across the application
 */

export interface User {
  id: number;
  role: string;
  [key: string]: any;
}

export interface AssignableEntity {
  assigned_to_id?: number | null;
  opportunity_owner_employee_id?: number | null;
}

/**
 * Check if a user can edit/reassign an entity
 * - Admins can edit any entity
 * - Staff can only edit entities assigned to them
 */
export const canEditEntity = (user: User | null, entity: AssignableEntity): boolean => {
  if (!user) return false;
  if (user.role === "Admin") return true;
  if (user.role === "Staff") {
    // Check both possible assignment field names
    const assignedToId = entity.assigned_to_id ?? entity.opportunity_owner_employee_id;
    return assignedToId === user.id;
  }
  return false;
};

/**
 * Check if a user can perform bulk assignment operations
 * Only Admins can bulk assign
 */
export const canBulkAssign = (user: User | null): boolean => {
  return user?.role === "Admin";
};

/**
 * Check if a user can delete entities
 * Configurable - currently allows all authenticated users
 * Change to user?.role === "Admin" for production
 */
export const canDeleteEntity = (user: User | null): boolean => {
  return !!user; // Temporarily allow all users
};
