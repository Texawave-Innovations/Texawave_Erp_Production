INSERT INTO platform.permissions (code, description, is_active, created_at, updated_at)
VALUES
  ('hr.work_permission.read.all', 'View all employee work permission requests', true, NOW(), NOW()),
  ('hr.work_permission.decide.all', 'Approve or reject employee work permission requests', true, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform.role_permissions (role_id, permission_id, is_active, created_at, updated_at)
SELECT r.id, p.id, true, NOW(), NOW()
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.name IN ('HR Manager', 'Super Admin')
  AND r.is_system = true
  AND p.code IN ('hr.work_permission.read.all', 'hr.work_permission.decide.all')
ON CONFLICT DO NOTHING;
