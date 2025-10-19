# Task Template Management - User Guide

## Overview

The Task Template Management system allows supervisors to create reusable checklists for jobs, reducing manual data entry and ensuring consistency across similar jobs.

## Quick Start

### 1. Create a Task Template

1. Navigate to `/supervisor/templates`
2. Click "Create Template"
3. Fill in template details:
   - **Name**: Descriptive name (e.g., "Lawn Maintenance Checklist")
   - **Description**: Optional details about the template
   - **Job Type**: Category for filtering (e.g., "lawn_maintenance")
   - **Active**: Toggle to enable/disable template
4. Add task items:
   - Click "+ Add Task" to add items
   - Fill in task description
   - Set options:
     - **Required**: Must be completed before job can be marked complete
     - **Photo Verification**: Requires photo upload
     - **Supervisor Approval**: Requires supervisor sign-off
   - Add acceptance criteria (optional)
5. Reorder tasks using up/down arrows
6. Click "Create Template"

### 2. Use Template During Job Creation

1. Navigate to `/supervisor/jobs`
2. Fill in job details (customer, property, title, date)
3. In "Task Template" section:
   - Select template from dropdown
   - Preview shows task count and description
4. Click "Create Job"
5. Tasks are automatically added from template

### 3. Add Template to Existing Job

1. Navigate to job detail page (`/supervisor/jobs/[jobId]`)
2. Scroll to "Tasks" section
3. Click "From Template"
4. Select template from dropdown
5. Preview shows tasks to be added
6. Click "Add Tasks"

### 4. Create Custom Task

1. Navigate to job detail page
2. Scroll to "Tasks" section
3. Click "Custom Task"
4. Fill in:
   - Task description (required)
   - Acceptance criteria (optional)
   - Options checkboxes
5. Click "Add Task"

### 5. Manage Tasks

On job detail page, each task can be:
- **Expanded**: Click task to view full details
- **Edited**: Click "Edit" button in expanded view
- **Deleted**: Click "Delete" button (with confirmation)
- **Reordered**: Use up/down arrows to change order

## Common Workflows

### Scenario 1: Standard Lawn Service

**Goal**: Create consistent checklist for all lawn jobs

**Steps**:
1. Create template "Lawn Service Standard"
2. Add tasks:
   - Mow lawn (required, photo)
   - Edge sidewalks (required)
   - Blow debris (required)
   - Check sprinklers (optional)
   - Gate closed and locked (required)
3. Save template
4. When creating lawn jobs, select this template
5. Tasks auto-populate for consistency

### Scenario 2: Custom Job with Modifications

**Goal**: Use template but add specific tasks for one property

**Steps**:
1. Create job with standard template
2. Navigate to job detail page
3. Tasks from template are listed
4. Click "Custom Task" to add property-specific items
5. Example: "Check pool equipment" for properties with pools
6. All tasks (template + custom) shown together

### Scenario 3: Mid-Job Task Addition

**Goal**: Add forgotten task while crew is on-site

**Steps**:
1. Crew reports missing task
2. Navigate to job detail page
3. Click "Custom Task"
4. Add task: "Trim hedges along fence"
5. Task immediately visible to crew
6. Crew completes and marks complete

## Best Practices

### Template Design

✅ **DO**:
- Use clear, action-oriented task descriptions
- Group related tasks together (use task order)
- Mark safety-critical tasks as required
- Use acceptance criteria for quality standards
- Create templates for frequently repeated jobs

❌ **DON'T**:
- Create overly generic templates
- Include too many optional tasks
- Use vague task descriptions
- Forget to mark required tasks
- Create templates for one-off jobs

### Task Management

✅ **DO**:
- Review template tasks before job starts
- Add property-specific tasks as needed
- Use acceptance criteria for quality control
- Require photos for before/after documentation
- Mark completion in order

❌ **DON'T**:
- Delete required tasks without reason
- Skip acceptance criteria review
- Reorder tasks that have dependencies
- Mark tasks complete prematurely
- Ignore photo requirements

### Template Maintenance

✅ **DO**:
- Review templates quarterly
- Update based on crew feedback
- Deactivate obsolete templates
- Version template names (e.g., "v2")
- Document why tasks are required

❌ **DON'T**:
- Delete templates with active jobs
- Make breaking changes to active templates
- Keep unused templates active
- Change task order without testing
- Remove safety-related tasks

## Tips & Tricks

### 1. Template Naming Convention
Use format: `[Service] - [Variation] - [Season]`
- Examples:
  - "Lawn - Standard - Summer"
  - "Lawn - Premium - Spring"
  - "Cleanup - Fall Leaves"

### 2. Task Order Strategies
Group tasks by:
- **Location**: "Front yard", "Back yard", "Side yard"
- **Type**: "Mowing", "Edging", "Cleanup"
- **Sequence**: "Setup", "Work", "Cleanup", "Inspection"

### 3. Photo Requirements
Require photos for:
- Before/after comparisons
- Quality verification
- Damage documentation
- Safety compliance
- Customer communication

### 4. Acceptance Criteria Examples
- "Grass height 3 inches or less"
- "No clippings on sidewalk or driveway"
- "All gates closed and locked"
- "Equipment returned to trailer"
- "Customer signature obtained"

### 5. Supervisor Approval When to Use
Require supervisor approval for:
- Safety-critical tasks
- Quality checkpoints
- Equipment operation
- Chemical application
- Customer interactions

## Troubleshooting

### Problem: Template tasks not appearing in new job

**Solution**:
1. Verify template is marked as "Active"
2. Refresh the job creation page
3. Check that template has items
4. Look for error notifications

### Problem: Cannot delete task from job

**Possible Causes**:
1. Task is marked as required
2. Task is already completed
3. Task is from template (soft delete instead)

**Solution**:
- Required tasks should not be deleted
- Create a custom task as replacement if needed
- Soft delete marks as deleted but preserves history

### Problem: Tasks out of order

**Solution**:
1. Use up/down arrows to reorder
2. Each arrow click swaps two adjacent tasks
3. Changes save immediately
4. Refresh page to verify

### Problem: Template changes affecting existing jobs

**Answer**: This is by design!
- Templates are snapshots at creation time
- Changing template doesn't affect existing jobs
- This preserves historical accuracy
- Create new template version if needed

## Keyboard Shortcuts

Currently in development. Future release will include:
- `Ctrl+K`: Quick template search
- `Ctrl+N`: New custom task
- `Ctrl+E`: Edit selected task
- `Space`: Expand/collapse task

## Mobile Considerations

The interface is optimized for mobile (375px viewport):
- Large touch targets
- Swipe gestures (coming soon)
- Simplified layouts
- Vertical scrolling
- Full-screen modals

## Voice Commands (Coming Soon)

Future voice integration will support:
- "Add task: [description]"
- "Mark task complete: [task name]"
- "Show next task"
- "Apply template: [name]"

## Support

### Common Questions

**Q: Can I copy an existing template?**
A: Not yet. Manually recreate or use edit to modify existing template.

**Q: Can tasks have due dates?**
A: Not yet. Coming in Phase 5.

**Q: Can I assign tasks to specific crew members?**
A: Not yet. Coming in Phase 5.

**Q: Can I see task completion history?**
A: Yes, via task details. Full audit log coming soon.

**Q: Can I export templates?**
A: Not yet. Coming in future release.

### Getting Help

- Check this guide first
- Review error messages carefully
- Contact support: super@tophand.tech
- Report bugs: GitHub Issues

---

**Last Updated**: 2025-10-18
**Version**: 1.0
**Phase**: 4 Complete

Generated with [Claude Code](https://claude.com/claude-code)
