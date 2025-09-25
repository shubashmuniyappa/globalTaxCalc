/**
 * Role-Based Access Control (RBAC) System
 * Manages roles, permissions, and access control for enterprise users
 */

class RBACSystem {
    constructor() {
        this.permissions = new Map();
        this.roles = new Map();
        this.userRoles = new Map();
        this.initializeDefaultPermissions();
        this.initializeDefaultRoles();
    }

    /**
     * Permission Management
     */
    initializeDefaultPermissions() {
        const defaultPermissions = [
            // User Management
            { id: 'users:read', name: 'View Users', category: 'users', description: 'View user information' },
            { id: 'users:create', name: 'Create Users', category: 'users', description: 'Create new users' },
            { id: 'users:update', name: 'Update Users', category: 'users', description: 'Update user information' },
            { id: 'users:delete', name: 'Delete Users', category: 'users', description: 'Delete users' },
            { id: 'users:invite', name: 'Invite Users', category: 'users', description: 'Send user invitations' },
            { id: 'users:impersonate', name: 'Impersonate Users', category: 'users', description: 'Login as another user' },

            // Client Management
            { id: 'clients:read', name: 'View Clients', category: 'clients', description: 'View client information' },
            { id: 'clients:create', name: 'Create Clients', category: 'clients', description: 'Create new clients' },
            { id: 'clients:update', name: 'Update Clients', category: 'clients', description: 'Update client information' },
            { id: 'clients:delete', name: 'Delete Clients', category: 'clients', description: 'Delete clients' },
            { id: 'clients:assign', name: 'Assign Clients', category: 'clients', description: 'Assign clients to users' },

            // Tax Calculations
            { id: 'calculations:read', name: 'View Calculations', category: 'calculations', description: 'View tax calculations' },
            { id: 'calculations:create', name: 'Create Calculations', category: 'calculations', description: 'Create new calculations' },
            { id: 'calculations:update', name: 'Update Calculations', category: 'calculations', description: 'Update calculations' },
            { id: 'calculations:delete', name: 'Delete Calculations', category: 'calculations', description: 'Delete calculations' },
            { id: 'calculations:share', name: 'Share Calculations', category: 'calculations', description: 'Share calculations with others' },
            { id: 'calculations:export', name: 'Export Calculations', category: 'calculations', description: 'Export calculation data' },

            // Reports
            { id: 'reports:read', name: 'View Reports', category: 'reports', description: 'View reports' },
            { id: 'reports:create', name: 'Create Reports', category: 'reports', description: 'Create custom reports' },
            { id: 'reports:export', name: 'Export Reports', category: 'reports', description: 'Export report data' },
            { id: 'reports:schedule', name: 'Schedule Reports', category: 'reports', description: 'Schedule automated reports' },

            // Integrations
            { id: 'integrations:read', name: 'View Integrations', category: 'integrations', description: 'View integration settings' },
            { id: 'integrations:create', name: 'Create Integrations', category: 'integrations', description: 'Create new integrations' },
            { id: 'integrations:update', name: 'Update Integrations', category: 'integrations', description: 'Update integration settings' },
            { id: 'integrations:delete', name: 'Delete Integrations', category: 'integrations', description: 'Delete integrations' },

            // Billing
            { id: 'billing:read', name: 'View Billing', category: 'billing', description: 'View billing information' },
            { id: 'billing:update', name: 'Update Billing', category: 'billing', description: 'Update billing settings' },
            { id: 'billing:export', name: 'Export Billing', category: 'billing', description: 'Export billing data' },

            // Settings
            { id: 'settings:read', name: 'View Settings', category: 'settings', description: 'View tenant settings' },
            { id: 'settings:update', name: 'Update Settings', category: 'settings', description: 'Update tenant settings' },
            { id: 'settings:branding', name: 'Manage Branding', category: 'settings', description: 'Manage white-label branding' },
            { id: 'settings:sso', name: 'Manage SSO', category: 'settings', description: 'Manage SSO configuration' },

            // Audit
            { id: 'audit:read', name: 'View Audit Logs', category: 'audit', description: 'View audit logs and activity' },
            { id: 'audit:export', name: 'Export Audit Logs', category: 'audit', description: 'Export audit log data' },

            // API
            { id: 'api:read', name: 'API Read Access', category: 'api', description: 'Read-only API access' },
            { id: 'api:write', name: 'API Write Access', category: 'api', description: 'Read-write API access' },
            { id: 'api:admin', name: 'API Admin Access', category: 'api', description: 'Full API access including admin endpoints' },

            // System
            { id: 'system:admin', name: 'System Administration', category: 'system', description: 'Full system administration access' },
            { id: 'system:support', name: 'Support Access', category: 'system', description: 'Support and troubleshooting access' }
        ];

        defaultPermissions.forEach(permission => {
            this.permissions.set(permission.id, permission);
        });
    }

    initializeDefaultRoles() {
        const defaultRoles = [
            {
                id: 'super_admin',
                name: 'Super Administrator',
                description: 'Full system access with all permissions',
                level: 100,
                permissions: Array.from(this.permissions.keys()),
                isSystemRole: true,
                canAssign: ['admin', 'manager', 'user', 'client', 'api_user']
            },
            {
                id: 'admin',
                name: 'Administrator',
                description: 'Full tenant administration access',
                level: 90,
                permissions: [
                    'users:read', 'users:create', 'users:update', 'users:delete', 'users:invite',
                    'clients:read', 'clients:create', 'clients:update', 'clients:delete', 'clients:assign',
                    'calculations:read', 'calculations:create', 'calculations:update', 'calculations:delete', 'calculations:share', 'calculations:export',
                    'reports:read', 'reports:create', 'reports:export', 'reports:schedule',
                    'integrations:read', 'integrations:create', 'integrations:update', 'integrations:delete',
                    'billing:read', 'billing:update', 'billing:export',
                    'settings:read', 'settings:update', 'settings:branding', 'settings:sso',
                    'audit:read', 'audit:export',
                    'api:read', 'api:write'
                ],
                canAssign: ['manager', 'user', 'client', 'api_user']
            },
            {
                id: 'manager',
                name: 'Manager',
                description: 'Management access with user and client oversight',
                level: 70,
                permissions: [
                    'users:read', 'users:invite',
                    'clients:read', 'clients:create', 'clients:update', 'clients:assign',
                    'calculations:read', 'calculations:create', 'calculations:update', 'calculations:delete', 'calculations:share', 'calculations:export',
                    'reports:read', 'reports:create', 'reports:export', 'reports:schedule',
                    'integrations:read',
                    'billing:read',
                    'settings:read',
                    'audit:read',
                    'api:read', 'api:write'
                ],
                canAssign: ['user', 'client']
            },
            {
                id: 'user',
                name: 'User',
                description: 'Standard user access for tax calculations and client management',
                level: 50,
                permissions: [
                    'clients:read', 'clients:create', 'clients:update',
                    'calculations:read', 'calculations:create', 'calculations:update', 'calculations:share', 'calculations:export',
                    'reports:read', 'reports:export',
                    'api:read'
                ],
                canAssign: ['client']
            },
            {
                id: 'client',
                name: 'Client',
                description: 'Limited access for client portal users',
                level: 20,
                permissions: [
                    'calculations:read',
                    'reports:read'
                ],
                canAssign: []
            },
            {
                id: 'api_user',
                name: 'API User',
                description: 'API-only access for integrations',
                level: 30,
                permissions: [
                    'api:read', 'api:write',
                    'calculations:read', 'calculations:create',
                    'clients:read'
                ],
                canAssign: []
            },
            {
                id: 'readonly',
                name: 'Read Only',
                description: 'Read-only access to view data',
                level: 10,
                permissions: [
                    'users:read',
                    'clients:read',
                    'calculations:read',
                    'reports:read',
                    'api:read'
                ],
                canAssign: []
            }
        ];

        defaultRoles.forEach(role => {
            this.roles.set(role.id, role);
        });
    }

    /**
     * Role Management
     */
    async createRole(tenantId, roleData) {
        try {
            const role = {
                id: roleData.id || this.generateRoleId(),
                tenantId: tenantId,
                name: roleData.name,
                description: roleData.description,
                level: roleData.level || 50,
                permissions: roleData.permissions || [],
                isCustomRole: true,
                canAssign: roleData.canAssign || [],
                conditions: roleData.conditions || {},
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Validate permissions
            await this.validatePermissions(role.permissions);

            // Validate role hierarchy
            await this.validateRoleHierarchy(tenantId, role);

            // Save role
            await this.saveRole(tenantId, role);

            console.log(`Role created: ${role.name} for tenant ${tenantId}`);
            return role;

        } catch (error) {
            console.error('Error creating role:', error);
            throw error;
        }
    }

    async updateRole(tenantId, roleId, updates) {
        try {
            const role = await this.getRole(tenantId, roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            if (role.isSystemRole) {
                throw new Error('Cannot modify system roles');
            }

            const updatedRole = {
                ...role,
                ...updates,
                updatedAt: new Date()
            };

            // Validate permissions if being updated
            if (updates.permissions) {
                await this.validatePermissions(updates.permissions);
            }

            // Validate role hierarchy if level is being updated
            if (updates.level) {
                await this.validateRoleHierarchy(tenantId, updatedRole);
            }

            await this.saveRole(tenantId, updatedRole);

            console.log(`Role updated: ${role.name} for tenant ${tenantId}`);
            return updatedRole;

        } catch (error) {
            console.error('Error updating role:', error);
            throw error;
        }
    }

    async deleteRole(tenantId, roleId) {
        try {
            const role = await this.getRole(tenantId, roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            if (role.isSystemRole) {
                throw new Error('Cannot delete system roles');
            }

            // Check if role is in use
            const usersWithRole = await this.getUsersWithRole(tenantId, roleId);
            if (usersWithRole.length > 0) {
                throw new Error(`Cannot delete role: ${usersWithRole.length} users are assigned this role`);
            }

            await this.removeRole(tenantId, roleId);

            console.log(`Role deleted: ${role.name} for tenant ${tenantId}`);
            return true;

        } catch (error) {
            console.error('Error deleting role:', error);
            throw error;
        }
    }

    /**
     * User Role Assignment
     */
    async assignUserRole(tenantId, userId, roleId, assignedBy) {
        try {
            // Validate role exists
            const role = await this.getRole(tenantId, roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            // Validate assigner has permission
            const assignerRoles = await this.getUserRoles(tenantId, assignedBy);
            const canAssign = await this.canAssignRole(assignerRoles, roleId);
            if (!canAssign) {
                throw new Error('Insufficient permissions to assign this role');
            }

            // Get current user roles
            const currentRoles = await this.getUserRoles(tenantId, userId);

            // Check for role conflicts
            await this.validateRoleAssignment(currentRoles, role);

            // Assign role
            const assignment = {
                userId: userId,
                roleId: roleId,
                assignedBy: assignedBy,
                assignedAt: new Date(),
                tenantId: tenantId
            };

            await this.saveUserRoleAssignment(assignment);

            // Log the assignment
            await this.logRoleAssignment(tenantId, userId, roleId, assignedBy, 'assigned');

            console.log(`Role ${roleId} assigned to user ${userId} by ${assignedBy}`);
            return assignment;

        } catch (error) {
            console.error('Error assigning user role:', error);
            throw error;
        }
    }

    async removeUserRole(tenantId, userId, roleId, removedBy) {
        try {
            // Validate role exists
            const role = await this.getRole(tenantId, roleId);
            if (!role) {
                throw new Error('Role not found');
            }

            // Validate remover has permission
            const removerRoles = await this.getUserRoles(tenantId, removedBy);
            const canRemove = await this.canAssignRole(removerRoles, roleId);
            if (!canRemove) {
                throw new Error('Insufficient permissions to remove this role');
            }

            // Remove role assignment
            await this.removeUserRoleAssignment(tenantId, userId, roleId);

            // Log the removal
            await this.logRoleAssignment(tenantId, userId, roleId, removedBy, 'removed');

            console.log(`Role ${roleId} removed from user ${userId} by ${removedBy}`);
            return true;

        } catch (error) {
            console.error('Error removing user role:', error);
            throw error;
        }
    }

    /**
     * Permission Checking
     */
    async hasPermission(tenantId, userId, permission, resource = null) {
        try {
            // Get user roles
            const userRoles = await this.getUserRoles(tenantId, userId);
            if (!userRoles || userRoles.length === 0) {
                return false;
            }

            // Check each role for permission
            for (const roleId of userRoles) {
                const role = await this.getRole(tenantId, roleId);
                if (!role) continue;

                // Check if role has permission
                if (role.permissions.includes(permission)) {
                    // Check conditions if any
                    if (role.conditions && Object.keys(role.conditions).length > 0) {
                        const conditionsMet = await this.checkRoleConditions(
                            tenantId, userId, role.conditions, resource
                        );
                        if (conditionsMet) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }

            return false;

        } catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }

    async hasAnyPermission(tenantId, userId, permissions) {
        for (const permission of permissions) {
            if (await this.hasPermission(tenantId, userId, permission)) {
                return true;
            }
        }
        return false;
    }

    async hasAllPermissions(tenantId, userId, permissions) {
        for (const permission of permissions) {
            if (!(await this.hasPermission(tenantId, userId, permission))) {
                return false;
            }
        }
        return true;
    }

    async getUserPermissions(tenantId, userId) {
        try {
            const userRoles = await this.getUserRoles(tenantId, userId);
            const permissions = new Set();

            for (const roleId of userRoles) {
                const role = await this.getRole(tenantId, roleId);
                if (role) {
                    role.permissions.forEach(permission => permissions.add(permission));
                }
            }

            return Array.from(permissions);

        } catch (error) {
            console.error('Error getting user permissions:', error);
            return [];
        }
    }

    /**
     * Role Conditions and Dynamic Permissions
     */
    async checkRoleConditions(tenantId, userId, conditions, resource) {
        try {
            // Time-based conditions
            if (conditions.timeRestrictions) {
                const now = new Date();
                const currentHour = now.getHours();
                const currentDay = now.getDay();

                if (conditions.timeRestrictions.allowedHours) {
                    const [startHour, endHour] = conditions.timeRestrictions.allowedHours;
                    if (currentHour < startHour || currentHour > endHour) {
                        return false;
                    }
                }

                if (conditions.timeRestrictions.allowedDays) {
                    if (!conditions.timeRestrictions.allowedDays.includes(currentDay)) {
                        return false;
                    }
                }
            }

            // IP-based conditions
            if (conditions.ipRestrictions && resource?.ip) {
                if (!this.isIpAllowed(resource.ip, conditions.ipRestrictions)) {
                    return false;
                }
            }

            // Resource ownership conditions
            if (conditions.ownershipRequired && resource?.ownerId) {
                if (resource.ownerId !== userId) {
                    return false;
                }
            }

            // Client assignment conditions
            if (conditions.clientAssignmentRequired && resource?.clientId) {
                const isAssigned = await this.isUserAssignedToClient(tenantId, userId, resource.clientId);
                if (!isAssigned) {
                    return false;
                }
            }

            return true;

        } catch (error) {
            console.error('Error checking role conditions:', error);
            return false;
        }
    }

    isIpAllowed(ip, ipRestrictions) {
        if (ipRestrictions.allowedIps && ipRestrictions.allowedIps.length > 0) {
            return ipRestrictions.allowedIps.some(allowedIp => {
                return this.ipMatches(ip, allowedIp);
            });
        }

        if (ipRestrictions.blockedIps && ipRestrictions.blockedIps.length > 0) {
            return !ipRestrictions.blockedIps.some(blockedIp => {
                return this.ipMatches(ip, blockedIp);
            });
        }

        return true;
    }

    ipMatches(ip, pattern) {
        // Support for CIDR notation and wildcards
        if (pattern.includes('/')) {
            // CIDR notation
            const [network, bits] = pattern.split('/');
            const mask = ~(2 ** (32 - parseInt(bits)) - 1);
            return (this.ipToNumber(ip) & mask) === (this.ipToNumber(network) & mask);
        } else if (pattern.includes('*')) {
            // Wildcard notation
            const regex = new RegExp(pattern.replace(/\*/g, '\\d+'));
            return regex.test(ip);
        } else {
            // Exact match
            return ip === pattern;
        }
    }

    ipToNumber(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0);
    }

    /**
     * Validation Methods
     */
    async validatePermissions(permissions) {
        const invalidPermissions = permissions.filter(permission =>
            !this.permissions.has(permission)
        );

        if (invalidPermissions.length > 0) {
            throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
        }
    }

    async validateRoleHierarchy(tenantId, role) {
        // Ensure role level is appropriate
        if (role.level > 100 || role.level < 0) {
            throw new Error('Role level must be between 0 and 100');
        }

        // Ensure canAssign roles have lower levels
        for (const assignableRoleId of role.canAssign) {
            const assignableRole = await this.getRole(tenantId, assignableRoleId);
            if (assignableRole && assignableRole.level >= role.level) {
                throw new Error(`Cannot assign role ${assignableRoleId} with equal or higher level`);
            }
        }
    }

    async validateRoleAssignment(currentRoles, newRole) {
        // Check for conflicting roles
        for (const currentRoleId of currentRoles) {
            const currentRole = this.roles.get(currentRoleId);
            if (currentRole && currentRole.conflicts && currentRole.conflicts.includes(newRole.id)) {
                throw new Error(`Role ${newRole.id} conflicts with existing role ${currentRoleId}`);
            }
        }
    }

    async canAssignRole(assignerRoles, targetRoleId) {
        for (const assignerRoleId of assignerRoles) {
            const assignerRole = await this.getRole(null, assignerRoleId);
            if (assignerRole && assignerRole.canAssign.includes(targetRoleId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Utility Methods
     */
    generateRoleId() {
        return 'role_' + Math.random().toString(36).substr(2, 9);
    }

    getAllPermissions() {
        return Array.from(this.permissions.values());
    }

    getPermissionsByCategory(category) {
        return Array.from(this.permissions.values()).filter(p => p.category === category);
    }

    getAllRoles() {
        return Array.from(this.roles.values());
    }

    getSystemRoles() {
        return Array.from(this.roles.values()).filter(r => r.isSystemRole);
    }

    /**
     * Placeholder methods for database operations
     */
    async getRole(tenantId, roleId) {
        // System roles are global
        if (this.roles.has(roleId)) {
            return this.roles.get(roleId);
        }

        // Custom roles are tenant-specific
        console.log(`Getting role ${roleId} for tenant ${tenantId}`);
        return null;
    }

    async saveRole(tenantId, role) {
        console.log(`Saving role ${role.id} for tenant ${tenantId}`);
    }

    async removeRole(tenantId, roleId) {
        console.log(`Removing role ${roleId} for tenant ${tenantId}`);
    }

    async getUserRoles(tenantId, userId) {
        console.log(`Getting roles for user ${userId} in tenant ${tenantId}`);
        return [];
    }

    async getUsersWithRole(tenantId, roleId) {
        console.log(`Getting users with role ${roleId} in tenant ${tenantId}`);
        return [];
    }

    async saveUserRoleAssignment(assignment) {
        console.log('Saving role assignment:', assignment);
    }

    async removeUserRoleAssignment(tenantId, userId, roleId) {
        console.log(`Removing role ${roleId} from user ${userId} in tenant ${tenantId}`);
    }

    async logRoleAssignment(tenantId, userId, roleId, performedBy, action) {
        console.log(`Role ${action}: ${roleId} for user ${userId} by ${performedBy}`);
    }

    async isUserAssignedToClient(tenantId, userId, clientId) {
        console.log(`Checking if user ${userId} is assigned to client ${clientId}`);
        return false;
    }
}

module.exports = RBACSystem;