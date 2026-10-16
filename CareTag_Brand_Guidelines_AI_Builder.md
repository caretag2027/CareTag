# CareTag Brand Guidelines & UI Implementation Specification

**Document purpose:** Binding visual and brand specification for an AI website/app builder.  
**Brand:** CareTag  
**Mascot:** Taggy  
**Tagline:** Safety Beyond Boundaries  
**Primary typeface:** Poppins  
**Reference:** The user-provided CareTag brand identity board showing the CareTag logo, Taggy robot mascot, palette, typography, logo variations, app icon, and a dark navy product hero.

---

## 0. Instructions for the AI Builder — Read First

Treat this document as the source of truth for CareTag's brand identity. Follow it consistently across every page, component, responsive breakpoint, illustration, and interaction.

1. **Use the exact brand colors and typography below.** Do not invent a competing palette or replace Poppins with a random font.
2. **Preserve the CareTag logo idea:** a heart-shaped location-pin symbol representing care, people, location awareness, and protection; a two-tone `CareTag` wordmark; and, where appropriate, the tagline `SAFETY BEYOND BOUNDARIES`.
3. **Treat Taggy as the official mascot.** Use the same core character design consistently. Do not create a different robot for every page.
4. **Do not use the full reference board as a logo image.** It is a visual reference board, not a standalone logo asset. Use supplied individual logo/mascot assets if available. If only the board is available, keep it as a reference and ask for/export separate production assets rather than cropping a blurry logo out of the board for production use.
5. **Keep the product usable and accessible.** The brand must support caregivers, children, and older adults. Prefer clarity, calm language, readable text, clear status labels, and simple navigation over decorative effects.
6. **Brand work must not break product functionality.** Before changing an existing application, inspect the current code and preserve its working routes, data flow, calculations, map interactions, simulation, alerts, and backend/API behavior. Make visual changes separately from business logic unless explicitly instructed otherwise.
7. **Do not invent product capabilities.** CareTag's documented prototype uses GPS trajectory data and simulated tracking. Do not imply that physical GPS hardware, live tracking, emergency dispatch, multi-user authentication, mobile push alerts, or a production backend is active unless it is demonstrably implemented in the current codebase.
8. **Do not present an anomaly score as a probability of harm.** Use wording such as `Routine deviation`, `Anomaly flagged`, or `Review this alert`. Avoid claims such as `Danger detected`, `Guaranteed safety`, or `100% protected`.
9. **Keep the visual style polished and restrained.** Avoid random gradients, excessive glow, giant headings, oversized cards, emoji replacing the icon system, dense paragraphs inside cards, and unnecessary animation.
10. At the end of implementation, check every item in the **Acceptance Checklist** in this document and report any requirements that could not be met.

If source assets or an existing codebase conflict with this guide, do not silently invent a new identity. Prefer the exact reference palette and defined design tokens, preserve existing functionality, and clearly identify any missing asset or implementation dependency.

---

## 1. Brand Foundation

### 1.1 Brand idea

CareTag is a context-aware safety-monitoring concept that combines location awareness, learned movement routines, geofencing, and caregiver-visible alerts. The brand should communicate:

- **Care:** a human, reassuring experience.
- **Trust:** considered use of location and alert information.
- **Clarity:** understandable maps, scores, and next steps.
- **Intelligence:** awareness of routine and context, not just a map pin.
- **Dependability:** calm, consistent design rather than alarmist visuals.

### 1.2 Brand personality

The identity should feel **friendly, intelligent, reassuring, modern, and dependable**. It should not feel childish, clinical, surveillance-heavy, militaristic, or like an emergency-response service.

### 1.3 Audience

Design for caregivers and family members, while remaining approachable for both children and older adults. Keep controls discoverable and large enough to use comfortably. Avoid relying on color alone to convey a status.

### 1.4 Core tagline and product messaging

**Official tagline:** `Safety Beyond Boundaries`  
**Optional marketing headline from the concept board:** `Keep Your Loved Ones Safer`  
**Product description:** `Context-aware safety monitoring for children and elderly individuals.`

Use the tagline as a brand line, not as a claim that the current prototype guarantees safety. Product headlines must accurately reflect the features available in the current build.

---

## 2. Official Brand Color Palette

Use these exact hex values. The names and primary roles follow the provided brand board.

| Token | Hex | Role | Recommended use |
|---|---|---|---|
| `caretag-navy` | `#0B2D5B` | Primary | Primary brand text, headings, navigation, dark panels, strong outlines, trust and reliability |
| `caretag-blue` | `#2563EB` | Secondary | Primary action buttons, links, active navigation, selected controls, technology accents |
| `caretag-teal` | `#14B8A6` | Accent | Secondary actions, highlights, progress indicators, active map details, brand accents |
| `caretag-mint` | `#7DD3C7` | Light accent | Soft accent surfaces, supportive illustrations, subtle chips, decorative details |
| `caretag-sky` | `#E0F2FE` | Background | Soft page backgrounds, gentle section panels, low-emphasis visual grouping |
| `caretag-lavender` | `#A78BFA` | Highlight | Occasional innovation/insight accents, selected secondary data visuals, gentle emphasis |
| `caretag-surface` | `#F8FAFC` | Surface | Main light surfaces, cards, sheets, panels, and clean page backgrounds |

### 2.1 Color distribution

Use the palette with restraint. Suggested starting proportions for a typical light page:

- 55–70% `#F8FAFC` and white surfaces.
- 15–25% `#E0F2FE` and other very light neutral surfaces.
- 8–15% `#0B2D5B` for text, navigation, and strong structure.
- 3–8% `#2563EB` for primary actions and interaction states.
- 2–5% combined teal, mint, and lavender for accents.

These are visual guidelines, not hard mathematical limits. The page must remain calm and legible. Do not give every card a different bright color.

### 2.2 Color and accessibility rules

- Use `#0B2D5B` for text on white, `#F8FAFC`, `#E0F2FE`, or `#7DD3C7` backgrounds.
- White text is preferred on the primary navy `#0B2D5B` and blue `#2563EB` when contrast has been verified.
- Do **not** use small white text on teal `#14B8A6`, mint `#7DD3C7`, sky `#E0F2FE`, or lavender `#A78BFA` by default. Use navy text on these surfaces and verify contrast.
- Teal is an accent, not the default color for body copy or long links.
- Never use color as the only status indicator. Pair color with text and, where appropriate, an icon.
- Check contrast for actual font size/weight. Meet WCAG AA where possible: 4.5:1 for normal text and 3:1 for large text and meaningful UI graphics.
- Do not use lavender for critical safety alerts. It is an occasional highlight color only.

### 2.3 Semantic status colors

Status colors are functional UI colors, not replacements for the official brand palette.

| State | Background | Text/icon | Usage |
|---|---|---|---|
| Success / acknowledged | `#DCFCE7` | `#166534` | Acknowledged action or successful completion; do not imply guaranteed physical safety |
| Informational | `#DBEAFE` | `#1D4ED8` | Neutral updates and useful guidance |
| Attention / warning | `#FEF3C7` | `#92400E` | Review recommended; use descriptive text |
| Anomaly / urgent review | `#FEE2E2` | `#991B1B` | Anomaly flagged or geofence breach; label the trigger clearly |
| Neutral / unavailable | `#F1F5F9` | `#334155` | Empty, inactive, offline, or unavailable states |

Do not label a red anomaly state as proof that the monitored person is in danger. Prefer `Anomaly flagged`, `Geofence breach`, `Review needed`, or the specific event type.

### 2.4 Suggested dark-mode support tokens

The reference board uses a dark navy product hero. If a dark screen or dark mode is required, extend the official palette without changing the light palette above:

| Token | Hex | Role |
|---|---|---|
| `caretag-dark-bg` | `#061A33` | Dark page background |
| `caretag-dark-surface` | `#0B2D5B` | Dark card/panel surface |
| `caretag-dark-raised` | `#123B70` | Raised panel, hover/selected surface |
| `caretag-dark-border` | `#294B72` | Visible separators and outlines |
| `caretag-dark-text` | `#F8FAFC` | Primary text on dark surfaces |
| `caretag-dark-muted` | `#C4D2E3` | Secondary text on dark surfaces |

These are supplemental implementation tokens derived for dark UI; the seven colors in Section 2 remain the official core palette. Check contrast rather than applying dark-mode colors blindly.

---

## 3. CSS Design Tokens

Define these once in the project-level design system and reuse them across the application. Do not scatter unrelated hex values throughout components.

```css
:root {
  /* Official brand palette */
  --ct-navy: #0B2D5B;
  --ct-blue: #2563EB;
  --ct-teal: #14B8A6;
  --ct-mint: #7DD3C7;
  --ct-sky: #E0F2FE;
  --ct-lavender: #A78BFA;
  --ct-surface: #F8FAFC;

  /* Text and neutrals */
  --ct-text: #0B2D5B;
  --ct-text-secondary: #475569;
  --ct-text-muted: #64748B;
  --ct-border: #D7E2EF;
  --ct-white: #FFFFFF;
  --ct-neutral-soft: #F1F5F9;

  /* Semantic status */
  --ct-success-bg: #DCFCE7;
  --ct-success-text: #166534;
  --ct-info-bg: #DBEAFE;
  --ct-info-text: #1D4ED8;
  --ct-warning-bg: #FEF3C7;
  --ct-warning-text: #92400E;
  --ct-danger-bg: #FEE2E2;
  --ct-danger-text: #991B1B;

  /* Layout and shape */
  --ct-radius-sm: 8px;
  --ct-radius-md: 12px;
  --ct-radius-lg: 18px;
  --ct-radius-xl: 24px;
  --ct-pill: 999px;
  --ct-content-max: 1200px;
  --ct-page-gutter: 24px;

  /* Motion */
  --ct-motion-fast: 140ms;
  --ct-motion-standard: 220ms;
  --ct-motion-slow: 320ms;
}
```

Implement dark-mode tokens separately if dark mode is actually part of the product. Avoid forcing a dark dashboard simply because the marketing concept contains a dark hero.

---

## 4. Logo System

### 4.1 Main logo concept

The CareTag logo contains two parts:

1. **Symbol:** a compact, rounded heart/location-pin concept representing care, the relationship between people, location awareness, and protection. Keep the negative-space heart and pin meaning legible.
2. **Wordmark:** `CareTag`, with `Care` in navy and `Tag` in teal. Use a rounded, bold, modern sans-serif style consistent with Poppins or a carefully matched custom wordmark.

**Official tagline:** `SAFETY BEYOND BOUNDARIES`, in uppercase with generous letter spacing, where a tagline lockup is needed.

### 4.2 Required logo variants

Prepare or use distinct exported assets for:

- **Primary horizontal logo:** symbol + two-tone `CareTag` wordmark, tagline optional when there is enough space.
- **Stacked logo:** symbol above wordmark, for centered layouts and brand introductions.
- **Symbol-only mark:** for favicon, compact app navigation, avatar, and small UI locations.
- **Dark-background logo:** simplified high-contrast symbol and white/teal wordmark for navy surfaces.
- **Monochrome mark:** single-color navy or white version for constrained contexts.

Do not simulate these by cropping sections of the reference board. Use clean vector assets (preferably SVG) or high-resolution transparent PNG exports.

### 4.3 Clear space and minimum size

- Maintain clear space around the logo of at least the diameter of the symbol's smallest circular element.
- Do not crowd the logo against cards, page edges, or other marks.
- Use symbol-only assets in tiny UI slots; do not force the full wordmark into a favicon.
- As a starting point, avoid rendering the full wordmark below 110 px wide or the tagline below 220 px wide. Verify the real exported asset for legibility and adjust if necessary.
- Keep proportions intact. Never stretch, skew, rotate, outline, or apply arbitrary shadows to the logo.

### 4.4 Logo color and effects

- Primary logo: navy `#0B2D5B` + teal `#14B8A6`, with blue `#2563EB` as an optional controlled accent.
- A restrained blue-to-teal gradient may be used inside the symbol only if the official exported logo includes it. The flat-color version must remain usable.
- Do not apply a gradient to every heading, every button, or every card.
- Do not add a large glow, glass effect, bevel, or 3D extrusion to the logo.
- Never alter the wordmark spelling or casing: `CareTag`.
- Never alter the official tagline wording: `SAFETY BEYOND BOUNDARIES`.

---

## 5. Official Mascot: Taggy

### 5.1 Character concept

**Name:** Taggy  
**Role:** CareTag's friendly safety companion  
**Core purpose:** Make the product feel approachable and help explain interface states without taking over the product UI.

Taggy is a small, rounded, friendly robot with:

- A smooth white/off-white body.
- A deep navy digital face panel.
- Simple, expressive blue/cyan eyes and a small friendly mouth.
- A location-pin antenna on top of its head.
- Blue and teal details that match the CareTag palette.
- A small CareTag heart/location symbol or shield-inspired emblem on its chest.
- Rounded, simple limbs and a supportive posture.

Taggy should have premium 3D character-rendering options for marketing imagery, but a simpler flat/line illustration version should also be available for the product UI. The two styles must depict the same character.

### 5.2 Taggy's personality

- Friendly, calm, reassuring, and quietly capable.
- Helpful rather than intrusive.
- Protective without being frightening.
- Intelligent without looking cold or overly technical.
- Inclusive: appealing to a wide age range, not only small children.

### 5.3 Mascot states and approved uses

Use the same base design and vary only the pose/expression/accessory when useful.

| State | Visual direction | Appropriate use |
|---|---|---|
| Welcome | Small wave, warm smile | Onboarding, welcome panel |
| Guidance | Looking at a map or holding a small map card | Explaining geofences and navigation concepts |
| Monitoring | Calm, attentive expression | Monitoring overview and simulation introduction |
| Information | Pointing to a tip or status panel | Tooltips, setup help, educational hints |
| Alert explanation | Serious but calm expression, pointing to alert details | Explaining what an alert means and the next step |
| Acknowledged | Gentle nod or reassuring expression | Confirmation after acknowledging an alert |
| Empty state | Friendly wave with simple visual cue | No geofences or no alert history yet |
| Offline/demo | Holding a small `Demo` or offline indicator card | Make the current operating mode explicit |

### 5.4 Mascot restrictions

- Do not use Taggy's smile as the only indication that a system is functioning correctly.
- Do not place Taggy in front of important data, maps, or urgent status text.
- Do not make the mascot look frightened, aggressive, armed, or like a police/surveillance robot.
- Do not use the mascot to trivialize a serious alert. A real anomaly should be explained in clear text with an appropriate status treatment.
- Avoid giving every screen a large 3D mascot. Use the mascot selectively; keep operational screens data-first.
- Do not alter Taggy's essential shape, pin antenna, dark face panel, or white/blue/teal identity between assets.
- Maintain the same face design and body proportions across all outputs. When possible, create a reference sheet with front, three-quarter, side, and simplified UI versions before generating multiple poses.

### 5.5 Mascot asset package to create

Create separate transparent-background assets, not one composite board:

1. `taggy-neutral.png` — neutral friendly standing pose.
2. `taggy-wave.png` — welcome pose.
3. `taggy-guide.png` — guide/map pose.
4. `taggy-alert-info.png` — calm alert-explanation pose.
5. `taggy-success.png` — acknowledged/completed pose.
6. `taggy-offline-demo.png` — demo/offline explanation pose.
7. `taggy-flat.svg` or transparent PNG — simplified small-size UI illustration.
8. `taggy-reference-sheet.png` — approved model sheet for design consistency.

These are asset deliverables to make; do not claim they already exist unless they are present in the codebase.

---

## 6. Typography

### 6.1 Typeface

**Primary typeface: Poppins.** Use Poppins consistently across marketing and product UI. Load it locally or through the project's approved font provider, depending on current architecture and licensing setup. Provide a sensible fallback stack.

```css
font-family: "Poppins", Inter, ui-sans-serif, system-ui, -apple-system,
  BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### 6.2 Font weight usage

| Weight | Usage |
|---|---|
| 400 Regular | Body text, supporting descriptions, helper text |
| 500 Medium | Labels, navigation, secondary buttons, field values |
| 600 Semibold | Card headings, section titles, buttons, active navigation |
| 700 Bold | Main page titles, key metrics, short hero headlines |

Avoid using Poppins Bold for every element; strong weight contrast creates hierarchy.

### 6.3 Type scale

Use this responsive scale as a starting point. Keep dashboard text compact enough to leave room for maps and telemetry.

| Token | Desktop size | Weight | Use |
|---|---:|---:|---|
| `display` | 48–56 px | 700 | Marketing hero only; use sparingly |
| `h1` | 36–40 px | 700 | Page-level marketing headline or primary page title |
| `h2` | 28–32 px | 600–700 | Major sections |
| `h3` | 20–24 px | 600 | Cards or sub-sections |
| `h4` | 16–18 px | 600 | Compact panels and dialogs |
| `body-lg` | 16–18 px | 400 | Introductory copy |
| `body` | 14–16 px | 400 | Default product text |
| `small` | 12–14 px | 400–500 | Metadata and helper labels; avoid going smaller where possible |
| `micro` | 11–12 px | 500 | Very limited use for non-critical metadata only |

On small screens, reduce display/heading sizes and preserve readable body text. Never use tiny text for alert details, critical status, chart labels, or form controls.

### 6.4 Typography rules

- Use sentence case for UI labels and buttons.
- Reserve all caps and letter spacing for the official tagline or occasional short overlines.
- Keep paragraphs short, typically 2–4 lines in a card.
- Avoid long blocks of centered body copy.
- Use tabular numerals for changing metrics and anomaly scores when supported.
- Do not use multiple unrelated font families for decorative contrast.

---

## 7. Layout, Spacing, and Shape Language

### 7.1 Layout principles

- Use a clean grid, consistent alignment, and deliberate whitespace.
- Prefer a clear page structure over a card for every individual field.
- Use a centered max-width of about 1200 px for marketing content, with responsive side gutters.
- For the operational dashboard, prioritize the map and telemetry. Do not allow branding elements to crowd the tracking surface.
- Align card titles, icons, status indicators, and actions consistently.
- Use a balanced hierarchy: page title → page purpose → main content → secondary details.

### 7.2 Spacing scale

Use a consistent 4 px base spacing system:

`4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px`.

Typical recommendations:

- 8–12 px within compact controls.
- 16 px within ordinary cards and forms.
- 20–24 px for standard card padding.
- 24–32 px between related sections.
- 40–64 px between major marketing sections.

Do not use inconsistent arbitrary margins or pad every element excessively.

### 7.3 Corners, borders, and shadows

- Small controls: 8 px radius.
- Inputs and compact cards: 10–12 px radius.
- Main cards: 16–18 px radius.
- Hero panels and large feature sections: up to 24 px radius.
- Pills: fully rounded, only for compact tags/chips.
- Use light neutral borders such as `#D7E2EF` and soft shadows sparingly.
- A card should still be distinguishable without a large shadow.
- Avoid nested card-within-card designs when a divider or spacing can establish hierarchy.

---

## 8. Buttons, Inputs, and Common Components

### 8.1 Primary button

- Background: `#2563EB`.
- Text: white, with contrast verified.
- Border: none or a subtle matching border.
- Radius: 10–12 px.
- Height: generally 44–48 px for prominent actions; compact controls must still be comfortable to click/tap.
- Hover: slightly darker blue; pressed: darker still; disabled: muted background and clear disabled state.
- Focus: visible keyboard focus ring in blue/navy with sufficient separation from the control.
- Wording: use action verbs such as `Start simulation`, `Save geofence`, `Review alert`, `View details`.

### 8.2 Secondary button

- Background: white or `#E0F2FE`.
- Text: `#0B2D5B`.
- Border: `#D7E2EF` or a suitable navy/blue outline.
- Use for supporting actions such as `Cancel`, `View history`, or `Edit zone`.

### 8.3 Teal accent button

- Background: `#14B8A6`.
- Text: `#0B2D5B`, not small white text by default.
- Reserve for a secondary or special positive action; do not make every button teal.

### 8.4 Forms and inputs

- Inputs should use white surfaces, navy text, muted but readable placeholder text, and a visible neutral border.
- Labels must remain visible after the user types; do not rely on placeholders as labels.
- Validation messages should identify the problem and how to correct it.
- Show disabled, loading, success, and error states clearly.
- Do not use red borders before the user has interacted unless an error is genuinely present.

### 8.5 Cards and panels

- Default surface: white or `#F8FAFC`.
- Optional low-emphasis panel: `#E0F2FE`.
- Border: subtle neutral border.
- Use navy titles and slate secondary text.
- Use teal/blue to highlight one or two key details rather than decorate every edge.
- Cards should answer one clear question or group related information.

### 8.6 Chips and badges

- Use chips for compact state labels such as `Demo mode`, `Anomaly flagged`, `Acknowledged`, or `Offline`.
- Pair status text with an icon when appropriate.
- Use neutral gray for ordinary metadata; use color for meaningful states only.
- Never show every common attribute as a brightly colored pill.

### 8.7 Navigation

- Use navy for primary navigation text and structure.
- Use blue for the active item or active indicator.
- Keep labels straightforward: `Overview`, `Geofences`, `Simulation`, `Alerts`, `Settings` if those sections exist in the implementation.
- Do not invent navigation routes or dead links. Preserve the current app's real routes and capabilities.

---

## 9. CareTag Product UI Guidance

The branding must support the real product concept and current prototype constraints.

### 9.1 Dashboard hierarchy

For the caregiver dashboard, prioritize in this order:

1. Current operating mode and system status.
2. Main map and monitored/simulated position.
3. Current behavioral deviation score and its meaning.
4. Geofence status and nearest zone where implemented.
5. Active alerts and recent alert history.
6. Secondary actions and settings.

Do not let a large hero illustration or marketing message reduce the map's useful area.

### 9.2 Map and geofence styling

- Keep the underlying map as visually neutral as practical.
- Use the brand blue for selected routes, active outlines, or focus states.
- Use teal sparingly to highlight a current or selected point where contrast remains clear.
- Use navy for high-contrast labels and key text.
- Geofence shapes need clear outlines and distinguishable fills. Use color plus labels/patterns where necessary rather than relying on color alone.
- Show the monitored/simulated point distinctly from zone markers.
- Make selected, hovered, and breach states visually distinct.
- Preserve map pan, zoom, drawing/editing, marker updates, and deletion behavior during any UI redesign.

### 9.3 Score presentation

- Display scores as values such as `0.78` or `78/100` only if the existing application consistently uses that format. Do not switch formats inconsistently.
- Always explain the score in plain language: e.g. `Higher scores indicate greater deviation from the learned routine.`
- Do not call the score a danger probability, risk percentage, or chance of harm.
- The threshold rule in the documented prototype is a score greater than `0.6`. Do not change the threshold, formula, or model behavior as part of branding work.
- When an alert is triggered, show the cause, relevant location/time context, and a clear next step if that information is available.

### 9.4 Alert language

Use calm, specific language. Examples:

- `Anomaly flagged — this movement differs from the learned routine.`
- `Geofence breach — the current position is outside the configured zone.`
- `Review alert` as the primary action.
- `Alert acknowledged` after successful dismissal/acknowledgement.
- `Demo mode — positions are simulated.` when the source is synthetic.

Avoid vague or alarmist text such as `Something terrible happened`, `Person in danger`, or `Emergency detected` unless a separate, verified feature truly supports that statement.

### 9.5 Demo, offline, and connection status

- Make `Demo mode` or `Simulated GPS` obvious whenever positions come from the simulator or prerecorded data.
- Do not imply a live physical tracking device is connected when it is not.
- If the app is offline, distinguish between local features that continue working and features that need a connection (such as remote map tiles or remote services).
- Do not show fake live telemetry, fake battery data, or fake notifications as real. In simulation mode, explicitly label it as simulated.

### 9.6 Empty and error states

- Use short messages with a clear next action.
- Empty geofence state: explain how to add a zone.
- Empty alert state: state that no alerts are currently recorded; do not claim that everything is safe.
- Loading state: identify what is loading and use a restrained spinner/skeleton.
- Service unavailable: explain whether the user can continue in standalone/demo mode, if that is supported.
- Avoid blank screens and unexplained error codes.

---

## 10. Website and Marketing Landing Page

Use the reference board's contrast between a bright identity showcase and a dark navy hero as inspiration, not as a reason to force every page into a single layout.

### 10.1 Suggested page structure

1. **Navigation:** CareTag logo, concise links for the actual available sections, and one clear CTA.
2. **Hero:** navy/dark blue base or clean light base; short headline; one supporting sentence; one primary action; Taggy illustration used with restraint.
3. **How it works:** show the simple sequence: learn routine → compare movement → notify caregiver.
4. **Core capabilities:** routine-aware monitoring, map/geofence management, anomaly scoring, and simulation/demo where relevant.
5. **Dashboard preview:** actual project screenshots when available, not AI-generated screenshots represented as real product UI.
6. **Trust and transparency:** explain what the current prototype does, what uses simulated data, and what remains planned.
7. **Footer:** logo, tagline, and only valid links/legal pages.

### 10.2 Marketing layout rules

- Hero headline should be clear, short, and responsive. Avoid overly long headlines that wrap into many lines.
- Use `#0B2D5B` as the anchor color for a dark hero, with `#2563EB` and `#14B8A6` as controlled accents.
- Use a real exported Taggy asset with transparent background when available.
- A blue/teal gradient is acceptable in the logo, limited illustration accents, or a major hero backdrop. Do not turn every card, button, and heading into a gradient.
- Use actual app captures for screenshots. Never suggest that a conceptual brand mockup is a functioning product feature.
- Avoid unsupported claims about accuracy, emergencies, live tracking, medical outcomes, or guaranteed safety.

---

## 11. Icons, Illustrations, Photography, and Data Visuals

### 11.1 Icons

- Prefer one consistent outline icon family, such as Lucide, if it is already available in the project.
- Use consistent stroke weight and a 20–24 px standard size for ordinary controls.
- Use navy for standard icons, blue for active icons, teal for select accents, and semantic colors for statuses.
- Use familiar icons for location, clock/time, route, shield, alert, settings, history, and caregiver/help actions.
- Do not mix unrelated outline, filled, emoji, and 3D icon styles in the same interface.

### 11.2 Illustrations

- Use simple rounded geometry and soft blue/teal accents.
- Keep illustrations visually secondary to real product information.
- Use Taggy as the recurring character; do not introduce extra mascot characters unless requested.
- Keep backgrounds transparent or use clean light/navy panels as appropriate.

### 11.3 Charts and telemetry

- Use navy for primary series, blue for the main comparison/selection, and teal for secondary series.
- Lavender may be used for an additional non-critical series, but never rely on it for dangerous/urgent states.
- Include labels, legends, units, and meaningful axes.
- Use semantic red for anomaly or geofence-breach states and pair it with text.
- Avoid ornamental charts or fake statistics. Every metric must come from the actual product data or be explicitly labelled as a sample/demo value.

---

## 12. Motion and Interaction

- Use restrained transitions for hover, opening panels, changing tabs, and displaying alerts.
- Typical durations: 140–220 ms; use longer motion only for meaningful transitions.
- Favor opacity and small positional shifts. Avoid excessive bounce, pulsing, spinning, parallax, or continuous mascot animation.
- Respect `prefers-reduced-motion`.
- Motion must not delay access to alerts, controls, or current location information.
- Loading animations must reflect a real loading state. Do not run indefinite progress indicators without an explanation.
- Alert banners should appear clearly but should not flash or animate in a way that causes distraction or distress.

---

## 13. Responsive Behavior

### Desktop

- Use available width for map + a clear telemetry/management panel.
- Keep consistent top navigation and align panel edges.
- Do not let the sidebar obscure key map controls.

### Tablet

- Allow side panels to collapse or become drawers.
- Keep current location, score, and alert access prominent.
- Preserve map interaction and geofence drawing affordances.

### Mobile

- Stack content in a logical order: status → map → key telemetry → alerts → secondary details.
- Use full-width action buttons where useful and touch targets around 44 × 44 px or larger.
- Avoid horizontal overflow, tiny map controls, and panels that cover all of the map.
- Use the symbol-only logo in constrained navigation spaces.
- Taggy should not push the main task below the fold.

All screen sizes must preserve functional workflows; responsive changes are not permission to hide critical status or alert information.

---

## 14. Accessibility and Trust Requirements

- Target WCAG AA color contrast for text and controls.
- Provide visible keyboard focus and complete keyboard access to interactive elements.
- Use semantic headings, buttons, links, labels, and accessible names.
- Give meaningful alt text to informative images; decorative Taggy art should use empty alt text when appropriate.
- Pair icons with labels when the icon may be ambiguous.
- Never rely on color alone for anomaly, breach, online/offline, or acknowledged states.
- Avoid rapid flashing, aggressive motion, tiny fonts, and unnecessarily dense text.
- Make the origin of data clear: live, prerecorded, simulated, or unavailable.
- Location information is sensitive. Do not expose personal coordinates in public marketing pages, logs, analytics, or examples unless intentionally provided and authorized. Do not add tracking scripts or collect new personal data as part of a branding change.
- Do not claim encryption, authentication, or privacy controls exist unless verified in the implementation.

---

## 15. Copywriting and Naming Rules

### Approved brand names

- Product: `CareTag`
- Mascot: `Taggy`
- Tagline: `Safety Beyond Boundaries`

Do not alternate between `Care Tag`, `Caretag`, `Care-Tag`, or other product spellings in UI copy.

### Tone of voice

- Clear and human.
- Reassuring but not overconfident.
- Helpful and non-judgmental.
- Specific about what happened and what the caregiver can do next.
- Avoid fear-based language and exaggerated guarantees.

### Preferred terminology

- `Behavioral deviation` or `Routine deviation` for the model's output.
- `Anomaly flagged` when the configured threshold is exceeded.
- `Geofence breach` for the separate boundary rule.
- `Simulated GPS` or `Demo mode` when using generated/replayed data.
- `Acknowledged` for a reviewed alert.

Avoid using the word `safe` to state a certainty the system cannot guarantee. Use precise status descriptions such as `Inside configured zone` rather than simply `Safe`.

---

## 16. Technical Implementation Rules for the AI Builder

1. Inspect the existing project structure, component library, route structure, and CSS strategy before coding.
2. Establish the tokens in Section 3 as the central theme source. If the project uses Tailwind, map the same tokens into the existing theme/configuration rather than creating a second conflicting color system.
3. Create reusable components for buttons, form fields, cards, badges, navigation, alerts, empty states, and typography.
4. Use Poppins consistently. Avoid mixing per-page font definitions.
5. Keep product logic separate from visual styling. Do not alter the ML formula, anomaly threshold, data source, geofence geometry, persistence model, API contract, or simulation engine during a branding-only pass.
6. Do not replace functional map layers, controls, real telemetry, or current screenshots with decorative static imagery.
7. Use the correct logo variant for the background. Use the compact symbol where the full wordmark is too small.
8. Use the same official Taggy character reference across all mascot assets. Do not generate unrelated variants that drift from the established design.
9. Make every visible CTA functional. Remove or clearly mark planned features rather than creating dead buttons or invented routes.
10. Keep UI copy compact. Cards should have a clear title, concise explanation, and an action only when needed.
11. Check light and dark surfaces, mobile breakpoints, focus states, disabled states, loading states, and semantic alert states.
12. Verify no accidental low contrast, clipped text, horizontal overflow, or overlapping map controls.
13. Do not use the concept board as a production website screenshot or app screenshot. Use the board only as a design reference.
14. Summarize changed files and list anything left incomplete after implementation.

---

## 17. Do / Don't Summary

### Do

- Use `#0B2D5B`, `#2563EB`, `#14B8A6`, `#7DD3C7`, `#E0F2FE`, `#A78BFA`, and `#F8FAFC` consistently.
- Use Poppins and a clear typographic hierarchy.
- Keep the CareTag logo simple, recognizable, and correctly proportioned.
- Keep Taggy consistent, friendly, supportive, and secondary to important data.
- Use a clean light interface with navy structure; use dark navy hero/panels where appropriate.
- Label simulated data accurately.
- Pair safety-related colors with clear text and next steps.
- Preserve existing code behavior and accessibility.

### Don't

- Don't change the official color hex values.
- Don't use a random font or add a second visual identity.
- Don't crop the reference board to fake a logo file.
- Don't change the spelling of CareTag or Taggy.
- Don't make every surface a gradient or add unnecessary glassmorphism/glow.
- Don't use the mascot on every panel or let it obscure important information.
- Don't label an anomaly score as a probability of danger.
- Don't imply live hardware tracking, production-grade security, emergency response, or guaranteed safety unless verified.
- Don't change product logic as part of a visual-only task.
- Don't ship inaccessible contrast, tiny text, dead links, or nonfunctional buttons.

---

## 18. Acceptance Checklist

Before calling the implementation complete, verify each item:

- [ ] The main product name is written exactly as `CareTag`.
- [ ] `Safety Beyond Boundaries` is used exactly when the tagline is displayed.
- [ ] The seven official brand colors use the exact hex values in Section 2.
- [ ] Poppins is the primary typeface with a reasonable fallback stack.
- [ ] The main logo, dark logo, symbol-only mark, and monochrome option use consistent geometry and colors, where assets are available.
- [ ] Taggy consistently uses the rounded white body, navy face panel, pin antenna, and blue/teal brand details.
- [ ] Taggy is used selectively and does not obscure maps, scores, or alerts.
- [ ] Buttons, inputs, badges, cards, panels, and navigation follow the component rules above.
- [ ] Color contrast and keyboard focus are checked.
- [ ] Status indicators use text as well as color.
- [ ] Demo/simulated GPS is explicitly identified wherever relevant.
- [ ] Alert copy is clear and calm; anomaly scores are not presented as probabilities of harm.
- [ ] Existing routes, tracking simulation, geofence editing, alert handling, scoring behavior, APIs, and data persistence are not accidentally broken.
- [ ] Layout works on desktop, tablet, and mobile without clipping or horizontal overflow.
- [ ] No fake product screenshots, fake statistics, or unsupported capability claims have been added.
- [ ] Remaining gaps or unavailable brand assets are documented honestly.

**Final instruction:** Implement the brand as a coherent system, not as a one-page visual makeover. Consistency, clarity, accessibility, and preserving the real product behavior matter more than decorative effects.
