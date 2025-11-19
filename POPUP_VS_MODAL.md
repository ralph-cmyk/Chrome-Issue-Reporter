# Popup vs Modal UI Decision

## Current State

The extension has two UI systems:

1. **Modal UI** (in `content.js`) - Newer, full-featured
   - Supports screenshots
   - Injected into page content
   - Used by: Action button click, context menu, live select

2. **Popup UI** (in `ui/popup.html` and `ui/popup.js`) - Legacy
   - Does NOT support screenshots
   - Opens as browser popup window
   - Currently NOT used (manifest has no `default_popup`)

## Decision: Keep Modal, Deprecate Popup

**Recommendation:** Keep the modal as the primary UI and deprecate/remove the popup.

### Reasons:
- Modal supports all features (screenshots, projects, milestones)
- Popup doesn't support screenshots
- Action button already uses modal via `chrome.action.onClicked`
- Modal provides better UX (stays on page, no separate window)

### Action Items:
- [ ] Remove `ui/popup.html` and `ui/popup.js` files
- [ ] Or keep them but add deprecation notice
- [ ] Ensure all entry points use modal (already done)

## Current Entry Points

All entry points currently use the modal:
- ✅ Action button (`chrome.action.onClicked`) → Modal
- ✅ Context menu → Modal  
- ✅ Live select → Modal

The popup is not used anywhere in the current implementation.

