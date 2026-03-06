## companion-chat Edge Function

This function wraps your Mistral Agent and returns normalized output:

```json
{
  "reply": "string",
  "risk_level": "safe | caution | crisis",
  "suggested_actions": ["string"]
}
```

### Required secrets

Set these in Supabase project secrets:

- `MISTRAL_API_KEY`
- `MISTRAL_AGENT_ID`

Example:

```bash
supabase secrets set MISTRAL_API_KEY=your_key
supabase secrets set MISTRAL_AGENT_ID=ag_xxx
```

### Deploy

```bash
supabase functions deploy companion-chat
```

### Local serve

```bash
supabase functions serve companion-chat --env-file .env.local
```
