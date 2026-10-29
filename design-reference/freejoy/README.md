# Freejoy — Final Design Direction

Nine screen designs, each as editable SVG and PNG preview. SVG files are importable into Figma, although imported SVGs may need conversion into native auto-layout/component structures. No real brands or live freebies are represented.

## Screens
1. Home desktop — discovery, trust cues, categories, offers and email capture.
2. Catalogue desktop — search, filters, offer cards and pagination.
3. Offer detail desktop — offer terms, CTA, affiliate disclosure and instructions.
4. Alerts preferences desktop — explicit opt-in, categories and frequency.
5. Home mobile — thumb-friendly browse, offer cards and bottom navigation.
6. Catalogue mobile — horizontal chips, filters and grids.
7. Offer detail mobile — mobile-native details and disclosures.
8. Admin offers desktop — example editorial workflow.
9. Design system — tokens, typography, buttons, chips and trust cues.

## Key design decisions
- Primary CTA coral #F66A54. Deep forest ink #1F3630. Warm peach hero and mint trust panels.
- No forced visitor signup.
- Clearly distinguish actual free products, trials, delivery charges and affiliate promotions.
- Mobile 390px, desktop 1440px, responsive implementation expected.
- Some interface controls are illustrative and non-interactive mockups.

## Codebase mapping
Reuse Next.js App Router, FastAPI, PostgreSQL, Firebase for optional user identity, the admin permission model and generated API client in the existing boilerplate.
