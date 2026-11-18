# Rescue Hub dark-mode visual system (v1.0 major-testing refinement)

## Design direction

Inspired by the visual restraint of the Elektrokid studio website
(https://elektrokid.be/): **near-black backgrounds, quiet charcoal layers,
off-white text, a restrained single accent, and crisp, unobtrusive borders**.
This is an operational dispatch interface, not a copy of an editorial studio
website, so we keep rescue statuses and species colours intact.

The light-mode stylesheet, layout and colours are intentionally unchanged.
Only `:root[data-theme='dark']` tokens and dark-scoped overrides in
`packages/pc-rescues/src/routes/global.css` were modified.

## Dark palette

| Role | Token | Hex |
| --- | --- | --- |
| Base | `--rh-background` | `#0c0f12` |
| Main panels | `--rh-surface` | `#171b20` |
| Secondary surfaces | `--rh-surface-soft` | `#20252b` |
| Elevated/selected | `--rh-raised` | `#2b323a` |
| Inputs and navigation rail | `--rh-field` | `#12171b` |
| Foreground | `--rh-text` | `#f2f4f6` |
| Secondary text | `--rh-muted` | `#cbd3dc` |
| Quiet text | `--rh-subtle` | `#b7c3ce` |
| Borders | `--rh-border` | `#343e48` |
| Main buttons | `--rh-primary` | `#235b4b` |
| Clickable text | `--rh-accent` | `#93e4c6` |
| Focus | `--rh-focus` | `#ffd38a` |

**Important distinction:** `--rh-primary` is a *button fill*, not a
text-link colour. On dark panels, use `--rh-accent` for text links. This
fixes dark-green text becoming invisible on dark surfaces.

The palette is checked for 7:1 WCAG contrast on primary and secondary
text on dark surfaces and on normal primary button labels. Dynamic animal
legend colours and map markers remain unchanged.

## Scope and manual verification

- Header: active nav, profile menu, focus rings, small viewport
- Operations: dispatch queue, selected rescue, map details, intake, markers
- Administration: every section, filter chip, button, position/clinic forms,
  invitations, person dialogs, overlays, archive, rescue-history map
- Chats: species channel colours, direct channels, message bubbles,
  `@mentions`, search suggestions, send buttons, availability indicators
- Settings: mode buttons, scheduling forms, application version link
- Documentation: left navigation, selected state, hero, article cards, CTA
- Vet workspace: treatment controls, disabled states, danger actions
- MapLibre: zoom, attribution, scale and navigation controls

Use Settings to select **Dark** and repeat with **System** on a dark OS.
Use keyboard-only navigation for overlays and controls. Check at desktop
and narrow widths. The GitHub visual regression tests examine token
contrast and dark CSS invariants; they are not screenshot/browser tests.

No SST deployment, DynamoDB mutation or mobile Expo Mapbox change is needed
for this CSS-only adjustment. A later deployment is required for hosted
environments to show the new theme.
