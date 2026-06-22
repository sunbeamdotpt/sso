# SSO Portal Agent Notes

## Getting Verification Codes / Links

When a user needs a verification code or link (e.g., for `dev@sunbeam.pt`), trigger a verification flow and read the email body from the Kratos `courier_messages` table.

### 1. Trigger a verification flow

```bash
TMPDIR=$(mktemp -d)

# Create browser flow (sets CSRF cookie)
curl -sf -c "$TMPDIR/cookies.txt" -b "$TMPDIR/cookies.txt" \
  "http://localhost:4433/self-service/verification/browser" \
  -H "Accept: application/json" > "$TMPDIR/flow.json"

FLOW=$(cat "$TMPDIR/flow.json" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])")
CSRF=$(cat "$TMPDIR/flow.json" | python3 -c "
import sys, json
for node in json.load(sys.stdin)['ui']['nodes']:
    a = node['attributes']
    if a['name'] == 'csrf_token':
        print(a['value'])
")

# Submit email to send the verification code
curl -sf -c "$TMPDIR/cookies.txt" -b "$TMPDIR/cookies.txt" \
  -X POST "http://localhost:4433/self-service/verification?flow=$FLOW" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"email\":\"dev@sunbeam.pt\",\"method\":\"code\",\"csrf_token\":\"$CSRF\"}"

rm -rf "$TMPDIR"
```

### 2. Read the code / link from the courier

```bash
docker --context lima-sunbeam-docker exec sso-postgres-1 \
  psql -U sunbeam -d kratos -c \
  "SELECT body FROM courier_messages ORDER BY created_at DESC LIMIT 1;"
```

This returns the full email body including the numeric verification code and the self-service verification link. The link will point to the Vite dev server (`http://localhost:5175/...`) because Kratos `serve.public.base_url` is configured accordingly.

### Note on Stalwart

Stalwart (the mail server) receives the email via SMTP from Kratos's courier worker, but the email content is easier to retrieve directly from the Kratos database rather than querying Stalwart's RocksDB storage or web admin API.

---

## Semantic Memory Search (Optional)

If a `sunbeam-memory` MCP server is available in your environment, use it for codebase search instead of `grep` or `rg`.

1. **Initialize the repository first.** Before searching, ensure this codebase is indexed:
   - Call `add_watch_target` with the absolute path to this repository.
   - Wait for indexing to complete, then search.
2. **Prefer semantic search.** Use `search_facts` with natural-language queries about behavior, design decisions, known issues, and prior changes.
3. **Store useful findings.** If you discover something future agents should remember (a gotcha, invariant, or decision), call `store_fact` with a concise note and a source URN when possible.

`sunbeam-memory` is **optional**. If the server is not available, skip these steps and use `grep` / `rg` / `Read` as usual. Do not fail, stall, or ask the user to install it.
