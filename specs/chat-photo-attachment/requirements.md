# Requirements: Chat Photo Attachment

## Summary
Allow users to attach a photo from gallery or camera in the chat, so the AI can see and analyze the image. Images persist in chat history.

## Problem
Elderly medication users often need to ask about pill identification, prescription labels, or medication packaging. Currently the chat only supports text and voice — users cannot share photos for the AI to analyze.

## Solution
Add a photo button to the chat input bar. On mobile, tapping it shows the native camera/gallery picker. The image is sent to the AI model (which supports vision) alongside optional text. Images are persisted to storage and referenced in the DB so they appear in chat history on reload.

## Acceptance Criteria
- [ ] Photo button visible in chat input bar (between voice button and textarea)
- [ ] Tapping photo button on mobile shows both camera and gallery options
- [ ] Selected image shows as a preview above the input bar with a remove (X) button
- [ ] User can send image + text together, or image only
- [ ] AI model receives the image and responds with context about it
- [ ] Images render in chat bubbles (both after sending and on history reload)
- [ ] Images persist to storage (local filesystem or Vercel Blob via existing abstraction)
- [ ] Image URL saved in DB `chatMessage.imageUrl` column
- [ ] File validation: must be image/*, max 10MB
- [ ] Translations added for zh-TW and en
- [ ] No TypeScript or lint errors

## Dependencies
- Vercel AI SDK v5 `sendMessage` with `files` parameter (already available)
- `convertToModelMessages()` native file part handling (already available)
- Default model (Gemini 2.5 Flash) vision support (already available)
- `src/lib/storage.ts` upload abstraction (already available)
