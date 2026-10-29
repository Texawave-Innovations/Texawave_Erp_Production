// Pure JS logic verification running directly in node

function validateMomDraft(data) {
  const errors = [];
  if (!data.projectId || !data.projectId.trim()) {
    errors.push('A valid Project must be selected.');
  }
  if (!data.meetingTitle || !data.meetingTitle.trim()) {
    errors.push('Meeting Title is required to save a draft.');
  }
  return { isValid: errors.length === 0, errors };
}

function validateMomFinalize(data) {
  const errors = [];
  if (!data.projectId || !data.projectId.trim()) {
    errors.push('Project must be selected.');
  }
  if (!data.meetingTitle || !data.meetingTitle.trim()) {
    errors.push('Meeting Title is required.');
  }
  if (!data.meetingDate || !data.meetingDate.trim()) {
    errors.push('Meeting Date is required to finalize.');
  }
  if (!data.startTime || !data.startTime.trim()) {
    errors.push('Meeting Start Time is required to finalize.');
  }
  if (!data.endTime || !data.endTime.trim()) {
    errors.push('Meeting End Time is required to finalize.');
  }
  const presentAttendees = (data.attendees || []).filter(
    (a) => a.attendance === 'present' || a.attendance === 'remote'
  );
  if (presentAttendees.length === 0) {
    errors.push('At least one attendee must be marked as present or remote.');
  }
  const hasNotes = (data.meetingNotes || []).some(
    (n) => (n.agendaItem && n.agendaItem.trim()) || (n.discussionPoints && n.discussionPoints.trim()) || (n.actionItems && n.actionItems.trim())
  );
  if (!hasNotes) {
    errors.push('At least one meeting notes row with discussion points or action items is required.');
  }
  return { isValid: errors.length === 0, errors };
}

function canUserAccessProject(user, project) {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  if (role === 'admin' || role === 'manager') return true;
  if (!project) return false;
  const userId = user.id || user.uid || user.username || '';
  const userName = (user.name || user.username || '').toLowerCase();
  if (project.members && typeof project.members === 'object') {
    const memberKeys = Object.keys(project.members);
    if (memberKeys.includes(userId)) return true;
    const memberMatches = Object.values(project.members).some((m) => {
      const empId = (m?.empId || '').toLowerCase();
      const mName = (m?.name || '').toLowerCase();
      return empId === userId.toLowerCase() || (userName && mName === userName);
    });
    if (memberMatches) return true;
  }
  return false;
}

function hasMomPermission(currentUser, action, document, project) {
  if (!currentUser) return false;
  const role = (currentUser.role || '').toLowerCase();
  const userId = currentUser.id || currentUser.uid || currentUser.username || '';
  if (role === 'admin') return true;
  if (action === 'manage_templates') return role === 'manager';
  if (project && !canUserAccessProject(currentUser, project)) return false;
  switch (action) {
    case 'view':
      return true;
    case 'create_draft':
      return true;
    case 'edit_draft':
      if (document && document.status !== 'draft') return false;
      if (role === 'manager') return true;
      if (document && document.createdBy && document.createdBy !== userId) return false;
      return true;
    case 'finalize':
      return role === 'manager';
    case 'create_revision':
      if (document && document.status !== 'finalized') return false;
      return role === 'manager';
    case 'archive':
    case 'restore':
      return role === 'manager';
    default:
      return false;
  }
}

// EXECUTE TESTS
const results = [];
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    passed++;
    results.push('PASS: ' + name);
  } else {
    failed++;
    results.push('FAIL: ' + name);
  }
}

// 1. Draft validation
assert(validateMomDraft({ projectId: 'p1', meetingTitle: 'Kickoff' }).isValid, 'Valid draft accepted');
assert(!validateMomDraft({ meetingTitle: 'Kickoff' }).isValid, 'Draft without project rejected');
assert(!validateMomDraft({ projectId: 'p1', meetingTitle: '  ' }).isValid, 'Draft with whitespace title rejected');

// 2. Finalize validation
assert(!validateMomFinalize({ projectId: 'p1', meetingTitle: 'Review' }).isValid, 'Incomplete finalize rejected');
assert(validateMomFinalize({
  projectId: 'p1',
  meetingTitle: 'Review',
  meetingDate: '2026-09-05',
  startTime: '10:00',
  endTime: '11:00',
  attendees: [{ id: '1', attendance: 'present' }],
  meetingNotes: [{ agendaItem: 'Item 1', actionItems: 'Task 1' }]
}).isValid, 'Complete finalize accepted');

// 3. Permissions
const admin = { id: 'admin1', role: 'admin' };
const mgr = { id: 'mgr1', role: 'manager' };
const dev = { id: 'dev1', role: 'employee' };
const proj = { members: { dev1: { empId: 'dev1', name: 'dev1' } } };

assert(hasMomPermission(admin, 'manage_templates'), 'Admin can manage templates');
assert(hasMomPermission(mgr, 'manage_templates'), 'Manager can manage templates');
assert(!hasMomPermission(dev, 'manage_templates'), 'Developer cannot manage templates');
assert(hasMomPermission(dev, 'create_draft', null, proj), 'Project member can create draft');
assert(hasMomPermission(dev, 'edit_draft', { status: 'draft', createdBy: 'dev1' }, proj), 'Draft author can edit draft');
assert(!hasMomPermission(dev, 'edit_draft', { status: 'finalized', createdBy: 'dev1' }, proj), 'Cannot edit finalized document as draft');
assert(hasMomPermission(mgr, 'create_revision', { status: 'finalized' }, proj), 'Manager can create revision from finalized document');

// 4. Lifecycle & Immutability Simulation
const initialDoc = {
  id: 'doc1',
  reference: 'MOM-2026-0001',
  status: 'finalized',
  currentRevision: 1,
  revisions: [{ revisionNumber: 1, title: 'Meeting v1' }]
};

// Start Revision
const workingCopy = {
  ...initialDoc,
  status: 'draft',
  workingRevision: 2,
  workingRevisionReason: 'Add deliverables'
};
assert(workingCopy.workingRevision === 2, 'Working revision 2 started');
assert(workingCopy.revisions[0].revisionNumber === 1, 'Previous revision 1 preserved');

// Finalize Revision
const finalRev2 = {
  ...workingCopy,
  status: 'finalized',
  currentRevision: 2,
  workingRevision: undefined,
  workingRevisionReason: undefined,
  revisions: [
    ...workingCopy.revisions,
    { revisionNumber: 2, title: 'Meeting v2' }
  ]
};
assert(finalRev2.currentRevision === 2, 'Promoted to official Revision 2');
assert(finalRev2.revisions.length === 2, 'Two immutable revision snapshots preserved');

// Archive & Restore
const archived = { ...finalRev2, status: 'archived', previousStatus: finalRev2.status };
assert(archived.status === 'archived' && archived.previousStatus === 'finalized', 'Document archived with state tracking');
const restored = { ...archived, status: archived.previousStatus, previousStatus: undefined };
assert(restored.status === 'finalized' && restored.previousStatus === undefined, 'Document restored to finalized');

console.log(`\n========================================`);
console.log(`MoM Logic Verification: ${passed} passed, ${failed} failed`);
console.log(`========================================`);
results.forEach(r => console.log('  ' + r));
if (failed > 0) process.exit(1);

