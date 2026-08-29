# StudyRoom — Business Rules

> **Maintenance convention:** every new feature updates **all three** specification artifacts: business rules (this file), user stories (`USER_STORIES.md`), and use cases (`USE_CASES.md`). See the use-case template in `USE_CASES.md`.

This document catalogs the enforceable business rules of StudyRoom, extracted from a full scan of the codebase (ASP.NET Core API, SignalR hub, hosted services, PostgreSQL schema DDL, and the Angular frontend). Rules are grouped by feature area so they can be referenced alongside the user stories.

Rule groups:
[1. Cross-Cutting](#1-cross-cutting) · [2. Authentication & Users](#2-authentication--users) · [3. Rooms](#3-rooms) · [4. Study Sessions & Focus Timer](#4-study-sessions--focus-timer) · [5. Statistics & Analytics](#5-statistics--analytics) · [6. Chat](#6-chat) · [7. Meetings & Calls](#7-meetings--calls) · [8. Notes](#8-notes) · [9. Posts & Social Feed](#9-posts--social-feed) · [10. Friends & Social Graph](#10-friends--social-graph) · [11. Direct Messages](#11-direct-messages) · [12. Notifications & Push](#12-notifications--push) · [13. Room Invitations](#13-room-invitations) · [14. Gamification (XP/Streaks/Milestones)](#14-gamification-xpstreaksmilestones) · [15. Leaderboards](#15-leaderboards) · [16. Room Tasks](#16-room-tasks) · [17. Flashcards](#17-flashcards) · [18. AI Assistant & Research](#18-ai-assistant--research) · [19. Games](#19-games) · [20. Calendar Sync](#20-calendar-sync) · [21. Presence & Realtime](#21-presence--realtime) · [22. Recommendations, Nudges & Summaries](#22-recommendations-nudges--summaries) · [23. Realtime Hub (SignalR)](#23-realtime-hub-signalr) · [24. Frontend UX Rules](#24-frontend-ux-rules)

---

## 1. Cross-Cutting

- **Time is UTC; delivery is timezone-aware.** All timestamps are stored in UTC and streaks/weekly goals anchor on UTC dates. Time-of-day delivery that depends on "when" (daily nudge, room-quiet alerts, schedule reminders, weekly summaries) resolves the relevant user's preferred IANA time zone (`User.TimeZoneId`, defaulting to UTC when unset/invalid) — e.g. the daily nudge fires at local **20:00**, not a single global 20:00.
- **JWT authentication** is required for every endpoint except `POST /api/auth/register|login|google|refresh`; SignalR `/hubs/studyroom` accepts the token via `access_token` query string.
- **Rate limiting:**
  - `auth` policy: 10 requests/min per client IP — applied to `AuthController` (anti brute-force). Rejection → HTTP 429 JSON error.
  - `search` policy: 30 requests/min per user (or IP) — applied to `UsersController`.
  - `youtube` policy: 10 requests/min per user — applied to `YoutubeController` only (media search gets its own smaller budget).
  - `join` policy: 10 requests/min per user — applied to `POST /api/rooms/{id}/join` (blocks private-room join-code brute forcing).
- **Security headers** emitted on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Permitted-Cross-Domain-Policies`; HSTS on non-dev.
- **DB bootstrap:** `EnsureCreatedAsync` (no EF migrations) followed by idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` DDL, so upgrades never destroy existing data.
- **Seed data** (admin/alice/bob + rooms) is created only when there are no users.
- **Verification gating:** Only sessions with `Completed = true AND IsVerified = true` count toward XP, milestones, streaks, analytics, weekly summaries, recommendations, calendar sync, and leaderboards.
- **Profile completeness heuristic:** a profile is "complete" only when it has an avatar, first + last name, and a bio (drives the dashboard/complete-profile reminder).

## 2. Authentication & Users

- Registration rejects duplicate email or username (`400` with error).
- Passwords are hashed with BCrypt; never stored in plaintext.
- Google sign-in auto-creates an account on first sign-in:
  - Generates a unique username from the email (sanitized, capped at 20 chars; if a collision, appends a counter).
  - New Google users get a random, unusable password hash (they can't log in with a password).
  - Returning Google sign-in links the GoogleId and back-fills the avatar if missing.
- Login updates `LastSeenAt`. Invalid credentials → `401`.
- **Refresh tokens:** 30-day expiry stored on the user; each refresh rotates the token; JWT lifetime/expiry, issuer and audience are validated with zero clock skew.
- Change password requires the **current password** to be verified first (failure → `400`); returns 204 on success.
- Profile updates enforce username uniqueness; profile fields are trimmed/normalized; `BirthDate` is coerced to UTC.
- **Daily goal** is clamped to **[10, 720] minutes** (any value outside is rejected/reset to bound).
- **User search:** query must be 1–100 chars (`400` otherwise); responses include mutual-friend count, shared-room count, and relationship status (None / Friends / RequestSent / RequestReceived).
- **Presence bulk lookup** is capped at 200 distinct user IDs per request.
- Display names prefer `FirstName + LastName`; fall back to `Username`.

## 3. Rooms

- Roles: `host`, `cohost`, `member`. Creator automatically becomes `host`.
- **Update:** only the owner or a co-host may update a room — otherwise `403`.
- **Delete:** only the owner may delete a room — otherwise `403`.
- **Role assignment:** only the host may change a member's role (to `member` or `cohost`), and a host cannot change their own role.
- **Moderator** = owner or co-host (used for moderation checks).
- **Join:** for private rooms, an exact join code is required; joining rejects users who are already members; leaving rejects non-members (`400`).
- **Private rooms** get a 6-character join code drawn only from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (omits ambiguous characters 0/O/1/I).
- The **join code is exposed only to the creator and members** of that room.
- **Join brute-force protection:** joining with a private-room code is rate-limited (`join` policy: 10 attempts/min per user); joining rejects users who are already members and non-members (`400`).
- **Background upload:** owner-only; max 5 MB; accepted types `.jpg`, `.jpeg`, `.png`, `.webp` only.
- Room name is required (≤100); description ≤500; subject ≤50.

## 4. Study Sessions & Focus Timer

- **One open focus session per user per room:** `start` reuses/resumes an in-progress session *for the same room* (updating `DurationMinutes` + `StartedAt` and re-scheduling the server timer) and returns its `sessionId`; starting in a different room creates a fresh session. Sessions never silently jump rooms.
- **Idempotent completion (single award):** the shared `SessionFinalizerService` claims a session atomically (`Completed=true`, `DurationMinutes`, `IsVerified`, `AwardProcessed=true` set in one `ExecuteUpdateAsync` won by exactly one caller) — duplicate completes, a retry after a lost connection, and the server-side timeout sweep can never double-award; losing callers get "no active session" and no duplicate notification.
- **Session validation (verification) — ordered checks** on completion; first triggered rule marks the session unverified with a `VerifiedReason`:
  1. `DurationMinutes > 240` → `excessive_duration`.
  2. `DurationMinutes < 1` → `too_short`.
  3. Verified minutes already accrued today (the user's local day) + this session's `DurationMinutes` > 600 → `too_many_sessions` (a minutes-aware daily cap, not a session count).
  4. Tab-switch **round-trips** > allowed, where `allowed = max(1, floor(durationMinutes / 10))` → `excessive_tab_switches`.
  - Otherwise the session stays verified (verified by default on creation).
- **Trust score** = `max(30, 100 − 2 × roundTrips)`; each completed distraction (a `left` followed by a `returned`) costs 2 points with a floor of 30.
- **Tab-switch events** are recorded (`left` / `returned`) only while there is an active session, keyed to that session's `sessionId`; an ending `left` (app closed at completion) is benign and not penalized.
- **XP award** (on verified completion only): `max(1, round(durationMinutes))` points, event type `focus`, label "Focus session completed". XP is never awarded for `points <= 0`.
- **Milestone checks** run after every verified completion.
- **Calendar sync** happens for verified completions only; event title = `Study: {roomName} ({minutes} min)`.
- A `Focus session complete` notification is created on completion.
- **Collective room goal** = `max(50h, memberCount × 10h)` per week.
- **Session notes:** editable only by the session owner; ≤ 2,000 chars.
- **Idle-timeout recovery (SessionWatcher):** sessions older than 6 hours still incomplete are auto-finalized with actual elapsed time, marked `Completed = true`, `IsVerified = false`, `VerifiedReason = "idle_timeout"`, and the user is notified ("auto-finalized ... (you were away)").
- **Verification review (unverified study hours):** only `excessive_duration`, `too_many_sessions`, and `excessive_tab_switches` are eligible for review — `too_short` and `idle_timeout` are **not**. A user explains a flagged session with a comment (≤ 2,000 chars) and submits one **pending** review request (`VerificationState = Pending`); a second pending request is rejected while a request is outstanding. The room's **host or co-host** (moderator; NOT a global admin) approves or declines from a per-room queue; the requester's own role cannot review their own session. Approval re-marks the session verified (`IsVerified = true`, `VerifiedAt`, reviewer id) and **retroactively re-awards** it idempotently (XP for the session, milestone check, streak, calendar event) — the existing `AwardProcessed` guard prevents any double-award. Decline stores an optional reviewer note (`VerificationReviewNote`); a declined session can be requested again.
- **Server-side timer redundancy:** a server scheduler completes sessions even if the client never calls back (hourly-safe sweep every 1s); both the hub and REST controller drive the same finalize path through the shared `SessionFinalizerService`.
- `start-break` **terminates the room's current focus session** (round-trips it through the finalizer) and schedules the break timer; `reset`/`pause` finalize the active session and cancel the room's scheduled timer. Breaks support long-break durations.

## 5. Statistics & Analytics

- Only `Completed && IsVerified` sessions count in recent-sessions, activity feed, trends, and exports.
- Formatting: weekly minutes rendered as `Xh Ym`.
- **Trend endpoint:** `days` clamped to **[7, 90]**.
- **Recent-sessions endpoint:** `limit` clamped to **[1, 50]**; optional room filter.
- **Export:** defaults to the last **90 days**; format CSV (default) or JSON; file download.
- **Daily trend** = per-date verified minutes; **hourly** returns all 24 buckets zero-filled.
- **Time-of-day buckets:** Morning 5–12, Afternoon 12–17, Evening 17–21, Night otherwise (used for "favorite time" and recommendation logic).
- **Weekly goals:** keyed by ISO week number (ISO calendar, Monday start); on setting a target, `ActualMinutes` is recomputed from the start of the current week; week-over-week change % is guarded against a zero prior-week denominator.

## 6. Chat

- Message content is required, ≤ 2,000 chars.
- Reading chat is via REST (`GET /api/rooms/{roomId}/messages`); **sending** is exclusively via the SignalR hub (`SendMessage`), which persists and broadcasts to the room group.

## 7. Meetings & Calls

- **Create:** the creator must be a room member; if `DurationMinutes <= 0` it defaults to **60**.
- **List:** room members only — `403` for non-members.
- **Update:** organizer only — `403` otherwise.
- **Delete:** organizer, room creator, or any room host/co-host.
- **Attendance:** status must be exactly `Accepted` or `Declined`; keyed by composite `(MeetingId, UserId)`; counts (`AcceptedCount`, `AcceptedByMe`) derived from attendee rows.
- **LiveKit token issuance:** requires room membership **or** a valid guest join code — otherwise `403`. Tokens are short-lived (expiry 1h, `nbf` −10s), permit publish/subscribe/data with camera, microphone, screen-share sources; the creator is flagged as host in metadata.
- **"Other rooms" meetings** surface only upcoming meetings in the caller's other rooms (excludes the room currently being viewed).

## 8. Notes

- **One shared note per room** (1:1 with Room). The note endpoint returns an empty placeholder if none exists.
- **Version snapshots** are created only when the content actually changes (string comparison) — identical saves do not spam history; each snapshot records editor ID + display name + timestamp.
- Version history is ordered newest-first by `EditedAt`.
- **Restore** rewrites the note content to the version's content (in-place; no new version row is created for the restore itself).
- Room notes are available to the AI assistant as context; notes can be exported to DOCX/PDF client-side.
- Route implies member scope (shared via room).

## 9. Posts & Social Feed

- **Feed caching:** per-user/per-room feed cached (2 min absolute / 1 min sliding); any write (create/delete/like/comment) invalidates all feed caches via a group cancellation token.
- **Create:** requires content or a `SharedPostId` reference; posting to a room requires membership (`403` otherwise).
- **Fan-out:** room posts broadcast on the `room_{id}` group; global (social) posts broadcast to each accepted friend's connection.
- **Like** is a toggle — inserts/deletes a `PostReaction` (type `like`) and increments/decrements the `PostStats` read model accordingly.
- **Comments:** content required (≤ 1,000 chars); **nested replies** are allowed but a reply's parent must belong to the same post; comment count incremented via the read model.
- **Comment notifications:** the post author is notified on a comment (or the parent-comment author for replies); the sender is never notified of their own activity; comment text truncated to 120 chars in the notification.
- **Delete:** author-only — `403` otherwise.
- Post content ≤ 5,000 chars.

## 10. Friends & Social Graph

- **Request rules:** cannot send a request to yourself; the target must exist; duplicate attempts are rejected as `Already friends` or `Already pending`.
- **Accept:** only the addressee may accept — `403` otherwise; accept/request both generate in-app notifications (`friend_request`, `friend_accept`).
- **Delete request:** either party may cancel; **remove friend:** either party.
- **Suggestions** exclude users who are already friends or have a pending request; scoring weights: mutual friends +100 each, same school +25, same location +20, shared rooms +10 each, age within 3 years +15, same major +12, interest overlap +8 each.
- Presence queries cap at 200 user IDs and use last-seen fallback.

## 11. Direct Messages

- The receiver must exist; **cannot message yourself**.
- Sending typically requires an accepted friendship (unauthorized otherwise).
- Content is trimmed; ≤ 2,000 chars.
- Opening a conversation **marks messages as read**.
- Conversation list shows recent messages grouped per peer, computes unread counts, and appends friends with no prior conversation as empty threads; sorted by last message time.
- **Delete:** only the sender may delete a DM — `403` otherwise; deletion broadcasts to both participants.
- **Stale-message re-engagement** (every 5 min): direct messages unread for **> 12 hours** that haven't already triggered a reminder produce one `stale_message` notification to the receiver (guarded by an `UnreadNotificationSent` flag so it fires once per message).

## 12. Notifications & Push

- `Notification` fields: type (≤30), title (≤200), body (≤500), icon, actor info, link (≤200), `IsRead`, created time.
- **Mark-read** is owner-restricted (`404` if not found or not owned); `read-all` applies to the caller's notifications only.
- Notification types observed across services: `friend_request`, `friend_accept`, `room_invite`, `room_invite_accepted`, `comment`, `timer`, `nudge`, `reminder`, `social`, `weekly_summary`, `stale_message`.
- **Direct creation of notifications** (`POST /api/notifications`) is **admin-only** (`Authorize(Roles = "Admin")`) — regular users never call this endpoint; a non-admin caller gets `403` and nothing is created.
- **Web Push subscription** requires non-empty `Endpoint`, `P256dh`, and `Auth` (`400` otherwise); VAPID keys live server-side.
- Dead push endpoints (410/404) are **deleted automatically** to avoid repeated failures; other send errors are best-effort (logged, not fatal).
- Notifications fan out over SignalR (`user_{id}` group) and to web push.

## 13. Room Invitations

- Only a room member can invite (`invalid for non-members`); you cannot invite someone **already a member**; duplicate **pending** invites are rejected.
- Only the **invitee** may accept/decline an invitation — `403` otherwise; only the **inviter** may cancel — `403` otherwise.
- Accepting auto-adds the invitee as a room member and fires a `room_invite_accepted` notification; sending fires a `room_invite` notification.
- Decline/cancel delete the invitation row.

## 14. Gamification (XP/Streaks/Milestones)

- **XP sources:** verified focus minutes (1 XP/min, min 1). XP rows are only written when `points > 0`.
- **Level curve:** Level 1 needs **100 XP**; each subsequent level needs `100 + (level − 1) × 50` more (100, 150, 200, 250, …).
- **Streak computation:** distinct dates of completed **and verified** sessions, descending; anchor `expected = today`; a day counts if `date == expected` or `date == expected − 1`; otherwise the streak breaks. This today-or-yesterday anchor means a streak **stays alive through the current day** until a full day passes unstudied.
- **Milestones/badges** (awarded at most once each per `MilestoneType`):
  - Streak: 7, 14, 30, 60, 100 days.
  - Sessions: 10, 50, 100, 500 verified sessions.
  - Total hours: 10h, 50h, 100h, 500h, 1000h of verified study.
- **Leaderboard metric:** weekly XP (accepted friends + the caller), with total XP as the tiebreaker; includes level, this-week verified minutes, and streak.

## 15. Leaderboards

- **Room leaderboard:** ranks members by verified minutes, sessions, and current streak (last 7 days).
- **Friend leaderboard:** `take` clamped to **[1, 100]**; always includes the caller; ranked by weekly XP then total XP; explicit ranks 1..N.

## 16. Room Tasks

- Every task operation requires **room membership** — `403` otherwise.
- **Create:** title required (≤ 300); description ≤ 1,000.
- **Assign:** assignee display name is resolved server-side from the user table; empty/invalid assignee clears the assignment.
- **Completion:** toggling to complete records `CompletedBy` + `CompletedAt`; un-completing clears both.
- **List ordering:** incomplete tasks first, then newest created.

## 17. Flashcards

- All deck operations are **owner-scoped** — a deck that belongs to another user (or doesn't exist) returns `404`.
- Deck title required (≤ 120); description ≤ 500; card front ≤ 2,000; card back ≤ 4,000.
- **Replace cards** is delete-and-reinsert: blanks cleaned, values trimmed, IDs regenerated, deck `UpdatedAt` refreshed (optional re-title).
- **AI generation:** source truncated to 6,000 chars; card count clamped to **[3, 30]**; JSON parsed into front/back pairs with de-duplication and length enforcement; suggested title derived from focus or first line.

## 18. AI Assistant & Research

- **Model resilience:** configured/preferred Gemini model tried first, then a fallback chain (`gemini-2.5-flash` → `gemini-2.5-pro` → `gemini-3-flash-preview` → `gemini-3.6-flash` → `gemini-1.5-flash`); a 404 retries the next candidate; 429 handled; 25–35 s timeouts produce graceful fallback answers.
- **Context policy:** the assistant uses the user's subject and current room-note context in its system prompt; keeps the last **10** conversation messages; consecutive same-role messages are merged (Gemini requires alternating roles).
- **Research mode:** fixed six-phase pipeline (Introduction → Problem Statement → Literature Review → Methodology → Expected Outcomes → Timeline & Milestones); real paper references from Semantic Scholar injected into the prompt; each answer advances the current phase to the next.
- **Conversation access** is owner-scoped — someone else's conversation is a `404` (not a `403`).
- **Offline fallback:** keyword-canned answers (derivatives, integrals, Newton's laws, binary trees, greetings) when the AI is unreachable.
- **Research service:** Semantic Scholar searches capped at `limit ≤ 50`; failures degrade to empty results (never crash the flow); paper details resolved from a URL's embedded paper ID.

## 19. Games

- AI-generated content is **strictly schema-validated** per game (quiz, true/false, memory, scramble, math); counts clamped to **[1, 30]**; invalid items filtered out.
- On AI failure or invalid output, the game silently falls back to **built-in questions** (never blocks play).
- Best scores are stored **locally** (per-browser), not server-side.

## 20. Calendar Sync

- Providers: `google` and `microsoft` (outlook).
- Connections store access + refresh tokens and an **auto-sync flag** (default true); tombstones → disconnect.
- **Token refresh:** if a token expires within 5 minutes, it is refreshed via the provider OAuth token endpoint before use and persisted.
- **Daily aggregation:** verified study time for a day is collapsed into **one calendar event per day per provider**, tracked via the `CalendarStudyEvents` marker table (unique on `(UserId, Provider, CalendarId, DayUtc)`); a later session the same day **PATCHes (extends) the event's end time** instead of creating a duplicate.
- **Event transparency:** study events use Google `transparency: transparent` / Microsoft `showAs: free` (never mark the user busy).
- **Manual sync** (`POST /api/calendar/sync-now`) creates a standalone event from the request (title/description passthrough, no aggregation).
- Per-provider failures are logged but non-fatal (one broken provider never blocks the other).

## 21. Presence & Realtime

- Presence is tracked in-memory via a **connection counter per user** (multi-tab/multi-device safe); the entry is removed only at zero connections.
- Connect/disconnect hooks: joining joins the `room_{id}` group and personal `user_{id}` group; disconnect updates `LastSeenAt`, cleans up focus tracking, closes any of the user's active calls (notifying peers + push), and resyncs outgoing broadcasts.
- `GetPresence` returns users sharing any room with the caller (with room IDs, username, avatar).

## 22. Recommendations, Nudges & Summaries

- **Recommendations** (max 5, rule-based, evaluated top-down):
  1. Streak protection (streak ≥ 3 and 0 minutes today).
  2. Daily goal progress (remaining minutes toward `DailyGoalMinutes`, default 120).
  3. Time-of-day: morning focus window (9–12), afternoon slump (13–15), evening wind-down (≥ 20).
  4. Weekly trend: daily average < 50% of goal → suggest lowering; ≥ goal → suggest raising.
  5. Room suggestions: join a room if none; explore more if ≤ 2 rooms.
  6. Onboarding: total minutes < 60 → suggest a 25-min Pomodoro.
- **Daily nudge** (hourly sweep; fires when it's ~20:00 in the **user's own time zone**) only for users with **no verified completion today** (local day); content personalized by streak state (at-risk / keep momentum / first-ever).
- **Room-quiet alert** at the host's **local 0, 6, 12, 18**: rooms with **zero verified sessions in the last 24h** → notify the host (type `social`).
- **Accountability-pair suggestions** (Mondays 09:00 UTC): pairs of users who are **active (verified this week), share a room, and aren't friends**; pair keys de-duplicated so each pair is suggested once.
- **Schedule reminders** (hourly): reads `PreferredStudyDays`/`PreferredStudyHours` in the **user's time zone**; fires only when within a **5-minute window**, **30 minutes before** a preferred window start, **and** the user has no **verified** session today (local day) (type `reminder`).
- **Weekly summary** (each user's **local Sunday 20:00**, guarded against duplicate sends within 24h): last-7-days verified minutes (rendered `Xh Ym`), verified session count, current streak, most-active room name (type `weekly_summary`).

## 23. Realtime Hub (SignalR)

- **Chat:** `SendMessage` persists and broadcasts to the room group; DMs broadcast to both participants' `user_` groups plus a push.
- **Focus flow:** `StartTimer` reuses the open session, schedules server completion, tracks focus presence, broadcasts `FocusCountUpdated`; **friend-in-room notification** — accepted friends co-located in the room get "Someone you know is studying" alerts.
- **Calls:** only **one "Ringing" call per callee** at a time; offer + ICE candidates are **buffered server-side (ICE capped at 50)** so a callee cold-starting from a push can recover them; every ring sends a web push; decline/cancel/end produce pushes.
- **Video broadcast (host-only):** the host validates the YouTube ID (regex for `watch?v=`, `embed/`, `shorts/`, `live/`, `youtu.be/`, bare 11-char IDs), stores state, and broadcasts to **others only** (host excluded to avoid remount); play/pause/seek controls echo-free; on reconnect the current broadcast is resynced to the client.

## 24. Frontend UX Rules

- Routing is auth-guarded for every page except `/login` and `/register`; unknown routes fall back to `/dashboard`.
- **AI chat guardrails:** a 120-second client timeout safeguard; question editing + retry on failure; long answers downloadable as DOCX/PDF.
- **Notification settings** (sound, volume, previews, quiet hours, per-event toggles, desktop permission) are respected by the notification service (sound + quiet hours honored in-app and for pushes).
- **Study player** keeps the device screen awake while video plays and collapses to a floating pill.
- **Command palette** (Ctrl/Cmd+K) opens pages and rooms directly; global assistant opens from the navbar robot button (closes on Esc / backdrop click).
- Profile reminder banner shows whenever the profile-completeness heuristic fails.
- **Consistent page headers:** every main page (Timeline, People, Analytics, Flashcards, Games, Messages, Invitations, Notifications, Settings, Study Rooms, Dashboard) renders the shared `app-hero-card` — a gradient card with title, subtitle, an action slot, and stat badges — so headers never drift in style.
- Best-score persistence for games is browser-local (`localStorage`).
- Frontend clamps mirror backend where user input is entered (e.g., daily goal), but authoritative validation is server-side.

---

*Extracted from a full codebase scan of the StudyRoom solution. Rules verified against controllers, services, hosted workers, the SignalR hub, schema DDL, and Angular components/services.*