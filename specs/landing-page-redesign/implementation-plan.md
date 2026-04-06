# Implementation Plan: Landing Page Redesign

## Overview

Rewrite the MedBuddy landing page from a minimal hero+features page into a full marketing page with 9 sections, expanded i18n copy, brand icon generation, and SEO infrastructure. All work stays within the existing teal/green shadcn/ui theme.

## Parallel Execution Strategy

Tasks are organized into 3 waves. All tasks in a wave can run concurrently. Each wave depends on the previous wave completing.

---

## Wave 1: Copy + i18n

**Goal:** Write all new landing page copy in both zh-TW and en, expanding the `landing` key in both message files.

### Tasks

- [x] `w1-zh-tw-copy`: Expand `messages/zh-TW.json` `landing` key with all new sections `agents: [general]`
- [x] `w1-en-copy`: Expand `messages/en.json` `landing` key with all new sections `agents: [general]`

### Technical Details

Both tasks modify the same JSON structure. The `landing` key currently has: `hero`, `features` (4 items), `trust`, `auth`. It needs to become:

```jsonc
{
  "landing": {
    "hero": {
      // REVISED — benefit-led headline
      "title": "再也不怕忘記吃藥", // was: "您的貼心用藥好夥伴"
      "subtitle": "拍照掃描處方箋、準時服藥提醒、家人安心掌握 — 管理藥物就這麼簡單",
      "cta": "免費註冊", // was: "立即開始"
      "secondaryCta": "了解怎麼用", // was: "了解更多"
    },
    "howItWorks": {
      "heading": "簡單三步驟",
      "steps": [
        { "title": "掃描處方箋", "description": "拍照上傳，AI 自動建立用藥清單" },
        { "title": "按時服藥", "description": "準時提醒您吃藥，一鍵確認已服用" },
        { "title": "家人安心", "description": "照護者即時查看服藥狀況，放心又省心" },
      ],
    },
    "features": {
      "heading": "全方位用藥管理",
      "scan": {
        "title": "處方箋掃描",
        "description": "拍照即可辨識藥物，AI 自動整理用藥資訊",
      },
      "reminders": {
        "title": "服藥提醒",
        "description": "準時提醒不漏吃，一鍵確認已服藥",
      },
      "chat": {
        "title": "AI 藥物問答",
        "description": "隨時詢問用藥問題，語音也能聊",
      },
      "caretaker": {
        "title": "照護者連結",
        "description": "家人即時掌握服藥狀況，安心又放心",
      },
      "interactions": {
        "title": "藥物交互作用",
        "description": "自動偵測藥物衝突，守護用藥安全",
      },
      "summary": {
        "title": "健康報告匯出",
        "description": "一鍵產生用藥報告，回診好幫手",
      },
    },
    "personas": {
      "heading": "為您而設計",
      "patient": {
        "title": "長期服藥的長輩",
        "description": "輕鬆管理每天吃藥，再也不怕忘記或吃錯",
      },
      "caregiver": {
        "title": "照顧家人的您",
        "description": "隨時掌握長輩服藥狀況，工作也能安心",
      },
      "professional": {
        "title": "醫療專業人員",
        "description": "推薦好用的工具，幫助患者規律服藥",
      },
    },
    "trust": {
      "heading": "安全可信賴",
      "ai": {
        "title": "AI 輔助，不取代醫師",
        "description": "MedBuddy 提供用藥提醒和資訊，但不提供醫療診斷或建議。請務必遵從您的醫師指示。",
      },
      "privacy": {
        "title": "您的資料安全加密",
        "description": "所有個人健康資料經過加密儲存，絕不分享給第三方。",
      },
      "access": {
        "title": "手機就能用，免安裝 App",
        "description": "打開瀏覽器即可使用，不需要下載或安裝任何應用程式。",
      },
      "disclaimer": "MedBuddy 是用藥提醒工具，非醫療器材。不提供診斷、治療或醫療建議。如有健康疑慮，請諮詢醫療專業人員。",
    },
    "faq": {
      "heading": "常見問題",
      "items": [
        {
          "question": "MedBuddy 可以取代醫師的建議嗎？",
          "answer": "不可以。MedBuddy 是用藥提醒和資訊工具，不會提供醫療診斷或建議。所有用藥決定請遵循您的醫師指示。",
        },
        {
          "question": "需要付費嗎？",
          "answer": "MedBuddy 目前完全免費使用。未來可能推出進階功能，但核心的用藥提醒、掃描和照護者連結將持續免費。",
        },
        {
          "question": "我的資料安全嗎？",
          "answer": "所有資料經過加密傳輸和儲存。我們不會將您的個人健康資訊分享給任何第三方。",
        },
        {
          "question": "照護者怎麼連結我的帳號？",
          "answer": "您可以在個人頁面產生專屬邀請碼，分享給家人。他們輸入邀請碼後，就能查看您的服藥狀況。您隨時可以取消連結。",
        },
        {
          "question": "不太會用手機也可以用嗎？",
          "answer": "可以！MedBuddy 專為長輩設計，字體大、按鈕大、操作簡單。也可以透過 Telegram 收到提醒，不用打開網頁就能確認服藥。",
        },
      ],
    },
    "finalCta": {
      "heading": "開始輕鬆管理您的用藥",
      "description": "免費註冊，幾分鐘即可上手",
      "cta": "免費註冊",
    },
    "footer": {
      "privacy": "隱私權政策",
      "terms": "使用條款",
      "madeIn": "用心打造於台灣",
    },
    "auth": {
      "signIn": "登入", // keep existing
    },
  },
}
```

The English version mirrors this structure exactly. File paths:

- `messages/zh-TW.json` — lines 40-67 are the current `landing` block
- `messages/en.json` — lines 40-67 are the current `landing` block

**Important**: Both tasks must produce the exact same JSON key structure so `page.tsx` can reference them uniformly.

---

## Wave 2: Page + SEO

**Goal:** Rewrite the landing page component with all new sections, add SEO metadata and structured data, create robots.txt and sitemap.

**Depends on:** Wave 1

### Tasks

- [x] `w2-landing-page`: Rewrite `src/app/[locale]/page.tsx` with all 9 sections using new i18n keys `agents: [general]`
- [x] `w2-loading-skeleton`: Update `src/app/[locale]/loading.tsx` to match new page structure `agents: [general]`
- [x] `w2-seo-meta`: Add `generateMetadata` export + JSON-LD structured data to the landing page `agents: [general]`
- [x] `w2-seo-files`: Create `public/robots.txt` and `src/app/sitemap.ts` `agents: [general]`

### Technical Details

#### w2-landing-page: Section-by-section spec

**File:** `src/app/[locale]/page.tsx` (full rewrite, currently 150 lines)

**Imports needed (add to existing):**

```tsx
import {
  ScanLine,
  BellRing,
  Users,
  ShieldAlert,
  FileText,
  User,
  HeartHandshake,
  Stethoscope,
  Lock,
  Smartphone,
  ChevronDown,
} from "lucide-react";
```

(Accordion and AccordionItem come from `@/components/ui/accordion`)

**Section 1 — Sticky Header:**

- Same as current but add `sticky top-0 z-50 bg-background/80 backdrop-blur-md` to `<header>`
- No other changes

**Section 2 — Hero:**

- Keep decorative background circles (lines 63-67)
- Keep Pill + Heart icon cluster (lines 70-78)
- Replace `t("hero.title")` / `t("hero.subtitle")` / `t("hero.cta")` with new keys
- Primary CTA: `<Link href="/register">{t("hero.cta")}</Link>` — same route, new copy
- Secondary CTA: `<a href="#how-it-works">{t("hero.secondaryCta")}</a>` — anchors to new section

**Section 3 — How It Works (NEW):**

```
id="how-it-works"
Layout: 3 steps in a row (desktop), stacked (mobile)
Each step: large Lucide icon in teal circle + step number + title + description
Icons: ScanLine, BellRing, Users
Background: bg-card (matches existing features section)
Max-width: max-w-lg mx-auto
```

**Section 4 — Features (expanded 4→6):**

```
6 cards in 2×3 grid (sm:grid-cols-2, max-w-lg → consider max-w-2xl for 3 cols on larger screens)
Same card markup as current (rounded-2xl border bg-background p-5 hover:shadow-md)
New entries:
  { key: "interactions", icon: ShieldAlert }
  { key: "summary", icon: FileText }
Add section heading: t("features.heading") centered above grid
```

**Section 5 — Built For You / Personas (NEW):**

```
3 cards in a row (desktop), stacked (mobile)
Background: bg-secondary/30 or bg-card
Each card: icon + persona title + description
Icons: User, HeartHandshake, Stethoscope
```

**Section 6 — Trust & Safety (expanded):**

```
3 trust pillars in a row (desktop), stacked (mobile)
Each pillar: icon + title + description
Icons: ShieldCheck, Lock, Smartphone
Disclaimer text below pillars (keep existing pattern)
```

**Section 7 — FAQ (NEW):**

```
Use shadcn Accordion component (already at src/components/ui/accordion.tsx)
Type: "single" collapsible
5 items from t("faq.items") array — map over with index
Each item: question as trigger, answer as content
Section heading: t("faq.heading")
```

**Section 8 — Final CTA (NEW):**

```
Centered layout, bg-secondary or bg-primary/5
Headline + description + primary CTA button (same as hero)
```

**Section 9 — Footer (expanded):**

```
Add links row: Privacy Policy, Terms (can be "#" for now)
Keep copyright line
Add "made in" line
```

**Wrapper:** Wrap all sections between header and footer in `<main>`.

#### w2-loading-skeleton

**File:** `src/app/[locale]/loading.tsx` (currently 27 lines)

Update skeleton to have placeholder blocks for each new section:

- Header (keep as-is)
- Hero (keep as-is)
- How It Works: 3 skeleton blocks in a row
- Features: 6 skeleton cards in grid
- Personas: 3 skeleton cards
- Trust: 3 skeleton blocks
- FAQ: 5 skeleton accordion items
- Final CTA: heading + button skeleton

#### w2-seo-meta

**Add to `src/app/[locale]/page.tsx`:**

1. `generateMetadata` async function export:

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing" });
  const isZhTW = locale === "zh-TW";
  return {
    title: isZhTW
      ? "MedBuddy 藥好友 — 智慧用藥提醒與管理"
      : "MedBuddy — Smart Medication Reminders & Management",
    description: t("hero.subtitle"),
    openGraph: {
      title: isZhTW
        ? "MedBuddy 藥好友 — 智慧用藥提醒與管理"
        : "MedBuddy — Smart Medication Reminders & Management",
      description: t("hero.subtitle"),
      type: "website",
      locale: isZhTW ? "zh_TW" : "en_US",
      siteName: "MedBuddy",
    },
    twitter: {
      card: "summary_large_image",
      title: isZhTW
        ? "MedBuddy 藥好友 — 智慧用藥提醒與管理"
        : "MedBuddy — Smart Medication Reminders & Management",
      description: t("hero.subtitle"),
    },
  };
}
```

2. JSON-LD structured data — rendered as a `<script>` tag in the page component:

```tsx
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "MedBuddy 藥好友",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" },
  description: t("hero.subtitle"),
};
```

Plus FAQ schema:

```tsx
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: t.raw("faq.items").map((item: { question: string; answer: string }) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};
```

Both rendered as:

```tsx
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
```

#### w2-seo-files

**File 1:** `public/robots.txt`

```
User-agent: *
Allow: /
Sitemap: https://medbuddy.app/sitemap.xml
```

(Use `NEXT_PUBLIC_APP_URL` env var for the sitemap URL if available, or hardcode placeholder)

**File 2:** `src/app/sitemap.ts`

```tsx
import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://medbuddy.app";
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/en`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/en/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/en/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
```

---

## Wave 3: Brand Icons

**Goal:** Create SVG favicon and PWA icon files, update manifest.

**Depends on:** Wave 2

### Tasks

- [x] `w3-favicon-svg`: Create `public/favicon.svg` with Pill+Heart brand icon `agents: [general]`
- [x] `w3-pwa-icons`: Generate PNG icon files and update manifest `agents: [general]`

### Technical Details

#### w3-favicon-svg

**File:** `public/favicon.svg`

Design specification:

- Viewbox: `0 0 512 512`
- Background: rounded rectangle, `rx="96"`, fill `#0d9373` (primary teal)
- Center: white Pill shape (capsule, tilted ~30deg)
- Top-right badge: small red/white heart circle
- Clean vector paths, no external dependencies

#### w3-pwa-icons

**Files to create:**

- `public/icons/icon-192.png` — 192×192 PNG
- `public/icons/icon-512.png` — 512×512 PNG
- `public/apple-touch-icon.png` — 180×180 PNG
- `public/favicon.ico` — 32×32 ICO

**Approach:** Since we can't rasterize SVG → PNG in a pure code environment, we'll:

1. Create the SVG source
2. Add a small Node.js script (`scripts/generate-icons.mjs`) that uses the `canvas` npm package (or `sharp`) to convert SVG → PNG
3. Alternatively, use the SVG directly as favicon (supported by all modern browsers) and create minimal PNGs

**Update `src/app/manifest.ts`:**

- Add `favicon.svg` entry
- Verify existing icon paths match new files
- Add `apple-touch-icon` entry if missing

**Also update root layout (`src/app/layout.tsx`):**

- Add `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />` in metadata `icons` field
- Add `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />` in metadata `icons` field

---

## Verification

After all waves complete, run:

```bash
npm run lint && npm run typecheck
```

Both must pass with zero errors.
