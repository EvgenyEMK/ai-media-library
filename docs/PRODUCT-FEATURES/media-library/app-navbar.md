# App Navbar UX Summary

## Anonymous vs. Logged-in User

### Anonymous User
- **Branding**: Displays "Evgeny Mikheev" text in the left side
- **Navigation Links**: 
  - About Me (/)
  - Experience (/experience)
  - Job History (/job-history)
- **Right Side Controls**: Theme switcher, Language switcher
- **User Menu**: Not shown (returns `null`)

### Logged-in User
- **Branding**: "Evgeny Mikheev" text is hidden
- **Navigation Links**:
  - Media (/media)
  - Projects (/projects)
- **Right Side Controls**: Theme switcher, Language switcher, User menu
- **User Menu**: Displays avatar (or user icon fallback), shows dropdown with user name/email and logout option

---

## Desktop vs. Mobile

### Desktop (md breakpoint and above)
- **Navigation Menu**: Visible inline in the header bar with horizontal layout
- **Hamburger Menu**: Hidden
- **Links**: Displayed as horizontal buttons with underline hover effect
- **Layout**: Full navigation menu shown directly in navbar

### Mobile (below md breakpoint)
- **Navigation Menu**: Hidden from main navbar
- **Hamburger Menu**: Visible on the left side (three-line icon that animates to X when open)
- **Links**: Displayed in a popover/modal that opens from the hamburger button
- **Layout**: Navigation links stack vertically in the popover with full-width clickable areas
- **Interaction**: Popover closes automatically when a link is clicked

---

## Common Elements (Both States & Screen Sizes)

- **Sticky Header**: Navbar sticks to top of viewport (`sticky top-0`)
- **Theme Switcher**: Always visible, allows switching between light/dark themes
- **Language Switcher**: Always visible, allows switching between locales (e.g., EN/FR)
- **Active Link Indication**: Active navigation links are highlighted with bold text and underline animation
- **Responsive Text Sizing**: Brand text scales from `text-xl` (mobile) to `text-3xl` (large screens)
