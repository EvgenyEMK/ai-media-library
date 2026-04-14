# Media Management System - User Experience

## User Experience

### Albums View
- **Page Title**: "Media Albums"
- **Album Grid/List Display**: Users can view all accessible albums in either grid or list view
- **Album Cards**: Each album card displays:
  - Album name
  - Media item count
  - Visibility indicator (Public/Private icon)
  - Cover image (if available) or default folder icon
- **Create Album**: Users with `canCreateAlbums` permission can create new albums via "New Album" button
- **Album Creation Modal**: 
  - Album name (required)
  - Description (optional)
  - Visibility selector: Public or Private (defaults to Private)
- **Delete Album**: 
  - Available only in list view (not grid view)
  - "..." icon on the right side of each album card
  - Dropdown menu with "Delete" option
  - Delete option is disabled if album contains media items (must be empty to delete)
  - Tooltip explains why deletion is disabled for non-empty albums
  - Yes/No confirmation dialog before deletion
  - Requires owner or `delete:all` permission
  - Server-side validation prevents deletion of non-empty albums

### Album Content View
- **Page Header**: Album name displayed as prominent heading (text-4xl font-bold)
- **Album Description**: Shown below album name when available
- **Navigation**: "Back to Albums" button to return to albums list
- **Consolidated Action Buttons**: All actions in a single horizontal line:
  - Upload Media button (shown when user has upload permission)
  - Filters button (toggle filter panel)
  - Grid view toggle
  - List view toggle
- **Filter Panel**: 
  - Filter by file type (photo/video)
  - Clear filters option
  - Only shown when Filters button is clicked (no duplicates)
- **Media Items Display**: 
  - Grid view: Responsive grid (2 cols mobile, 3 tablet, 4 desktop)
  - List view: Compact list with thumbnails
  - Click on item to open in lightbox
- **Delete Media Item**: 
  - Available only in list view (not grid view)
  - "..." icon on the right side of each media item
  - Dropdown menu with "Delete" option
  - Yes/No confirmation dialog before deletion
  - Deletes both database record and storage files (main file and thumbnail)
  - Requires owner or `delete:all` permission
- **Empty States**: Clear messaging when no albums or no media items found

### Album ID in URI
- Album selection updates URL query parameter: `?album=<albumId>`
- Browser back/forward navigation supported
- Shareable URLs for specific albums
- State persists across page refreshes

### Photo Viewer (Lightbox)
- **Full-screen media viewer**: Opens when clicking on a media item from album content view
- **Theme-Aware Styling**: Background and controls adapt to light/dark theme preferences
- **Navigation Controls**:
  - Large Previous/Next arrow buttons (left/right) for manual navigation
  - Thumbnail strip at bottom for direct navigation to any item (hidden during slideshow)
  - Keyboard navigation supported (arrow keys)
- **Smooth Transitions**:
  - Crossfade transition effect between images (default 1500ms, configurable)
  - Transitions apply to manual navigation (prev/next buttons, thumbnail clicks) and slideshow mode
  - Proper image sizing and centering maintained during transitions between different aspect ratios (horizontal/vertical)
  - No empty screen or flash effects - previous and new images overlap smoothly
- **Fullscreen Mode**:
  - Fullscreen button in top-left controls to enter/exit fullscreen view
  - Cross-browser fullscreen API support
  - Exit fullscreen via ESC key or button click
- **Slideshow Mode**:
  - Play/Pause button (icon-only) to start/stop automatic slideshow
  - Immediately transitions to next image when play mode starts (no delay)
  - Automatic progression with configurable duration (default 4 seconds, configurable)
  - Smooth transitions between images
  - Images display at full viewport height during slideshow
  - Thumbnail strip automatically hidden during slideshow for immersive viewing
  - Pause and resume at any time
- **Media Information Panel**:
  - Toggle Info button (icon-only) to show/hide media details
  - Displays: title, creation date, description (if available), file type
  - Download button to download the original file
  - Share button (future functionality)
  - Image automatically adjusts size to prevent overlap with info panel
- **Controls Bar**: All controls positioned in top-left corner (icon-only buttons):
  - Play/Pause slideshow
  - Show/Hide info panel
  - Enter/Exit fullscreen
- **Close**: X button in top-right corner to close photo viewer

