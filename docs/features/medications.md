# Medications

MedBuddy lets users add medications manually or by scanning a prescription photo with AI vision. When a medication is added, the system concurrently generates a plain-language purpose description and checks for drug interactions against the user's existing medications. Interaction checking uses OpenFDA as the primary source with AI as a fallback.

## Architecture

### Manual Add

`POST /api/medications` accepts a medication with:
- `name` (required, max 200 chars)
- `nameLocal` (optional Chinese name)
- `dosage` (optional)
- `timing` (array of slots: `morning`, `afternoon`, `evening`, `bedtime` -- at least one required)

After inserting the medication row, the handler runs two operations concurrently via `Promise.all`:
1. **Purpose generation** -- AI generates a 2-3 sentence explanation in the user's locale, using simple language appropriate for elderly users.
2. **Interaction checking** -- Checks the new medication against all existing active medications.

The handler also auto-creates `reminder` rows for any timing slots the user does not already have configured, using default times (morning 08:00, afternoon 12:30, evening 18:00, bedtime 21:30).

### Prescription Scanning

`POST /api/medications/scan` accepts a prescription image via FormData (max 10 MB, must be `image/*`). The image is converted to a base64 data URL and sent to the vision model via `generateObject` with a structured schema. The AI extracts an array of medications, each with name, optional Chinese name, dosage, and frequency.

The scan endpoint only extracts medications -- it does not save them. The client is expected to present the results for review and then call `POST /api/medications` for each medication the user confirms.

### Drug Interaction Checking

The `checkInteractions` function in `src/lib/drugs.ts` uses a two-tier approach:

1. **OpenFDA** (`checkOpenFDA`): Queries the FDA drug label API with a 5-second timeout. If the label's `drug_interactions` text mentions any of the user's existing medications (case-insensitive match), it returns those as medium-severity interactions.
2. **AI fallback** (`checkWithAI`): If OpenFDA returns no results, the system asks the AI model to check for clinically significant interactions and therapeutic duplications. Severity levels are `high` (dangerous/contraindicated), `medium` (monitor closely), and `low` (minor). The AI is instructed to be conservative and not report uncertain interactions.

Discovered interactions are stored in the `interaction` table, linking `medAId` (new medication) and `medBId` (existing medication).

### Purpose Generation

`generateMedicationPurpose` asks the AI to explain what the medication is used for in 2-3 sentences, using plain language. It responds in Traditional Chinese or English based on the user's locale. The explanation always ends with a disclaimer to consult a doctor or pharmacist. If the AI call fails, a fallback string is returned.

### GET Endpoint

`GET /api/medications` returns all active medications for the user, ordered by creation date descending. Each medication includes an `interactionCount` computed via a UNION ALL subquery across both sides of the interaction table.

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/medications/route.ts` | POST: add medication; GET: list active medications |
| `src/app/api/medications/scan/route.ts` | POST: scan prescription image with AI vision |
| `src/lib/drugs.ts` | `checkInteractions` (OpenFDA + AI), `generateMedicationPurpose` |
| `src/lib/ai.ts` | OpenRouter model configuration (`defaultModel`, `visionModel`) |
| `src/lib/schema.ts` | `medication`, `interaction`, `reminder` tables |

## Configuration

| Environment Variable | Purpose |
|---------------------|---------|
| `OPENROUTER_API_KEY` | API key for OpenRouter (AI calls) |
| `OPENROUTER_MODEL` | Default model (defaults to `google/gemini-2.5-flash`) |
| `OPENROUTER_VISION_MODEL` | Vision model for scanning (falls back to `OPENROUTER_MODEL`) |

No API key is needed for OpenFDA -- it is a free public API.

## Common Tasks

### Changing the default AI model

Edit `src/lib/ai.ts`. The `defaultModel` and `visionModel` are configured via environment variables `OPENROUTER_MODEL` and `OPENROUTER_VISION_MODEL`. You can also hardcode a model ID directly in the file.

### Adding a new timing slot

1. Add the slot to `VALID_TIMING_SLOTS` in `src/app/api/medications/route.ts`.
2. Add a default time in `DEFAULT_SLOT_TIMES` in the same file and in `src/app/api/adherence/today/route.ts`.
3. Add translation keys in `messages/en.json` and `messages/zh-TW.json` under `timeSlots` and `medications.frequency`.

### Modifying the scan prompt

Edit the text prompt in `src/app/api/medications/scan/route.ts` inside the `messages` array. The structured output schema (`prescriptionSchema`) controls the shape of extracted data.

### Adjusting interaction checking behavior

- To change the OpenFDA timeout, modify `AbortSignal.timeout(5000)` in `src/lib/drugs.ts`.
- To change the AI's conservatism level, edit the prompt in `checkWithAI`.
- To disable OpenFDA and use AI only, modify `checkInteractions` to skip the FDA call.
