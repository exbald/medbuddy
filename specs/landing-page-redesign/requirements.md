# Requirements: Landing Page Redesign

## Summary

Rewrite and expand the MedBuddy landing page with benefit-led copy, new sections (How It Works, Personas, FAQ, Final CTA), brand icon generation, and SEO foundations (meta tags, structured data, sitemap, robots.txt) — all within the existing teal/green shadcn/ui theme.

## Problem

The current landing page is a minimal hero + 4 feature cards + disclaimer. It lacks:

- Benefit-led, emotionally resonant copy for 3 distinct audiences (patients, caregivers, professionals)
- A "how it works" section to reduce perceived complexity
- Audience-persona sections for self-identification
- FAQ to handle objections and earn Google rich snippets
- Any SEO meta tags beyond basic title/description (no OG tags, no structured data, no sitemap, no robots.txt)
- Brand icons (favicon.ico, PWA icons are referenced in manifest but don't exist)
- A repeat CTA at the bottom of the page for scrollers

## Solution

Expand the single `page.tsx` landing page into a full marketing page with 9 sections, all i18n'd in zh-TW and en. Keep the existing visual theme (teal primary, shadcn/ui components, 18px+ fonts, 48px+ touch targets, dark mode support). Generate SVG-based brand icons and add SEO infrastructure.

## Acceptance Criteria

- [ ] Landing page has 9 sections: Sticky Header, Hero, How It Works, Features (6 cards), Built For You (personas), Trust & Safety, FAQ, Final CTA, Footer
- [ ] All copy is i18n'd in zh-TW (primary) and en via `messages/zh-TW.json` and `messages/en.json`
- [ ] Hero headline is benefit-led ("Never miss a dose again") not generic ("Your medication companion")
- [ ] How It Works shows 3 numbered steps with icons
- [ ] Features section expanded from 4 to 6 cards (added Drug Interactions + Health Summary)
- [ ] Personas section addresses all 3 target audiences (patients, caregivers, professionals)
- [ ] FAQ section has 5 questions with expand/collapse using shadcn Accordion
- [ ] Final CTA section repeats the primary conversion action at page bottom
- [ ] FAQ structured data (JSON-LD `FAQPage`) renders on the page
- [ ] SoftwareApplication structured data renders on the page
- [ ] Page-level `generateMetadata` exports OG title, description, image, and Twitter card tags
- [ ] `public/robots.txt` exists and allows all crawlers
- [ ] `src/app/sitemap.ts` exists with locale-aware URLs
- [ ] `public/favicon.svg` exists with Pill+Heart brand icon in teal (#0d9373)
- [ ] `public/icons/icon-192.png` and `public/icons/icon-512.png` exist
- [ ] `manifest.ts` icon paths reference the new generated icons
- [ ] Loading skeleton (`loading.tsx`) matches the new page structure
- [ ] `npm run lint` and `npm run typecheck` pass with zero errors
- [ ] All sections support dark mode via existing CSS variables
- [ ] Mobile-first responsive: single-column on mobile, grids expand on larger screens
- [ ] Semantic HTML: single `<h1>`, `<h2>` per section, `<header>`, `<main>`, `<section>`, `<footer>`

## Dependencies

- `lucide-react` (already installed) — for all section icons
- `next-intl` (already installed) — for i18n server translations
- shadcn/ui `Accordion` component (already in `src/components/ui/accordion.tsx`)
- shadcn/ui `Button` component (already in `src/components/ui/button.tsx`)
- Existing theme in `src/app/globals.css` — no changes to color variables
- Existing `Link` from `@/i18n/routing` — for locale-aware navigation

## Target Audiences (priority order)

1. **Elderly chronic care patients** — managing daily medications, worried about forgetting
2. **Family caregivers** — adult children monitoring a parent's adherence remotely
3. **Medical professionals** — doctors, nurses, pharmacists recommending tools to patients

## Primary Conversion Goal

Free registration via `/register` route.

## Copy Tone

- Warm, trustworthy, simple — like a caring family member
- No medical jargon, no buzzwords
- Short sentences, benefit-first structure
- Traditional Chinese (zh-TW) is the primary language; English is secondary
