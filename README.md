# LinkedIn Bot

A human-in-the-loop LinkedIn bot. Every few days, a GitHub Action picks an idea from your markdown notes, drafts a post with Claude in your voice, and sends it to you on Telegram with Approve / Skip buttons. Tap approve → it posts. Tap skip → it moves on. Reply with edited text → it posts your version instead.

Free to run (~$1/month for the Claude API calls, everything else is free tier).

---

## Architecture

```
                    ┌─────────────────────┐
                    │  You edit ideas.md  │
                    └──────────┬──────────┘
                               │ git push
                               ▼
┌──────────────────────────────────────────────────────┐
│ GitHub Actions                                       │
│                                                      │
│  ┌──────────────┐         ┌──────────────────┐       │
│  │ generate.yml │         │ check-approval.  │       │
│  │  Tue/Thu 9am │         │    yml — */15m   │       │
│  └──────┬───────┘         └────────┬─────────┘       │
└─────────┼──────────────────────────┼─────────────────┘
          │                          │
          │ 1. pick idea             │ 4. poll for button presses
          │ 2. call Claude           │ 5. on approve → publish
          │ 3. send to Telegram      │ 6. update state, git commit
          ▼                          │
    ┌─────────────┐                  │
    │  Anthropic  │                  │
    └─────────────┘                  │
          │                          │
          ▼                          ▼
    ┌──────────────────────────────────┐        ┌──────────────┐
    │         Telegram (you)           │───────▶│   LinkedIn   │
    │  📝 Draft: ...  [✅] [❌]        │        │   (posted)   │
    └──────────────────────────────────┘        └──────────────┘
```

State (`pending-drafts.json`, `published.json`, `last-update-id.json`, `ideas.md` checkboxes) lives in git. No database.

---

## Setup (one-time, ~90 minutes total)

### Step 0 — Clone and install

```bash
git clone <your private repo>
cd linkedin-bot
npm install
```

### Step 1 — Anthropic API key (2 min)

1. Go to https://console.anthropic.com/ → Settings → API Keys
2. Create a key, copy it
3. Put a few dollars of credit on the account
4. Save it for later (will go in GitHub Secrets as `ANTHROPIC_API_KEY`)

### Step 2 — Telegram bot (5 min)

1. Open Telegram, search for `@BotFather`
2. Send `/newbot`, pick a name and username
3. BotFather gives you a token like `123456789:AAH...`. Save it as `TELEGRAM_BOT_TOKEN`.
4. Search for your new bot in Telegram and send it any message (`/start` works) — this "opens the chat" so the bot can message you back
5. Get your chat ID: open `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates` in a browser. Look for `"chat":{"id":123456789,...}` — that number is your `TELEGRAM_CHAT_ID`.

### Step 3 — LinkedIn app + token (30 min, but with waiting)

This is the gating step. Start here first.

1. Go to https://developer.linkedin.com/ → My Apps → Create app
2. Fill in: name, a LinkedIn Page (create a dummy one if needed), logo
3. Under "Products" tab, request **"Share on LinkedIn"** (gives `w_member_social` scope) and **"Sign In with LinkedIn using OpenID Connect"** (gives `openid` + `profile` scopes, used for the author URN)
4. Approval for `w_member_social` is usually instant for your own account. If not, wait.
5. Under "Auth" tab, add a redirect URL — `http://localhost:8000/callback` is fine for the manual flow below
6. Generate an access token:

**The manual flow** (no local server needed):

a. Construct this URL (replace `CLIENT_ID`):
```
https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=CLIENT_ID&redirect_uri=http://localhost:8000/callback&scope=openid%20profile%20w_member_social
```

b. Visit it, authorize. You'll be redirected to `localhost:8000/callback?code=XXXX` (page won't load — that's fine, copy the `code` from the URL).

c. Exchange the code for a token (run in a terminal):
```bash
curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_CODE_HERE" \
  -d "redirect_uri=http://localhost:8000/callback" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

d. Response gives you an `access_token` (valid 60 days). Save it as `LINKEDIN_ACCESS_TOKEN`.

e. Get your author URN:
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" https://api.linkedin.com/v2/userinfo
```
Response has a `sub` field like `"abc123DEF"`. Your author URN is `urn:li:person:abc123DEF`. Save as `LINKEDIN_AUTHOR_URN`.

> **⚠️ Token expires after 60 days.** Put a recurring calendar reminder. When the time comes, re-run the manual flow. (You can automate this later with the refresh token flow; not worth it for v1.)

### Step 4 — Edit your voice guide (15 min)

Open `content/voice.md` and rewrite it to match YOUR actual voice. This is the single biggest quality lever — generic voice → generic posts. Be specific about:
- Words you use and words you'd never use
- Sentence length, rhythm, paragraph breaks
- Topics you have opinions on
- Tone (sarcastic? dry? warm? matter-of-fact?)

Paste 2–3 examples of posts you admire (from anyone) as concrete references.

### Step 5 — Add your real ideas (10 min)

Open `content/ideas.md`. Delete the starter examples. Add 10–15 ideas that are actually yours — things you've worked on, opinions you hold, specific bugs you fixed. One line each. The more specific, the better the post.

### Step 6 — Test locally before touching GitHub (critical)

Create a `.env.local` file (gitignored):
```bash
ANTHROPIC_API_KEY=sk-ant-...
TELEGRAM_BOT_TOKEN=123456:AAH...
TELEGRAM_CHAT_ID=123456789
LINKEDIN_ACCESS_TOKEN=AQX...
LINKEDIN_AUTHOR_URN=urn:li:person:abc123
```

Load it:
```bash
export $(cat .env.local | xargs)
```

Run each test in order:

```bash
# Test Claude — should print a draft post in your voice
npm run test-claude

# Test Telegram — should push a message to your phone with buttons
npm run test-telegram

# Test LinkedIn — actually posts a test message. Delete after.
npm run test-linkedin
```

If all three work, run the real generator:
```bash
npm run generate
```

This will send a real draft to Telegram. Tap approve → run the approval checker:
```bash
npm run check-approval
```

It'll publish the post and commit state. Check your LinkedIn feed.

### Step 7 — Push to a private GitHub repo

```bash
git init
git add .
git commit -m "initial linkedin bot"
# create a PRIVATE repo on github.com, then:
git remote add origin git@github.com:YOU/linkedin-bot.git
git push -u origin main
```

### Step 8 — Add GitHub secrets

Settings → Secrets and variables → Actions → New repository secret. Add all five:
- `ANTHROPIC_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `LINKEDIN_ACCESS_TOKEN`
- `LINKEDIN_AUTHOR_URN`

### Step 9 — Trigger the workflows manually first

Actions tab → "Generate Draft" → Run workflow. Wait ~30 seconds, check Telegram. Tap approve. Actions tab → "Check Approval" → Run workflow. Wait, check your LinkedIn feed.

If that works, the cron schedule takes over automatically. You're done.

---

## Daily usage

### The normal loop
1. Phone buzzes Tue/Thu with a draft
2. Read it while waiting for coffee
3. Tap ✅ Approve — or reply with an edit — or tap ❌ Skip
4. Post goes live within ~15 min (next cron tick)

### Adding new ideas
Anytime an idea hits you, open `content/ideas.md` in github.com directly (mobile works fine), add a `- [ ] ...` line, commit. Done.

### Refining the voice
Every time Claude produces a draft that feels "off", add a specific note to `voice.md` explaining what was wrong. Examples:
- "Never open with 'Here's the thing'"
- "Don't use the word 'honestly' more than once per post"
- "Prefer Postgres-specific terms over generic 'database'"

After 5–10 such tweaks, output quality converges to your voice.

### Checking the log
`content/published.json` has every post with its URL, timestamp, and whether you edited it. Useful to grep later.

---

## Troubleshooting

**"No ideas available"** — all ideas are `[x]` or `[~]`. Add more to `ideas.md`.

**Draft never arrives on Telegram** — check Actions tab for the Generate Draft run. If the job succeeded but no message, verify `TELEGRAM_CHAT_ID` is right (positive integer, no quotes). If job failed, read the logs.

**Approve button does nothing** — approval checker runs every 15 min; be patient. If it's been > 30 min, check the Check Approval workflow logs. Most common cause: LinkedIn token expired (60-day limit).

**LinkedIn 401 Unauthorized** — token expired. Re-run the OAuth manual flow (Step 3), update the GitHub secret.

**LinkedIn 403 Forbidden** — your app doesn't have `w_member_social` scope, or the scope wasn't requested when you minted the token. Re-do Step 3 with the right scope URL.

**Post gets published twice** — check `pending-drafts.json` isn't corrupted. The `concurrency` group in the workflows should prevent this, but if you ran generate while a previous check-approval was mid-flight, weird things can happen. Delete the duplicated draft from `pending-drafts.json` and commit.

**"Draft not found" error on button tap** — the draft was already processed (approved/skipped) in a previous run. Harmless.

---

## Cost

- **GitHub Actions**: free tier 2000 min/month for private repos. Each run takes ~30s. `*/15` = 96 check runs/day × 30s = 48 min/day → ~1440 min/month. Under the limit, but tight. If you upgrade to public repo: unlimited.
- **Anthropic**: Sonnet runs at roughly $0.01–0.03 per post. 2 posts/week = ~$0.20/month.
- **LinkedIn, Telegram**: free.

Total: **~$1/month**.

If GitHub minutes get tight, bump the check-approval cron to `*/30` (halves usage) or make the repo public (remove any secrets from history first).

---

## Security notes

- Keep the repo **private**. Your voice guide and published history are not secret, but they're yours.
- Never commit `.env.local`. It's in `.gitignore`.
- Rotate the LinkedIn token every 60 days. Set a calendar reminder.
- If you suspect a secret leaked, rotate it in GitHub Settings → Secrets immediately, and invalidate upstream (Anthropic console, BotFather, LinkedIn developer portal).

---

## Extending later

Things that are easy to bolt on once v1 is running:
- **Engagement fetcher**: a weekly action that pulls reactions/comment counts for recent posts and writes them to `published.json`. Lets you see what resonates.
- **Voice tuner**: when you edit a draft significantly, a background action compares the draft vs your edit and proposes additions to `voice.md`.
- **Multi-platform**: add an X/Twitter publisher, same flow. Repurpose one post into both.
- **GitHub activity bot**: same pattern, different targets. Draft issues or PR reviews, gate with Telegram, publish on approval.

Keep v1 boring until it's running for a month.
