# AI Optimization Report — ApparelFlow ERP

This report documents how I used AI while building the Cutting Operations & Gatekeeper Verification
Terminal, where the AI output was wrong or weak, and how I found and fixed those problems.
Every issue below actually happened during this build; screenshots and commits are in the repository history.

---

## 1. Tools & prompting

| Tool | What I used it for |
|---|---|
| **Claude (Anthropic), chat** | Main assistant. Planning the 4-day schedule and Git branch strategy, Prisma schema design, API routes, React components, Zod validation, Vitest tests, and debugging from screenshots of errors. |
| **VS Code + TypeScript compiler** | Catching type errors before running code. |
| **Chrome DevTools** | Checking network responses and calling the API directly from the console to test server-side rules. |
| **Neon console / Prisma Studio** | Checking that data and the audit log were really saved. |

**How I prompted.** I gave the AI the full assessment PDF, then worked one feature at a time
(`feature/database` → `feature/auth` → `feature/orders` → `feature/verification` →
`feature/sewing-queue` → `feature/tests`). I asked for complete files instead of fragments, ran
every change locally, and sent back the exact error text or a screenshot whenever something failed.
I did not merge a feature until I had tested it in the browser **and** by calling its API directly.

---

## 2. Flawed / broken AI code

### 2.1 Date formatting caused a hydration error
**What the AI wrote:** `formatDateTime()` used `Intl.DateTimeFormat("en-GB", { dateStyle, timeStyle })`.
**What went wrong:** the Next.js error badge ("1 Issue") appeared on the Supervisor page after every refresh.
Node.js on the server and Chrome in the browser ship different ICU data, so the same date was
printed slightly differently (e.g. `8 Oct 2026, 14:40` vs `8 Oct 2026 at 14:40`). React saw two
different HTML strings and reported a hydration mismatch.
**Lesson:** "it works in the browser" is not enough for code that renders on both server and client.

### 2.2 Approval transaction timed out in real conditions
**What the AI wrote:** the approve route wrapped the status change, 5 item updates and the audit-log
insert in `prisma.$transaction(...)` with Prisma's **default 5-second timeout**.
**What went wrong:** with all components GREEN, clicking **Approve Batch** showed
*"Server: Network error. Please try again."* My database is in AWS us-east-2 and I am in Sri Lanka,
so each query takes about one second. Seven round trips went past 5 s, Prisma closed the transaction
and rolled it back. The UI message was also misleading: the server returned an empty 500, the client
failed to parse it, and the `catch` block reported it as a *network* error.
**Good news:** because it was a single transaction, nothing was half-saved. The order stayed
`PENDING_VERIFICATION` and no audit row was written.

### 2.3 Code written for older Next.js behaviour
**What the AI wrote:** role-guarded pages that read the session cookie, which is the normal pattern
for Next.js 13–15.
**What went wrong:** the project was created with **Next.js 16.4**, where *Cache Components* was enabled.
Next.js flagged every page that reads cookies as a "Blocking Route" (*uncached data during prerendering*).
The AI's code was not aware of the newer default.

### 2.4 Session endpoint could return a stale answer
**What the AI wrote:** `GET /api/auth/me` with no cache headers.
**What went wrong:** after logging back in, the browser still showed an old `{"error":"Not logged in"}`
until I hard-refreshed. Nothing was insecure, but it made me think login was broken and cost debugging time.

### 2.5 A UI hint that could cause a wrong QC decision
**What the AI wrote:** count inputs in the Verification Terminal with `placeholder="0"`.
**What went wrong:** an empty box looked like a real count of zero. On a factory floor, a verifier
could think a component was already counted. The status column did say "NOT COUNTED", but the input
itself was misleading.

### 2.6 Tooling and environment mistakes
- A terminal command used `cd /d D:\apparelflow`, which only works in **cmd**, not in **PowerShell** (my terminal).
- `npm i -D vitest` failed with an `ERESOLVE` conflict: the latest Vitest needed `@types/node@22`, but the project had v20.
- `npx prisma init` produced a Prisma 7–style `prisma.config.ts`, while the project uses Prisma 6.
  With that file present, Prisma 6 stops auto-loading `.env`, so it had to be removed.

### 2.7 Contrast defect from the starter template
This one came from the `create-next-app` default, not from AI-written code, but the brief calls it
out specifically. The default `globals.css` switches text to near-white when the operating system is
in dark mode. On my laptop the starter page rendered light text on a dark page, and form inputs would
have inherited that colour on white backgrounds — the exact "white-on-white" defect in the brief.

### 2.8 My own mistake (for candour)
`GET /api/sewing/queue` returned an empty **500** in 32 ms. The route file had not been saved
properly. The fast failure time (no database round trip) was the clue. Re-pasting the file, saving,
and restarting the dev server fixed it.

---

## 3. Human refactoring

| Problem | What I changed | How I verified it |
|---|---|---|
| 2.1 Hydration mismatch | Rewrote `formatDateTime()` to build the string by hand using a fixed UTC+05:30 offset (Sri Lanka has no daylight saving), so server and browser produce identical text. | Refreshed every page; the error badge no longer appears. |
| 2.2 Transaction timeout | Added `{ maxWait: 10_000, timeout: 30_000 }` to the approve and reject transactions. The `catch` now logs the real error and returns a clear JSON 500: *"Could not save the approval. Nothing was changed — please try again."* | Approved the same batch successfully; checked the audit row in the Sewing Queue. |
| 2.3 Next.js 16 Cache Components | Turned Cache Components off in `next.config.ts`, with a comment explaining why: every page here depends on the logged-in user, so pre-rendering gives no benefit. All protected routes now build as `ƒ (Dynamic)`. | `npm run build` shows every protected page as dynamic; badge gone. |
| 2.4 Stale `/me` | Added `export const dynamic = "force-dynamic"` and `Cache-Control: no-store`. Applied the same header to `/api/verify/pending` and `/api/sewing/queue`. | Logged out / in repeatedly; always current. |
| 2.5 Misleading placeholder | Changed the placeholder from `0` to `Count`. | Visual check on the terminal. |
| 2.6 Tooling | Used PowerShell syntax; installed `@types/node@22` alongside Vitest; deleted `prisma.config.ts` and confirmed with `npx prisma -v` that 6.19 was in use. | Commands ran cleanly. |
| 2.7 Contrast | Replaced `globals.css`: removed the dark-mode switch, set `color-scheme: light`, gave every `input`, `select`, `textarea` and `option` explicit dark text on white, a readable placeholder colour, and a 3 px blue focus outline. Traffic-light badges use colour **plus** an icon and a text label. | Clicked every input, dropdown and focus state with the laptop in dark mode. |

**Other decisions I made deliberately** (things the brief warns AI often gets wrong):

- **Numbers:** quantities are validated as text with `^\d+$` **before** conversion, and inputs use
  `type="text" inputMode="numeric"`. This avoids `parseInt("5.5") === 5` and `type="number"`
  accepting `e`, `-` and `.`. The same Zod schema runs in the browser and on the server.
- **Identity:** `verifierId` and `createdById` are read from the signed session cookie. They are
  never accepted from the request body.
- **No client-side security:** hidden buttons are only for usability. I tested every rule by calling
  the API directly from the browser console as the wrong role, and with bad data.
- **Separate test database:** tests run on a Neon `test` branch, and `tests/setup.ts` refuses to run
  unless `APP_ENV=test`, so a test run can never wipe production.

---

## 4. Defensive architecture

The system assumes the browser can be bypassed. Every protected request passes through the same
ordered checks on the server:

```
1. Authentication     requireRole()            → 401 no / invalid / expired JWT
2. Authorisation      requireRole(role)        → 403 wrong role
3. Input validation   Zod schema               → 422 bad id, decimals, negatives, text, empty
4. Existence          load order               → 404
5. State check        current status allowed?  → 409 illegal transition
6. Business rule      evaluateCounts()         → 422 any RED or uncounted (hard stop)
7. Atomic write       one DB transaction       → status + item counts + audit log together
```

**State machine.** Allowed transitions are written into the `WHERE` clause of the update itself:

```ts
await tx.cuttingOrder.updateMany({
  where: { id: orderId, status: "PENDING_VERIFICATION" },
  data:  { status: "VERIFIED" },
});
// if 0 rows changed → someone else already acted → 409, transaction rolls back
```

Because the check and the change happen in one SQL statement, two verifiers clicking at the same
moment cannot both approve, and an order cannot jump from `CUTTING_IN_PROGRESS` or `REJECTED`
straight to `VERIFIED`.

**Hard stop on the server.** The approve route ignores any traffic-light result from the browser. It
reloads the expected quantities from the database, recomputes every light with the same pure
function the UI uses (`lib/domain.ts`), and refuses with **422** if any component is RED or missing.
Duplicate component IDs, and IDs that don't belong to the order, are also rejected.

**Role isolation.** One helper (`requireRole`) guards every API route; another (`requirePageRole`)
guards every page and redirects to the user's own area. The Sewing Queue query has a hard-coded
`status: "VERIFIED"` filter and takes no parameters, so URL tampering cannot widen it.

**Immutable audit trail.** On approval, the server writes the verifier ID (from the JWT), the database
timestamp, every component's expected / actual / variance, and the fabric wastage %. A PostgreSQL
trigger blocks any `UPDATE` or `DELETE` on `verification_logs`, so this record cannot be changed
afterwards, even by the application.

**Proof.** These rules are covered by automated tests (33 passing), and I also confirmed them on the
running app from the browser console:

| Check | Result |
|---|---|
| Verifier calls `POST /api/orders` | **403** |
| Supervisor calls `POST /api/orders/1/approve` | **403** |
| Verifier calls `GET /api/sewing/queue` | **403** |
| Verifier approves with one component 1 piece short | **422** "Approval blocked…" |
| `GET /api/sewing/queue?status=PENDING_VERIFICATION` | **200**, verified orders only |
| `UPDATE verification_logs …` | rejected by the database trigger |

---

## What I learned

AI was fastest at producing a working first version. Most of its mistakes were not about the main
logic; they appeared at the **edges**: framework version changes, server-vs-browser differences, real
network latency, and small UI details that matter on a factory floor. Testing the API directly, reading
the exact error text, and asking *why* before accepting a fix were what turned the first version into
software I am confident to hand over.
