# UX-010 — Mobile-first Quick Add Template Management

**Priority:** P1  
**Primary outcome:** household members can understand, edit and organize Quick Add shortcuts on any device.

## Problem

The current “Manage Templates” area is a desktop-style table with three columns and 32×32 action buttons. On mobile, table text and metadata become even smaller, while edit mode places multiple inputs inside table cells. Delete has no confirmation/undo feedback and update errors are not surfaced. The name “Admin” suggests permissions or technical administration rather than personal household settings.

## Information architecture

Move the feature to:

`Settings → Quick Add templates`

Route recommendation:

`/settings/quick-add`

Page introduction:

**Quick Add templates**  
“Shortcuts for items your household adds often. Templates can remember a category and preferred store.”

Explain whether templates are automatically created, manually created or both. The current empty copy says they are created automatically, which can leave users unsure how to influence the set.

## Mobile layout

Replace the table below approximately 768 px with a list of cards/rows.

Each template row:

- item name;
- category and store as secondary text/chips;
- drag handle only if reorder is implemented;
- overflow menu for Edit and Delete;
- minimum 56 px row height;
- full-width tap opens Edit.

Do not squeeze desktop columns into a phone.

## Desktop layout

A table is acceptable, but improve:

- 44×44 action targets;
- explicit accessible labels for Edit, Save and Cancel;
- sticky header only for long lists;
- optional search when templates exceed a defined threshold, e.g. 20;
- stable sort/order model.

## Create and edit flow

Use the same adaptive item-details sheet/dialog and category/store comboboxes as UX-005.

Fields:

- template name;
- default quantity, if product decides templates may add more than one;
- category;
- preferred store;
- optional pin/order control later.

Actions:

- Save template;
- Delete template;
- Cancel.

Do not edit within a dense table row on mobile.

## Ordering

Define a product-owned ordering model rather than always sorting alphabetically in the component.

Recommended MVP:

- pinned templates first;
- remaining templates ordered by recent use;
- alphabetical fallback.

If manual reordering is included:

- persist `sortOrder` server-side for the household;
- provide keyboard Move up/Move down controls in addition to drag;
- avoid a drag handle without functional dragging.

## Template generation policy

Choose and document one policy:

### Recommended hybrid

- manually created templates are permanent until deleted;
- frequently added items may appear as suggested templates;
- suggested items require **Add to Quick Add** confirmation before entering the managed template set.

This is clearer than silently creating permanent shortcuts from all behavior.

Show separate sections:

- **Your templates**
- **Suggested from recent items**

## Delete and failure behavior

- Delete is undoable through UX-004.
- If a template is deleted, existing grocery items are unaffected.
- Save uses optimistic update where safe.
- Failed save keeps the editor open and preserves values.
- Duplicate normalized name + metadata prompts Merge/Keep separate according to Quick Add identity rules.

## Accessibility

- template list is a semantic list or table appropriate to viewport;
- all icon controls have names containing the template name;
- chips are text, not color-only;
- edit dialog labels all inputs;
- reorder alternatives are keyboard accessible;
- 200% zoom does not create horizontal scrolling for the main page.

## Engineering plan

- rename `AdminDashboard` to product language such as `QuickAddTemplateManager`;
- split list, row/card and editor components;
- remove inline styles from route headers;
- reuse domain commands and cache updates from UX-003;
- add explicit mutation error handling;
- use one shared datalist/combobox instance per editor—avoid repeated static IDs per table row;
- replace `any` props with inferred schema types.

## Acceptance criteria

- Template management is understandable without the term Admin.
- Mobile uses cards/rows rather than a compressed three-column table.
- Edit and delete targets are at least 44×44.
- Users can create, edit and undo-delete a template.
- Automatic/suggested template behavior is explained and controllable.
- Mutation failures preserve values and expose Retry.
- No duplicate datalist or control IDs exist when multiple rows render.

## Tests

- mobile and desktop responsive rendering;
- create/edit/delete/undo flows;
- duplicate template rules;
- suggested-to-permanent promotion;
- keyboard editing and optional reordering;
- failure recovery;
- typed component contracts without `any` regressions.

## Non-goals

- Role-gated administration.
- Import/export of templates.
- Per-member private templates in the first iteration.
