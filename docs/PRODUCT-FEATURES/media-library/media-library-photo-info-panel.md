# Photo With Info Panel - User Experience Summary

## Overview
A full-page component that displays a photo alongside an interactive information panel. The component can be accessed via an Info button on photos and can also be used as a slide within Swiper carousels.

## Layout & Responsiveness

### Desktop View (Landscape, ≥1024px)
- **Layout**: Side-by-side split
  - **Left Side (60% width)**: Photo display area
  - **Right Side (40% width)**: Information panel
- **Photo**: Centered vertically within its container
- **Info Panel**: Full height, scrollable if content exceeds viewport

### Tablet View (Portrait, 768px - 1023px)
- **Layout**: Vertical stack
  - **Top Section**: Photo display area
  - **Bottom Section**: Information panel (collapsible/expandable recommended)
- **Photo**: Centered horizontally, maintains aspect ratio
- **Info Panel**: Can be minimized to allow more space for photo viewing

### Mobile View (≤767px)
- **Layout**: Full-screen overlay with toggle
  - Photo takes full screen initially
  - Info panel slides up from bottom (drawer-style) or can be toggled
- **Photo**: Full width, centered vertically when info panel is hidden
- **Info Panel**: Overlays or replaces photo view when active

## Component Access

The Info panel is accessed via the **Info toggle button** ("i" icon) in the shared photo viewer toolbar (`MediaSwiperViewer`). The same component and behavior is used by both the web app and the desktop app.

### Info Panel Mode (Toggle Behavior)

- **Activation**: Clicking the Info button toggles **info panel mode** on/off.
- **Persistence**: Info panel mode is **persistent across navigation**. When the user navigates to the previous/next photo (via arrow buttons, thumbnail clicks, or keyboard), the info panel stays visible and updates to show information for the newly selected photo. The user does not need to re-enable info mode after each navigation.
- **Deactivation**: Info panel mode is turned off only when:
  - The user clicks the Info button again (explicit toggle off)
  - The viewer is closed
  - A slideshow is started

### Layout in Info Panel Mode

- **Desktop (≥1024px)**: The main content area replaces the Swiper carousel with `PhotoWithInfoPanel`, which renders a side-by-side layout: **photo (60%)** on the left, **info panel (40%)** on the right.
- **Tablet/Mobile (<1024px)**: The layout stacks vertically — photo on top, info panel below.
- **Viewer controls** (play, info, fullscreen, close) and **navigation arrows** are constrained to the photo section width (60%) so that the right-side buttons align with the right edge of the photo, not the full viewport.

### Without Info Panel (Default)

- The main content area shows the Swiper carousel with full-width photo slides.
- Viewer controls and navigation arrows span the full width of the main content area.

## Information Panel Structure

### Tab Navigation
The panel features a horizontal tab bar at the top with three icon-based tabs:

1. **Info Tab** (Information icon)
   - Primary tab, shows structured photo and catalog information (**desktop** uses expanded sections; **web** may differ).
   - **Desktop — first row:** **Rating** — always the **expanded** five-star editor (same component as grid/list expanded mode). **Clear** appears only when a rating is already set (**1–5** or rejected **-1** when shown).
   - **Desktop — below rating:** Photo **title**, then collapsible **`<details>`** sections (default **collapsed**), each with a **chevron** before the section title, e.g. **Image file data**, **Image capture data**, **AI image analysis**, **AI quality…**, **Invoice / receipt** (when relevant). Rating semantics: [FILE-STAR-RATING.md](./FILE-STAR-RATING.md).
   - **General / web-oriented content** may also include description, dates, file size, dimensions, and type depending on app.

2. **Tag Tab** (Tag/Label icon)
   - Shows detected people/pets with bounding box visualization
   - Content:
     - List of detected tags/beings
     - Each tag shows:
       - Category badge: "Adult", "Child", "Baby", or "Pet"
       - Gender indicator: Male, Female, Unknown, or Other
       - Optional: Confidence score or detection info
   - **Visual Features**:
     - When Tag tab is active, bounding boxes overlay the photo
     - Shows both person bounding box and face bounding box (face highlighted)
     - All detected tags visible by default
     - Clicking a specific tag in the list:
       - Highlights only that tag's bounding boxes
       - Dims or hides other tags
       - Scrolls photo to show the selected tag if needed
   - **Interaction**:
     - Clicking a bounding box on the photo selects the corresponding tag in the list
     - Hovering over a tag in the list highlights its bounding box on the photo

3. **Metadata Tab** (Code/JSON icon)
   - Shows raw AI analysis data
   - Content:
     - Formatted JSON display of `ai_metadata`
     - Syntax highlighting for readability
     - Expandable/collapsible sections for nested data
     - Optional: Copy to clipboard button
     - Optional: Download metadata as JSON file

## User Interactions

### Photo Interaction
- **Zoom**: Pinch or scroll to zoom in/out (optional feature)
- **Pan**: Drag to move when zoomed
- **Bounding Box Click**: When Tag tab is active, clicking a bounding box selects the tag

### Panel Interaction
- **Tab Switching**: Click tabs to switch between Info, Tag, and Metadata views
- **Tag Selection**: Click a tag in the list to focus on its bounding box
- **Scroll**: Panel scrolls independently from photo
- **Close/Back**: Button to return to previous view or close the panel

## Visual Design Principles

### Photo Display
- Maintains aspect ratio
- Responsive sizing based on viewport
- Smooth transitions when switching tabs or views
- High-quality image rendering

### Info Panel
- Clean, modern design matching the app's theme
- Clear visual hierarchy
- Readable typography
- Consistent spacing and padding
- Scroll indicators when content overflows

### Bounding Boxes
- **Person Box**: Semi-transparent rectangle with distinct color (e.g., blue)
- **Face Box**: More prominent, possibly different color (e.g., yellow/green)
- **Labels**: Show category and gender near or inside boxes
- **Selected State**: Highlighted with different color or thickness
- **Deselected State**: Dimmed or faded when another tag is selected

## Accessibility

- **Keyboard Navigation**: All tabs and interactive elements keyboard-accessible
- **Screen Readers**: Proper ARIA labels for tabs, tags, and bounding boxes
- **Focus Indicators**: Clear focus states for interactive elements
- **Color Contrast**: Meets WCAG standards for text and UI elements

## Performance Considerations

- **Lazy Loading**: Metadata loads only when Metadata tab is accessed
- **Image Optimization**: Photo loads at appropriate resolution for viewport
- **Smooth Animations**: Transitions should be smooth but not excessive
- **Touch Responsiveness**: Fast response to touch interactions on mobile

## Future Enhancements (Not in Initial Implementation)

- Edit metadata directly from the panel
- Add/remove tags manually
- Export metadata in various formats
- Share photo with metadata
- Compare metadata between photos
- Search/filter within tags

