# NextFi presentation architecture

The web presentation layer is intentionally split by responsibility so the landing site, PWA, and control panel can evolve without a growing global stylesheet.

## Style boundaries

- `tokens.css` — theme colors, spacing/radius primitives, layout dimensions, shadows, semantic gain/loss colors.
- `base.css` — reset, typography, buttons, fields, panels, tables, auth primitives, focus and accessibility behavior.
- `marketing.css` — public landing-page composition only.
- `product.css` — authenticated PWA shell, portfolio, ledger, market, insights, settings, charts, and ad placements.
- `admin.css` — control-panel-only layouts, CMS, user management, audit and monetization controls.
- `responsive.css` — shared breakpoint policy for all three surfaces.

`app/globals.css` is only the ordered entry point for these files.

## Rules for future UI work

1. Add reusable colors and dimensions to `tokens.css`; do not introduce page-specific hex colors unless the surface is intentionally fixed monochrome (for example, the black portfolio hero).
2. Put reusable controls in `base.css` and reusable React presentation helpers in `components/ui/`.
3. Keep navigation metadata in `config/navigation.ts`. Shell components render it; pages do not duplicate navigation lists.
4. Keep domain calculations and business rules outside React presentation components. Portfolio accounting remains in the core/domain layer and API/application services.
5. Use semantic gain/loss color only where financial meaning benefits from it. The rest of the product stays neutral black, white and gray.
6. Mobile behavior belongs in `responsive.css`; avoid adding scattered component-specific media queries.
7. Admin and customer authentication remain independent even if they share visual primitives.
8. Every interactive control must have a visible focus state and minimum touch-friendly sizing.

This structure lets NextFi add new pages or future themes without coupling public marketing, customer product UI, and administrative UI.
