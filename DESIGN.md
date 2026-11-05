---
name: QAP Chaco News, panel de administración
description: A modern, plainly navigable admin for a small newsroom, with one blue accent and full light and dark themes.
colors:
  primary: "#465fff"
  primary-foreground: "#ffffff"
  background: "#f9fafb"
  foreground: "#1d2939"
  card: "#ffffff"
  link: "#3641f5"
  muted: "#f2f4f7"
  muted-foreground: "#5d6679"
  accent: "#ecf3ff"
  accent-foreground: "#3641f5"
  destructive: "#d92d20"
  destructive-text: "#b42318"
  success: "#027a48"
  success-soft: "#ecfdf3"
  warning: "#b54708"
  warning-soft: "#fffaeb"
  border: "#e4e7ec"
  input: "#d0d5dd"
  ring: "#465fff"
  dark-background: "#101828"
  dark-foreground: "#f2f4f7"
  dark-card: "#1a2231"
  dark-link: "#9cb9ff"
  dark-muted: "#232e40"
  dark-muted-foreground: "#a6b0c0"
  dark-accent: "#252f5a"
  dark-accent-foreground: "#c2d6ff"
  dark-destructive-text: "#fda29b"
  dark-success: "#6ce9a6"
  dark-success-soft: "#0b3b2a"
  dark-warning: "#fec84b"
  dark-warning-soft: "#40290c"
  dark-border: "#2b3648"
  dark-input: "#3d4a5f"
  dark-ring: "#7592ff"
typography:
  figure:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
  headline:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.333
    fontFeature: "tnum"
  note-title:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.556
  reading:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  body:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  caption:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Outfit Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.333
    fontFeature: "tnum"
rounded:
  sm: "6px"
  md: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "color-mix(in oklab, #465fff 90%, transparent)"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  button-row:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  button-danger:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  nav-item:
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  nav-item-hover:
    backgroundColor: "{colors.muted}"
  nav-item-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  pill-rise:
    backgroundColor: "{colors.success-soft}"
    textColor: "{colors.success}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  pill-fall:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  attention-count:
    backgroundColor: "{colors.warning-soft}"
    textColor: "{colors.warning}"
    rounded: "{rounded.md}"
    size: "36px"
---

# Design System: QAP Chaco News, panel de administración

Scope: this system covers the admin panel only (`src/admin`). The public site in the same repository has its own red look and is a separate surface, not documented here.

## Overview

**Creative North Star: "The Morning Desk"**

The panel is where a small newsroom sits down, sees what needs them, and gets to work. It plays the modern admin category straight, in the manner of TailAdmin and built from scratch: a white rail and top bar over a pale grey ground, thin-bordered cards, one blue accent. Nothing in the navigation or the controls asks to be learned. The craft is in the restraint and in the finish: figures that align, states that are always accounted for, a keyboard outline that nothing can hide.

Density is that of a working tool. Body text is 14 px, standard controls are 40 px tall, and the page fits a dense board of figures, a chart and a list of pending work on one screen. The one place the system slows down is the note editor, which gives the text a larger size and a narrow reading column, because that is where someone writes rather than operates.

Light and dark are equal, complete themes rather than one derived from the other. The text pairings the panel uses measure AA or better in both. The QAP logo identifies the product; the rest of the world stays blue and neutral.

**Key Characteristics:**
- White rail and top bar over a pale grey ground, with content on thin-bordered 16 px cards.
- One accent, used for actions and selection.
- Color carries meaning only: amber asks, red warns, green reports good news.
- Flat at rest; only layers that float over the page cast a shadow.
- Outfit throughout, with tabular figures everywhere.
- A real phone layout that reorders the work rather than shrinking the desktop.
- Motion of 150 to 200 ms, on state changes only.

## Colors

A cool blue-grey neutral family with one saturated blue, plus three functional hues that appear only when they mean something.

### Primary
- **Newsroom Blue** (#465fff): the fill of primary actions (Nueva nota, Actualizar), the keyboard ring in the light theme, the chart line and its gradient, section bars, today's mark in the calendar, and text selection. White text on it measures 4.84:1 in both themes, so it does not change between them.
- **Link Blue** (#3641f5 light, #9cb9ff dark): text links, row actions such as Elegir or Revisar, and the matched words in search results. It is separate from the fill so that text stays legible on each ground.
- **Selection Wash** (#ecf3ff with #3641f5 text; #252f5a with #c2d6ff text in dark): the active rail item, the active editor tab, scheduled status, and the hover of outline and ghost buttons.

### Secondary
- **Good News Green** (#027a48 on #ecfdf3; #6ce9a6 on #0b3b2a in dark): rises in figure cards, Publicada status, the "Está lista para publicar" confirmation, and inserted words in diffs.
- **Asking Amber** (#b54708 on #fffaeb; #fec84b on #40290c in dark): items waiting for someone. The count tiles in Requiere atención, the bell's dot, review issues, and page-wide reminder banners.

### Tertiary
- **Danger Red** (#d92d20 fill with white text, in both themes): the confirming button of an irreversible action.
- **Error Text Red** (#b42318 light, #fda29b dark): error messages, a blocked account, and removed words in diffs.

### Neutral
- **Pale Ground** (#f9fafb light, #101828 dark): the page behind the cards, and the fill of outline buttons.
- **Card White** (#ffffff light, #1a2231 dark): cards, rail, top bar, popovers, and page-level fields.
- **Soft Fill** (#f2f4f7 light, #232e40 dark): tracks, skeletons, segmented controls, neutral pills and rail hover.
- **Ink** (#1d2939 light, #f2f4f7 dark): primary text.
- **Quiet Ink** (#5d6679 light, #a6b0c0 dark): captions, table headers, inactive icons and secondary text. It holds at least 5.23:1 on every light surface and 6.24:1 on every dark one.
- **Hairline** (#e4e7ec light, #2b3648 dark): card edges, rows, rail and bar dividers, and chart gridlines.
- **Field Stroke** (#d0d5dd light, #3d4a5f dark): field and outline-button edges, one step stronger than a hairline.

### Named Rules
**The One Blue Rule.** Blue means "act here" or "you are here". If an element is neither an action, a selection nor the data line of a chart, it stays neutral.

**The Falls Stay Neutral Rule.** A figure that falls gets a neutral pill, with the minus sign carrying the direction. It never turns red: fewer readers on a slow week is not an error, and red is reserved for trouble.

**The Green Reports Rule.** Green only reports something good that has already happened: a rise, a published note, a passed review, an inserted word. It is never decoration and never the color of a button.

**The Red Is Trouble Rule.** Inside the panel's own interface, red appears only for errors, danger and removed text. The logo's red tag and the public-site preview box sit outside this rule: they are the brand and the public site, shown as they are.

## Typography

**Body Font:** Outfit Variable (with ui-sans-serif, system-ui, sans-serif)

**Character:** One geometric sans carries every role, so hierarchy comes from size and weight alone. It reads friendly and modern at 14 px and stays firm in large figures.

### Hierarchy
- **Figure** (600, 1.875rem, 1.2): the large number on a figure card.
- **Headline** (600, 1.5rem, 1.333): the one page title, such as Hoy or Editar nota, usually followed by quiet context on the same line.
- **Note Title** (600, 1.25rem, 1.4): the note title field in the editor, which grows with its content.
- **Title** (600, 1.125rem, 1.556): card titles and dialog titles.
- **Reading** (400, 1.0625rem, 1.7): the note body in the editor, in a 34rem column, about 70 characters of Outfit. Subheads inside it are 1.6, 1.3 and 1.1rem at weight 700.
- **Body** (400, 0.875rem, 1.45): all interface text by default. Field labels and rail items use weight 500; row actions and tile counts use 600.
- **Caption** (400, 0.8125rem, 1.45): the line beneath a title, row details and the segmented control's options.
- **Label** (500, 0.75rem, 1.333): pills, rail group names, row-level buttons and counters. Table headers use this size at weight 400, in Quiet Ink.

### Named Rules
**The Tabular Rule.** Every number in the panel uses tabular figures, set once on the body. Columns of readings, counters and dates align without any per-table work.

**The Sentence Case Rule.** Group names, table headers and labels are in sentence case and in Spanish as a person says them. Dates that the formatter gives in lowercase only get their first letter capitalized.

## Layout

The shell is a sticky 264 px rail (80 px when collapsed, a choice that persists) beside a column with a sticky 64 px top bar and a main area capped at 1536 px, padded 24 px, or 16 px below 1024 px. Screens open with a header row at least 40 px tall, 20 px above the content.

Boards sit on a 12-column grid with 16 px gaps. Hoy uses four equal figure cards; then 8 and 4 columns for the chart and Requiere atención; then 7 and 5 for Más leídas and Lecturas por sección. The editor uses 8 and 4 columns: text at left, a side panel at right that stays in view, under a header bar that stays in view as well.

The spacing rhythm is small and regular: 12 px between controls in a row, 16 px between cards, 20 px inside cards, 8 px within a compact group. Table rows have 10 to 12 px of vertical padding. Empty states get 40 px of padding and a centered line.

**Breakpoints adapt the work rather than scale it.** Below 1024 px:
- Requiere atención moves to the top, ahead of the figures. On a phone the job is to resolve what is urgent.
- The calendar's month grid becomes an agenda of day cards, with today and what is coming first.
- The rail becomes a 280 px sheet opened from the menu button.
- The figures hold two columns.

Further down, below 768 px the search field becomes an icon button and fields rise to 16 px type so the phone does not zoom on focus. Below 640 px, the filters in Artículos collapse behind one Filtros control that counts the active ones, Nueva nota becomes its icon, the user's name goes, and the chart labels every other date. Table columns drop one at a time from 1280 px down; title and status always stay.

**The Reading Column Rule.** The note body keeps a 34rem measure inside whatever width the editor has, by padding its sides rather than narrowing the card. It falls back to 20 px of padding on a phone.

## Elevation & Depth

The panel is flat. Depth comes from a pale ground, a lighter card surface and a 1 px hairline. The theme empties the small shadow step, so the shared components that would otherwise lift each control lie flat without any edits. Only layers that truly float over the page keep a shadow, which in the dark theme is barely visible, so there the hairline does the same job.

### Shadow Vocabulary
- **Floating layer** (`box-shadow: 0 10px 15px -3px #0000001a, 0 4px 6px -4px #0000001a`): dialogs, menus, the mobile sheet and toasts.
- **Emptied step** (`--shadow-sm: 0 0 #0000`): the theme's override. Fields, outline buttons, the segmented control's selected option and the chart tooltip use it and stay flat.

### Named Rules
**The Flat Control Rule.** Nothing that sits on the page casts a shadow. A control shows its edge with a border and its state with color. The shared primary button and checkbox still cast a faint 1 to 3 px shadow from another step that the theme did not empty. That is leftover from the shared library, not a pattern to copy.

## Shapes

Corners follow one scale tied to size. Controls are gently curved (8 px): buttons, fields, rail items, tiles, thumbnails. Cards and dialogs are softly rounded (16 px). Confirmation dialogs in the shared library have not caught up (8 px, and square on a phone); that is leftover, and new dialogs use 16 px. Between them, inset panels such as reminder banners, embedded images and the share preview take 12 px. Small things inside a menu or a checkbox take 6 px. Pills, avatars and today's mark are fully round.

The system's icons are one family of line icons, 16 px in text and controls and 20 px in the rail and top bar. Native select arrows and date-picker icons are replaced with drawn line icons in the same style and a fixed mid-grey (#98a2b3), so a native control does not break the family in either theme.

The chart is the one soft form: a 2 px blue line over a gradient of the same blue, fading from 28 percent to nothing.

## Components

### Buttons
Plain and confident; size says how much it matters.
- **Shape:** gently curved (8 px).
- **Primary:** Newsroom Blue with white medium-weight text, 40 px tall in page headers and the top bar, with a line icon where it helps.
- **Hover / Focus:** the fill drops to 90 percent over 150 ms. Keyboard focus draws a 2 px outline in the ring color, 2 px off the edge.
- **Outline:** ground fill with a field-stroke edge; the default for everything that is not the main action. Icon buttons are this style at 40 px square, with a 20 px icon in Quiet Ink.
- **Row-level:** 32 px tall with 12 px text, for actions inside rows, pagers and Reintentar.
- **Ghost:** no fill until hover, for low-weight actions like Quitar.
- **Danger:** red fill, on delete actions and on the confirming button that follows them. Whatever cannot be undone asks first.

### Pills
- **Style:** fully round, label type, 2 px by 8 to 10 px, no border.
- **State:** Publicada in green, Programada in the selection wash, Borrador and Archivada in soft fill. Figure changes are green for rises and neutral for falls. Tags in the editor are outlined pills that take the selection wash when on.

### Cards / Containers
- **Corner Style:** softly rounded (16 px).
- **Background:** Card White on the Pale Ground.
- **Shadow Strategy:** none; see Elevation & Depth.
- **Border:** 1 px hairline.
- **Internal Padding:** 20 px, or none for a table or side panel that runs to the edge. Inside, a title sits above an optional caption, then the content.

### Inputs / Fields
- **Style:** 1 px field stroke, 8 px corners, 14 px text. They are 40 px tall on a page with a card fill, and 36 px inside dialogs and forms, where they sit over the dialog's own surface.
- **Search:** a line icon set 12 px inside the left edge of the field.
- **Select / Date:** native controls for reliability, with the drawn icons described in Shapes. Selects take a Quiet Ink edge on hover.
- **Focus:** a 1 px ring in the ring color on text fields; a 2 px outline on selects.
- **Error / Disabled:** errors are a line of Error Text Red below the field, announced as an alert. Disabled drops to 50 percent opacity.

### Navigation
- **Rail:** white, with the logo above named groups (Contenido, Comunidad, Análisis, Ajustes) in label type. Items are 40 px tall with a 20 px icon and medium-weight text, a counter at the far right, soft fill on hover, selection wash when active. Collapsed, it shows the favicon and icons, with titles on hover.
- **Top bar:** collapse, search, then at right Nueva nota, theme, notifications and user.
- **Editor tabs:** small caption-size tabs, selection wash when active, with the review tab counting its issues.
- **Mobile:** the same rail in a sheet from the left. Its 500 ms opening comes from the shared library and runs past the system's motion range; do not reuse that timing.

### Quick Search (Ctrl K)
The signature interaction. A field in the top bar with its shortcut drawn as a key opens a 576 px dialog set 20 percent down the screen: a borderless 48 px input over a result list that reaches any note, user or action, highlights the matched words in Link Blue, and marks the active row with a return icon.

### Figure Card and Requiere atención
A figure card is a Quiet Ink label, a large number, an optional change pill and a caption explaining what is being compared. Requiere atención rows are a 36 px count tile (amber when waiting on someone, soft fill when just informative), a title and detail, and one Link Blue action at the far right. When it is empty it says so plainly.

### Area Chart
A 240 px chart with five hairline gridlines and Quiet Ink axis labels. Hovering draws a vertical line, a dot and a small bordered tooltip. Periods switch in a segmented control on a soft-fill track, where the selected option is a card-colored chip. Each chart has a "Ver como tabla" disclosure, so the same data is available as a table.

### Note Editor
The title field is a card of its own at note-title size. The body is a card with a toolbar over the reading column. Headings, lists, quotes (soft fill, 8 px corners) and images (12 px corners) are styled for writing. They are not the public article style: the preview shows that.

### Public-Site Preview
A box that deliberately leaves the system: white whatever the theme, set in the public site's fonts and red, used by the note preview and the conflict dialog so a note looks as readers will see it. Its fonts and colors never leave that box.

### States
Loading uses soft-fill pulsing blocks shaped like the content. A failed load says what could not load and offers a row-level Reintentar. A picture that is gone becomes a soft-fill tile with a line icon rather than a broken image.

## Do's and Don'ts

### Do:
- **Do** use the theme's tokens for every color and add both the light and the dark value for anything new, measured to AA.
- **Do** keep controls at 8 px corners and cards and dialogs at 16 px.
- **Do** show a fall in a neutral pill with its minus sign.
- **Do** keep the unlayered keyboard outline rule at the end of the theme, outside any CSS layer, so a component's own reset cannot hide where the keyboard is.
- **Do** keep transitions at 150 to 200 ms and on state changes only, with the reduced-motion override in place.
- **Do** change the job on a phone, not only the width: urgent work first, an agenda rather than a month grid, filters behind one control.
- **Do** keep the note body at the 34rem reading column.
- **Do** give every chart its table and every loading, empty and failed state its own line.

### Don't:
- **Don't** color a fall red or an ordinary status amber; each functional hue keeps its meaning.
- **Don't** add a shadow to anything that sits on the page.
- **Don't** use the blue fill for a decorative element, or a second accent color.
- **Don't** use the public site's red, Playfair Display or Plus Jakarta Sans outside the preview box.
- **Don't** leave a native select arrow or date icon unstyled in a new control.
- **Don't** copy TailAdmin's code, images or brand; it is the reference for the category, not a source.
