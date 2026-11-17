-- Insert the two new work-permission entries into the global permission catalog.
-- ON CONFLICT DO NOTHING makes this idempotent: running permissions:sync later
-- won't duplicate them, and re-applying this migration is safe.
INSERT INTO platform.permissions (code, description, is_active, created_at, updated_at)
VALUES
  (
    'employee_self_service.work_permission.read',
    'View my own work permission requests',
    true,
    NOW(),
    NOW()
  ),
  (
    'employee_self_service.work_permission.create',
    'Submit a short-time work permission request for myself',
    true,
    NOW(),
    NOW()
  )
ON CONFLICT (code) DO NOTHING;

-- Grant both permissions to every "Employee" system role across all organizations.
-- The SELECT fans out over every org that has an Employee role (one per org, created
-- at onboarding time), so a single migration covers every existing tenant.
INSERT INTO platform.role_permissions (role_id, permission_id, is_active, created_at, updated_at)
SELECT
  r.id,
  p.id,
  true,
  NOW(),
  NOW()
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.name = 'Employee'
  AND r.is_system = true
  AND p.code IN (
    'employee_self_service.work_permission.read',
    'employee_self_service.work_permission.create'
  )
ON CONFLICT DO NOTHING;
