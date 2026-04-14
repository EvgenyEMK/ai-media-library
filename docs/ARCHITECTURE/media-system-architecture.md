# Media Management System - Technical Summary

## Technical Summary

### Component Architecture

The media management system follows a **modular, component-based architecture** with clear separation of concerns:

**Main Wrapper:**
- `MediaAlbums.tsx` - Orchestrates state, URL management, and conditional rendering

**Feature Components:**
- `MediaAlbumsList.tsx` - Albums overview (grid/list view)
- `MediaAlbumItems.tsx` - Album content (media items grid/list)

**Reusable Sub-Components (organized by function):**
- **Albums View** (`albums/`): `MediaAlbumsHeader`, `AlbumCardGridView`, `AlbumCardListView`
- **Album Content View** (`album-content/`): `MediaAlbumItemsGridView`, `MediaAlbumItemsListView`
- **Album Viewer**: `MediaAlbumViewer` (wraps `MediaSwiperViewer` from `@emk/media-viewer` shared package)
- **Actions** (`actions/`): `AlbumActionsMenu`, `MediaItemActionsMenu`, `DeleteConfirmationDialog`, `DeleteMediaItemConfirmationDialog`
- **Upload** (`upload/`): `MediaUpload`, `MediaBulkUpload`
- **Modals** (`modals/`): `CreateAlbumModal`
- **Filters** (`filters/`): `MediaItemFilters`

This architecture enables:
- **DRY principles** - Shared viewer component (`MediaSwiperViewer`) used by both web and desktop apps
- **Flexibility** - Easy swapping between grid/list views
- **Maintainability** - Small, focused components organized by function
- **Reusability** - View components usable across contexts; shared `@emk/media-viewer` package powers both web and desktop
- **Consistency** - Unified Swiper-based viewer experience across all platforms

### Components

#### `MediaAlbums.tsx`
- **Purpose**: Main client component wrapper for media management
- **Responsibilities**:
  - Manages album selection state
  - Handles URL synchronization with album selection
  - Coordinates photo viewer state
  - Displays either albums list or album content based on selection
  - Renders albums grid/list view when no album selected
  - Renders media items when album is selected
- **State Management**: 
  - Selected album ID
  - Photo viewer open/closed
  - Current image index
  - View mode (grid/list)
- **Key Features**:
  - Dual-mode display (albums vs. content)
  - Responsive layouts
  - URL state persistence with `useEffect` synchronization

#### `MediaAlbumsList.tsx`
- **Purpose**: Displays the albums list view
- **Responsibilities**:
  - Renders album grid/list view based on view mode
  - Manages album creation modal state
  - Coordinates view mode toggling
  - Handles album deletion with confirmation
- **Child Components**:
  - `MediaAlbumsHeader` - Page title and action buttons
  - `AlbumCardGridView` - Grid layout album cards
  - `AlbumCardListView` - List layout album cards with delete option
  - `CreateAlbumModal` - Album creation dialog
  - `DeleteConfirmationDialog` - Album deletion confirmation

#### `MediaAlbumItems.tsx`
- **Purpose**: Displays media items within a selected album
- **Responsibilities**:
  - Renders media items grid/list view based on view mode
  - Manages filter state and display
  - Handles album navigation and actions
  - Handles media item deletion with confirmation
- **Child Components**:
  - `MediaAlbumItemsGridView` - Grid layout for media items
  - `MediaAlbumItemsListView` - List layout for media items with delete option
  - `MediaItemFilters` - File type filtering UI
  - `MediaUpload` - Upload interface component
  - `DeleteMediaItemConfirmationDialog` - Media item deletion confirmation

#### `components/MediaAlbumsHeader.tsx`
- **Purpose**: Header section for albums list view
- **Features**:
  - Page title display
  - "New Album" button (conditional on permissions)
  - Grid/List view toggle buttons

#### `components/AlbumCardGridView.tsx`
- **Purpose**: Single album card in grid layout
- **Features**:
  - Cover image or default folder icon
  - Album name and item count
  - Visibility indicator (Public/Private)
  - Hover overlay with album info
  - Click to navigate to album

#### `components/AlbumCardListView.tsx`
- **Purpose**: Single album card in list layout
- **Features**:
  - Compact horizontal layout
  - Cover image or default folder icon
  - Album name, description, and metadata
  - Visibility indicator (Public/Private)
  - Item count and creation date
  - Click to navigate to album
  - Delete option via "..." dropdown menu (only shown when `onDelete` prop provided)
  - Delete option disabled when album has media items (`media_count > 0`)
  - Tooltip explains why deletion is disabled

#### `components/MediaAlbumItemsGridView.tsx`
- **Purpose**: Grid layout for displaying media items
- **Features**:
  - Responsive grid (2/3/4 columns based on breakpoint)
  - Hover overlay with image info
  - Click to open in lightbox
  - Image optimization with width/height attributes

#### `components/MediaAlbumItemsListView.tsx`
- **Purpose**: List layout for displaying media items
- **Features**:
  - Compact horizontal layout
  - Thumbnail preview
  - Title and metadata display
  - File type and creation date
  - Click to open in lightbox
  - Delete option via "..." dropdown menu (only shown when `onDelete` prop provided)

#### `components/MediaItemFilters.tsx`
- **Purpose**: Filter UI for media items by file type
- **Features**:
  - Dynamic filter buttons based on available file types
  - Multi-select file type filtering
  - "Clear all filters" option
  - Visual feedback for active filters

#### `components/MediaUpload.tsx`
- **Purpose**: Upload modal interface for adding media items to albums
- **Responsibilities**:
  - File selection and validation
  - Title and description input
  - Upload progress and error handling
  - Integration with upload server actions
- **Features**:
  - Modal dialog interface
  - File type validation (image/*, video/*)
  - Auto-fill title from filename
  - Client-side metadata extraction (including creation dates)
  - Automatic extraction of:
    - `fileCreatedAt` from file.lastModified (YYYY-MM-DD format)
    - `filenameDate` from filename pattern (YYYY-MM or YYYY format)
  - Direct upload to Supabase storage
  - Database record creation with both date fields
  - Progress and error feedback
  - Automatic page refresh after success

#### `components/CreateAlbumModal.tsx`
- **Purpose**: Modal dialog for creating new albums
- **Responsibilities**:
  - Album name and description input
  - Visibility selection (Public/Private)
  - Form validation
  - Server action invocation
- **Features**:
  - Form validation
  - Error handling
  - Success feedback
  - Automatic refresh after creation

#### `components/DeleteConfirmationDialog.tsx`
- **Purpose**: Confirmation dialog for album deletion
- **Features**:
  - Yes/No confirmation dialog
  - Displays album name
  - Loading state during deletion
  - Prevents accidental deletions

#### `components/DeleteMediaItemConfirmationDialog.tsx`
- **Purpose**: Confirmation dialog for media item deletion
- **Features**:
  - Yes/No confirmation dialog
  - Displays media item title
  - Loading state during deletion
  - Prevents accidental deletions

#### `components/MediaAlbumViewer.tsx`
- **Purpose**: Swiper-based album photo viewer
- **Responsibilities**:
  - Wraps the shared `MediaSwiperViewer` from `@emk/media-viewer` package
  - Maps media items to viewer format via `resolveMediaSources()`
  - Renders `PhotoWithInfoPanel` as the info panel
- **Key Features**:
  - Swiper-powered image carousel with thumbnail rail
  - Keyboard navigation
  - Slideshow with configurable duration
  - Fullscreen support
  - Info panel toggle showing metadata, face tags, etc.
  - Shared across web and desktop apps via `@emk/media-viewer` package

### Server Actions

#### `actions/create-album.ts`
- **Purpose**: Server action for creating new media albums
- **Function**: `createAlbum(name, visibility, description)`
- **Responsibilities**:
  - Permission checking (`canCreateAlbums`)
  - Input validation
  - Database album creation
  - Cache revalidation
- **Returns**: `{ success: boolean, error?: string, data?: { albumId: string } }`

#### `actions/create-media-item.ts`
- **Purpose**: Create media item record in database after file upload
- **Function**: `createMediaItemInDb(params)`
- **Responsibilities**:
  - Permission checking
  - Media item metadata creation
  - Storing both `file_created_at` and `created_yyyy_mm` fields separately
  - Linking to album
  - Error handling
- **Parameters**:
  - `fileCreatedAt`: YYYY-MM-DD format from file metadata (optional)
  - `filenameDate`: YYYY-MM or YYYY format from filename (optional)

#### `actions/upload.ts`
- **Purpose**: Handle file upload to storage and create media item
- **Function**: `uploadMediaToAlbum(formData)`
- **Responsibilities**:
  - File validation (type, size)
  - Storage upload
  - Database record creation
  - Album linking

#### `actions/prepare-upload.ts`
- **Purpose**: Generate signed upload URLs for client-side upload
- **Function**: `prepareUpload(albumId, filename, fileSize, mimeType)`
- **Responsibilities**:
  - Generate upload URLs
  - Pre-upload validation
  - Return upload metadata

#### `actions/delete-album.ts`
- **Purpose**: Server action for deleting media albums
- **Function**: `deleteAlbum(albumId)`
- **Responsibilities**:
  - Permission checking (owner or `delete:all`)
  - Album existence validation
  - Checks if album is empty (no media items) before allowing deletion
  - Returns error if album contains media items: "Cannot delete album with media items. Please remove all items first."
  - Database album deletion (cascade removes album associations)
  - Cache revalidation
- **Returns**: `{ success: boolean, error?: string }`
- **Validation Rules**:
  - Album must be empty (no items in `media_album_items` table) before deletion
  - Server-side check prevents deletion even if UI validation is bypassed

#### `actions/delete-media-item.ts`
- **Purpose**: Server action for deleting media items (photos/videos)
- **Function**: `deleteMediaItem(mediaItemId)`
- **Responsibilities**:
  - Permission checking (owner or `delete:all`)
  - Media item existence validation
  - Deletes files from storage (main file and thumbnail)
  - Database record deletion (cascade removes album associations)
  - Handles storage provider abstraction (Supabase/GCS/S3)
  - Cache revalidation
- **Returns**: `{ success: boolean, error?: string }`
- **Storage Cleanup**: 
  - Attempts to delete both main file and thumbnail from storage
  - Continues with database deletion even if storage deletion fails (best effort)

### Database Functions (`lib/db/media.ts`)

#### `getMediaAlbums(filter?, sort?)`
- Fetches all accessible albums for current user
- Includes media count per album (optimized with SQL aggregation)
- Permission-based filtering
- Supports search, visibility, and owner filters

#### `getMediaItemsInAlbum(albumId, sort?, includeUrls?)`
- Fetches media items within a specific album
- Respects album access permissions
- Enriches items with storage URLs
- Supports sorting

#### `getMediaAlbumById(albumId)`
- Fetches single album with permission check
- Returns null if user lacks access

#### `createMediaAlbum(data)`
- Creates new album record
- Validates ownership
- Returns created album

#### `createMediaItem(data)`
- Creates new media item record in database
- Accepts file metadata including creation dates
- Stores `file_created_at` (from file metadata) and `created_yyyy_mm` (from filename) separately
- Returns created media item

#### `linkMediaToAlbum(mediaItemId, albumId, addedBy?, sortOrder?)`
- Links media item to album via junction table
- Handles many-to-many relationship
- Prevents duplicates

### Permissions (`lib/permissions/media.ts`)

#### Key Functions:
- `canViewMedia()` - Check view permission
- `canCreateMedia()` - Check upload permission
- `canCreateAlbums()` - Check album creation permission
- `canEditAlbums()` - Check album edit permission
- `canDeleteAlbums()` - Check album deletion permission
- `canDeleteAllAlbums()` - Check delete all albums permission
- `canDeleteMedia()` - Check media item deletion permission
- `canDeleteAllMedia()` - Check delete all media items permission
- `getAccessibleAlbumIds()` - Get list of accessible album IDs

### Page Component (`page.tsx`)

#### Responsibilities:
- Server-side permission checking
- Fetching albums and media items based on URL parameter
- Passing data to client components
- Handling search params for album selection

### File Creation Date Logic

The system extracts and stores file creation dates from two different sources, stored in separate database fields:

#### `file_created_at` (DATE field)
- **Source**: File metadata (`file.lastModified` property)
- **Format**: YYYY-MM-DD (full date)
- **Purpose**: Represents when the file was last modified (closest approximation to creation date from file system)
- **Extraction**: Automatically extracted during metadata extraction from File object
- **Storage**: Stored as DATE type in database
- **Nullable**: Yes (some files may not have modification date)

#### `created_yyyy_mm` (TEXT field, indexed)
- **Source**: Filename pattern matching
- **Format**: YYYY-MM or YYYY (year-month or year only)
- **Purpose**: User-defined date from filename, used for filtering and sorting by year/month
- **Extraction**: Extracted from filename if it starts with:
  - `YYYY-MM-DD` format → stored as `YYYY-MM` (day is dropped)
  - `YYYY-MM` format → stored as `YYYY-MM`
  - `YYYY` format → stored as `YYYY`
- **Storage**: Stored as TEXT type in database with index for efficient filtering
- **Nullable**: Yes (filenames without date prefix won't have this value)

#### Business Logic
- **Independent Fields**: These two fields are independent by design - they can have different values
- **No Automatic Conversion**: The system does not automatically derive one from the other
- **Filename Priority for Filtering**: When filtering by year/month, `created_yyyy_mm` is used (from filename)
- **File Metadata for Exact Dates**: `file_created_at` provides precise date information when available
- **Use Cases**:
  - Filter by year/month using `created_yyyy_mm` (e.g., "2020", "2020-12")
  - Sort by file creation date using `file_created_at`
  - Display both values in UI (filename date vs. file metadata date)

#### Metadata Extraction (`lib/storage/utils.ts`)

The `extractFileMetadata()` function extracts both dates during file upload:
- **Filename Date Extraction**: `extractDateFromFilename()` uses regex to match date patterns at the start of filenames
- **File Metadata Extraction**: Uses `file.lastModified` timestamp converted to YYYY-MM-DD format
- **Validation**: Both dates are validated (year range 1900-2100, valid months, valid dates)

### Key Features

1. **Permission-Based Access**: All operations respect RBAC permissions
2. **URL State Management**: Album selection reflected in URL query params
3. **Optimized Queries**: Media counts fetched efficiently
4. **Responsive Design**: Mobile-first approach with breakpoints
5. **Dark Mode Support**: Full theme support throughout
6. **Error Handling**: Comprehensive error states and messages
7. **Type Safety**: Full TypeScript coverage
8. **Smart Date Extraction**: Automatic extraction of creation dates from filenames and file metadata
9. **Flexible Date Filtering**: Support for filtering by year/month from filename dates
10. **Delete Functionality**: 
    - Albums and media items can be deleted (with confirmation)
    - Delete option only available in list view for better UX
    - Albums can only be deleted when empty (no media items)
    - Delete button disabled for non-empty albums with tooltip explanation
    - Server-side validation enforces empty album requirement
    - Automatic storage cleanup for media items
    - Permission-based access control for deletions
11. **Photo Viewer (Swiper-based)**:
    - Shared `MediaSwiperViewer` component from `@emk/media-viewer` package
    - Used by both web (`MediaAlbumViewer`) and desktop (`desktop-media`) apps
    - Swiper-powered carousel with vertical thumbnail rail
    - Keyboard navigation, slideshow with autoplay, fullscreen support
    - Optional info panel for metadata, face tags, etc.
    - Thumbnail strip hidden during slideshow
    - Icon-only controls for cleaner UI

### File Structure

```
app/[locale]/media/
├── page.tsx                           # Server component - handles data fetching
├── MediaAlbums.tsx                    # Main client wrapper component
├── MediaAlbumsList.tsx               # Albums list view component
├── MediaAlbumItems.tsx               # Album content view component
├── actions/
│   ├── create-album.ts               # Album creation server action
│   ├── create-media-item.ts          # Media item creation
│   ├── delete-album.ts               # Album deletion server action
│   ├── delete-media-item.ts          # Media item deletion server action
│   ├── upload.ts                     # File upload handling
│   └── prepare-upload.ts            # Upload URL preparation
├── components/
│   ├── albums/                       # Album list/browsing components
│   │   ├── AlbumCardGridView.tsx     # Album card in grid layout
│   │   ├── AlbumCardListView.tsx     # Album card in list layout
│   │   └── MediaAlbumsHeader.tsx     # Albums list page header
│   ├── album-content/                # Album content display components
│   │   ├── MediaAlbumItemsGridView.tsx  # Media items in grid layout
│   │   └── MediaAlbumItemsListView.tsx  # Media items in list layout
│   ├── actions/                      # Action menus and dialogs
│   │   ├── AlbumActionsMenu.tsx         # Album actions dropdown
│   │   ├── MediaItemActionsMenu.tsx     # Media item actions dropdown
│   │   ├── DeleteConfirmationDialog.tsx # Album deletion confirmation
│   │   └── DeleteMediaItemConfirmationDialog.tsx  # Media item deletion confirmation
│   ├── upload/                       # Upload components
│   │   ├── MediaUpload.tsx              # Single file upload
│   │   └── MediaBulkUpload.tsx          # Bulk file upload
│   ├── modals/                       # Modal dialogs
│   │   └── CreateAlbumModal.tsx         # Album creation modal
│   ├── filters/                      # Filter components
│   │   └── MediaItemFilters.tsx         # File type filter UI
│   ├── MediaAlbumViewer.tsx         # Swiper-based album viewer (wraps @emk/media-viewer)
│   └── PhotoWithInfoPanel/          # Photo with info panel component
├── MEDIA-USER-EXPERIENCE.md          # User experience documentation
└── MEDIA-TECH-SUMMARY.md             # Technical documentation
```

### Dependencies

- **Next.js App Router**: Server and client components
- **Supabase**: Database and storage
- **RBAC System**: Permission management
- **Storage Abstraction**: Multi-provider support (Supabase/GCS/S3)
- **TypeScript**: Full type safety
- **Tailwind CSS**: Styling
- **shadcn/ui**: UI component library

