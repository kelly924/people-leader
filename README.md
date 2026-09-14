# Manager Resources

An internal site for Saint Bernard managers: a gated reference library
(policies + how-to guides) plus an AI assistant that can answer questions
about that content and help draft things like reviews, PIP language, or a
message to a direct report.

Nothing shows until the access code is entered — the page itself carries
no policy content; the library and the assistant are both fetched from
the server only after the code checks out.

## What you need before you deploy

1. **An Anthropic API key.** From https://console.anthropic.com under "API
   Keys." Billed pay-per-use, separate from any claude.ai subscription.
2. **An access code you choose.** This is required (unlike Tone Check,
   where it was optional) — the whole point of this site is that nothing
   shows without it.
3. **A place to host it** — Render, Replit, or Vercel all work the same
   way as Tone Check.

## Deploy on Render

1. Put these files in a GitHub repo (same repo as Tone Check or a new one
   — either works).
2. At https://render.com, create a **New Web Service**, connect the repo.
3. Build command: `npm install`. Start command: `npm start`.
4. Under **Environment**, add:
   - `ANTHROPIC_API_KEY` → your key
   - `ACCESS_CODE` → the passcode managers will type in. Required — the
     server rejects every request if this isn't set.
5. Deploy. Render gives you a public `.onrender.com` URL. Share that link
   with your managers along with the access code (send the code
   separately, e.g. in Slack, not in the same message as the link).

## Deploy on Replit

Same as Tone Check: import the files (keeping `server.js`, `package.json`,
`README.md`, and `public/index.html` in the same structure), add
`ANTHROPIC_API_KEY` and `ACCESS_CODE` under Secrets, click Run, then
Deploy for a stable URL.

## Editing the reference content

Open `server.js` and find the `CONTENT` object near the top. It has two
arrays, `policies` and `howtos`. Each entry looks like:

```js
{
  id: 'pto',
  title: 'PTO & Time Off',
  body: `Your actual policy text goes here.`,
}
```

- Replace the placeholder `body` text (marked `[Placeholder — replace…]`)
  with the real policy or guide.
- Add a new entry by copying that shape and giving it a unique `id`.
- Remove an entry by deleting its block.
- The assistant is given this same content as context automatically, so
  editing it here keeps the reference pages and the assistant's answers
  in sync — you don't need to update anything else.

## Editing the assistant's behavior

The assistant's instructions live in the `system` array inside the
`/api/assistant` route in `server.js`. It currently: answers policy
questions grounded in the `CONTENT` above (and says so when something
isn't covered, rather than guessing), helps draft manager communications,
asks for missing specifics instead of inventing them, and keeps a direct,
human tone. Edit that array to change any of this — e.g. to add "always
recommend looping in HR for terminations" or adjust the tone.

## Changing the look

- Colors, fonts, and layout are all in `public/index.html`, in the
  `<style>` block at the top — it uses the same palette as Tone Check for
  a consistent internal look.
- The two nav groups ("Policies" and "How-Tos") are built automatically
  from whatever is in `CONTENT.policies` and `CONTENT.howtos` — no HTML
  edits needed when you add or remove reference pages.

## Cost and privacy notes

- The library and chat are only ever sent to a browser tab after the
  correct access code has been provided; each API request is re-checked
  against the code server-side.
- Chat conversations are kept in the browser tab's memory only (cleared
  on refresh or close) and are not logged or stored by this app.
- You're billed by Anthropic for API usage. The chat assistant costs more
  per use than Tone Check's single rewrite call, since each message sends
  the whole conversation plus the reference content — keep an eye on
  usage at console.anthropic.com, especially if the link is shared beyond
  your managers.
