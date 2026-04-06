# Action Required: Landing Page Redesign

Manual steps requiring human action.

## Before Implementation

- [ ] **Review the i18n copy** — Read through the proposed zh-TW and en copy in `implementation-plan.md` Wave 1. Confirm the tone, phrasing, and medical disclaimers are appropriate for your audience and comply with Taiwan's medical device / health app regulations.
- [ ] **Confirm OG image strategy** — The spec adds OG meta tags without an `og:image` URL. Decide if you want to generate a 1200×630 social sharing image now or defer it.
- [ ] **Install `sharp` if generating PNG icons** — Wave 3 may need `npm install sharp` for SVG → PNG conversion. Confirm you're okay with this dependency, or plan to generate icons manually via Figma/design tool.

## During Implementation

- [ ] **Run `npm run lint && npm run typecheck`** after each wave completes to catch issues early.
- [ ] **Visually test on mobile** — Open the landing page on an actual phone after Wave 2. Check that all sections render, the sticky header doesn't obscure content, and touch targets are ≥48px.
- [ ] **Test dark mode** — Toggle dark mode and verify all new sections look correct.
- [ ] **Test both locales** — Switch between zh-TW and en via the Globe button. Verify all new sections display correctly in both languages.
- [ ] **Validate structured data** — After Wave 2, open the page source and paste the JSON-LD into [Google Rich Results Test](https://search.google.com/test/rich-results) to verify FAQPage and SoftwareApplication schemas are valid.
- [ ] **Check FAQ accordion** — Verify expand/collapse works on mobile. The shadcn Accordion should handle this, but touch behavior needs real-device testing.

## After Implementation

- [ ] **Generate OG image** — Create a 1200×630 social sharing image using the brand icon + tagline. Update `generateMetadata` with the `og:image` URL. Consider using the `og-image` skill for this.
- [ ] **Submit sitemap to Google Search Console** — After deploying, submit `https://your-domain.com/sitemap.xml` to Google Search Console for indexing.
- [ ] **Create Privacy Policy and Terms pages** — The footer links to Privacy Policy and Terms. These pages don't exist yet and should be created as real content pages.
- [ ] **Add real testimonials** — Once you have user feedback, replace the skipped testimonial section with real quotes, names, and photos.
- [ ] **Generate PNG icons for production** — Either run the `scripts/generate-icons.mjs` script (requires `sharp`) or export PNGs from the SVG favicon using a design tool like Figma or Illustrator.
- [ ] **Performance audit** — Run Lighthouse on the new landing page. The page should score ≥90 on Performance, Accessibility, Best Practices, and SEO.
- [ ] **Set up analytics** — Add event tracking for the "Sign Up" CTA clicks and FAQ item expansions to measure engagement.
