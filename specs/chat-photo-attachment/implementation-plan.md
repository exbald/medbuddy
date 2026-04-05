# Implementation Plan: Chat Photo Attachment

## Overview
Add photo attachment to the MedBuddy chat. The AI SDK v5 `sendMessage` natively supports `files: FileUIPart[]`, and `convertToModelMessages()` converts file parts into vision-compatible image content. The default model (Gemini 2.5 Flash) already supports vision. The work is: schema migration, API validation + persistence, UI (photo button + preview + send), chat bubble rendering, and translations.

## Parallel Execution Strategy
Tasks are organized into waves. All tasks in a wave can run concurrently.
Each wave depends on the previous wave completing.

---

## Wave 1: Schema & Translations

**Goal:** Database migration and i18n strings ready for use by later waves.

### Tasks
- [ ] w1-schema: Add `imageUrl` column to `chatMessage` table `agents: [general]`
- [ ] w1-translations: Add chat photo i18n strings `agents: [general]`

### Technical Details

**w1-schema** — `src/lib/schema.ts`
Add nullable `imageUrl` column to `chatMessage` table:
```ts
imageUrl: text("image_url"), // after content column
```
Then generate and apply migration:
```bash
npm run db:generate
npm run db:migrate
```

**w1-translations** — `messages/en.json` and `messages/zh-TW.json`
Add to `"chat"` section:
```json
// en.json
"attachPhoto": "Attach photo",
"removePhoto": "Remove photo",
"invalidFileType": "Please select an image file",
"fileTooLarge": "Image must be under 10MB"

// zh-TW.json
"attachPhoto": "附加照片",
"removePhoto": "移除照片",
"invalidFileType": "請選擇圖片檔案",
"fileTooLarge": "圖片大小不能超過 10MB"
```

---

## Wave 2: API Routes

**Goal:** Backend accepts image parts, persists images, and returns them in history.
**Depends on:** Wave 1

### Tasks
- [ ] w2-chat-route: Update chat API validation and image persistence `agents: [general]`
- [ ] w2-history-route: Return `imageUrl` in chat history API `agents: [general]`

### Technical Details

**w2-chat-route** — `src/app/api/chat/route.ts`

1. Replace `messagePartSchema` with a discriminated union:
```ts
const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string().max(10000, "Message text too long"),
})

const filePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.string(),
  url: z.string().max(500_000), // data URLs can be large
  filename: z.string().optional(),
})

const messagePartSchema = z.union([textPartSchema, filePartSchema])
```

2. Add image extraction + upload logic before user message persistence:
```ts
import { upload } from "@/lib/storage"

function extractImageUrl(message: UIMessage): string | null {
  const filePart = message.parts.find(
    (p): p is { type: "file"; mediaType: string; url: string } => p.type === "file"
  )
  return filePart?.url ?? null
}
```

3. When persisting user message, if image is a data URL, convert to buffer and `upload()` via storage:
```ts
let imageUrl: string | null = null
const rawImageUrl = extractImageUrl(lastUserMessage)
if (rawImageUrl?.startsWith("data:")) {
  const [header, base64Data] = rawImageUrl.split(",")
  const mediaType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg"
  const ext = mediaType.split("/")[1] || "jpg"
  const buffer = Buffer.from(base64Data, "base64")
  const filename = `chat-${session.user.id}-${Date.now()}.${ext}`
  const result = await upload(buffer, filename, "chat-images", { maxSize: 10 * 1024 * 1024 })
  imageUrl = result.url
}
```

4. Include `imageUrl` in the DB insert. For image-only messages, store `""` as content.

**w2-history-route** — `src/app/api/chat/messages/route.ts`
Add `imageUrl: chatMessage.imageUrl` to the select fields.

---

## Wave 3: Frontend UI

**Goal:** Chat page has photo button, preview, send-with-files; chat bubbles render images.
**Depends on:** Wave 2

### Tasks
- [ ] w3-chat-bubble: Update ChatBubble to render image parts `agents: [general]`
- [ ] w3-chat-page: Add photo button, preview strip, and send-with-files to chat page `agents: [general]`

### Technical Details

**w3-chat-bubble** — `src/components/chat-bubble.tsx`

Change props from `content: string` to `parts`:
```ts
interface ChatBubbleProps {
  role: "user" | "assistant"
  parts: Array<{ type: string; text?: string; url?: string; mediaType?: string }>
  timestamp?: Date | null
  onReadAloud?: string | undefined
}
```

Render parts as either `<img>` (for file type) or text `<div>` (for text type). Derive text content internally for read-aloud.

Image rendering:
```tsx
<img src={part.url} alt="" className="max-w-full rounded-lg" style={{ maxHeight: "300px" }} />
```

**w3-chat-page** — `src/app/[locale]/(app)/chat/page.tsx`

New state and refs:
```ts
const [selectedImage, setSelectedImage] = useState<File | null>(null)
const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)
const fileInputRef = useRef<HTMLInputElement>(null)
```

Hidden file input (no `capture` attr — lets mobile show both camera AND gallery):
```html
<input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
```

Photo button in input bar (ImageIcon from lucide-react):
```tsx
<Button variant="ghost" size="icon" disabled={isLoading}
  onClick={() => fileInputRef.current?.click()}
  className="h-12 w-12 shrink-0" aria-label={t("attachPhoto")}>
  <ImageIcon className="h-5 w-5" />
</Button>
```

Image preview strip above input bar:
```tsx
{imagePreviewUrl && (
  <div className="border-t bg-muted/50 px-4 py-2">
    <div className="relative inline-block">
      <img src={imagePreviewUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
      <button onClick={handleRemoveImage} className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground">
        <X className="h-3 w-3" />
      </button>
    </div>
  </div>
)}
```

Updated `handleSend`: convert image to data URL via FileReader, call `sendMessage({ text, files })`.

Updated history loading: reconstruct file parts from `imageUrl` in loaded messages.

Updated send button: `disabled={isLoading || (!input.trim() && !selectedImage)}`.

Cleanup: revoke object URLs on unmount/clear.

---

## Wave 4: Verification

**Goal:** Ensure everything works end-to-end.
**Depends on:** Wave 3

### Tasks
- [ ] w4-verify: Run lint + typecheck, review integration `agents: [general]`

### Technical Details
```bash
npm run lint && npm run typecheck
```
Review: schema migration applied, photo button works, preview shows, send works with/without text, images render in bubbles, history reload shows images.
