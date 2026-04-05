# Action Required: Chat Photo Attachment

Manual steps requiring human action.

## Before Implementation
- [ ] **Ensure dev database is running** - Migration will add `imageUrl` column to `chat_message` table

## After Implementation
- [ ] **Test on mobile device or emulator** - Verify the file input shows both camera and gallery options (cannot be tested in desktop browser alone)
- [ ] **Test with actual image** - Send a photo in chat and verify the AI responds with context about the image content
- [ ] **Test history persistence** - Reload the chat page and confirm the image appears in the conversation history
