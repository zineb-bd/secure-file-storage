export interface RolePermission {
  id: string
  labelKey: string
}

export interface RolePermissionCategory {
  id: string
  labelKey: string
  permissions: RolePermission[]
}

export const ROLE_PERMISSION_CATALOG: RolePermissionCategory[] = [
  {
    id: 'documents',
    labelKey: 'roles.catDocuments',
    permissions: [
      { id: 'doc.view', labelKey: 'roles.permDocView' },
      { id: 'doc.upload', labelKey: 'roles.permDocUpload' },
      { id: 'doc.download', labelKey: 'roles.permDocDownload' },
      { id: 'doc.preview', labelKey: 'roles.permDocPreview' },
      { id: 'doc.edit', labelKey: 'roles.permDocEdit' },
      { id: 'doc.delete', labelKey: 'roles.permDocDelete' },
      { id: 'doc.archive', labelKey: 'roles.permDocArchive' },
    ],
  },
  {
    id: 'users',
    labelKey: 'roles.catUsers',
    permissions: [
      { id: 'users.view', labelKey: 'roles.permUsersView' },
      { id: 'users.create', labelKey: 'roles.permUsersCreate' },
      { id: 'users.edit', labelKey: 'roles.permUsersEdit' },
      { id: 'users.delete', labelKey: 'roles.permUsersDelete' },
      { id: 'users.activate', labelKey: 'roles.permUsersActivate' },
    ],
  },
  {
    id: 'categories',
    labelKey: 'roles.catCategories',
    permissions: [
      { id: 'cat.view', labelKey: 'roles.permCatView' },
      { id: 'cat.create', labelKey: 'roles.permCatCreate' },
      { id: 'cat.edit', labelKey: 'roles.permCatEdit' },
      { id: 'cat.delete', labelKey: 'roles.permCatDelete' },
    ],
  },
  {
    id: 'audit',
    labelKey: 'roles.catAudit',
    permissions: [
      { id: 'audit.view', labelKey: 'roles.permAuditView' },
      { id: 'audit.search', labelKey: 'roles.permAuditSearch' },
      { id: 'audit.export', labelKey: 'roles.permAuditExport' },
    ],
  },
  {
    id: 'administration',
    labelKey: 'roles.catAdministration',
    permissions: [
      { id: 'admin.roles', labelKey: 'roles.permAdminRoles' },
      { id: 'admin.permissions', labelKey: 'roles.permAdminPermissions' },
      { id: 'admin.storage', labelKey: 'roles.permAdminStorage' },
      { id: 'admin.security', labelKey: 'roles.permAdminSecurity' },
    ],
  },
]

export const SYSTEM_ROLE_NAMES = ['Admin', 'User'] as const

export function isSystemRole(name: string) {
  return SYSTEM_ROLE_NAMES.some((r) => r.toLowerCase() === name.toLowerCase())
}

const ALL_PERMISSION_IDS = ROLE_PERMISSION_CATALOG.flatMap((c) => c.permissions.map((p) => p.id))

const USER_GRANTED = new Set([
  'doc.view',
  'doc.upload',
  'doc.download',
  'doc.preview',
  'doc.edit',
  'doc.archive',
  'cat.view',
  'cat.create',
  'cat.edit',
])

export function deriveRolePermissions(roleName: string): Set<string> {
  const name = roleName.toLowerCase()
  if (name === 'admin') return new Set(ALL_PERMISSION_IDS)
  if (name === 'user') return new Set(USER_GRANTED)
  return new Set(['doc.view', 'doc.preview'])
}

export function countRolePermissions(roleName: string) {
  return deriveRolePermissions(roleName).size
}

export function totalPermissionCount() {
  return ALL_PERMISSION_IDS.length
}
