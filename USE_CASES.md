# StudyRoom — Use Cases

This document captures the use cases of StudyRoom, written from a full scan of the codebase (ASP.NET Core API + SignalR + PostgreSQL backend, Angular frontend). It is maintained alongside two other artifacts:
- **User stories** → `USER_STORIES.md` (why: motivations and benefits)
- **Business rules** → `BUSINESS_RULES.md` (what: invariants, limits, permissions, formulas)
- **Use cases** → this file (how: end-to-end flows, actors, pre/post-conditions, alternate paths)

## Actors

| Actor | Description |
|---|---|
| **Student / User** | Any authenticated user. Primary actor for nearly every use case. |
| **Room Host (Owner)** | Creator of a room; holds full moderation power. |
| **Room Co-host** | Member promoted by the host; can edit room, delete meetings. |
| **Room Member** | Any user who joined a room; uses chat/timer/notes/tasks/meetings. |
| **Meeting Organizer** | Member who created a specific meeting. |
| **Admin** | Seeded system account (e.g., creating notifications to any user). |
| **Guest (call)** | Non-member joining a call using a valid join code. |

## Use case template (for new features)

Every new feature should add use cases using this structure:

```
### UC-XX · <Title>
- **Primary actor:** <Actor>
- **Trigger:** <What starts the flow>
- **Preconditions:** <Must be true before>
- **Success guarantee:** <State after a successful run>
- **Main flow:**
  1. ...
  2. ...
- **Alternate flows:**
  * Alt 1 – <Name>: ... (steps)
```

Understanding of standard notation:
- **Preconditions**: things already true before the use case begins.
- **Success guarantee**: the post-condition that must hold when the use case completes successfully.
- **Main flow**: numbered steps in the happy path (system responses shown as bullets under a step).
- **Alternate flows**: numbered variants/error paths tied to the relevant step.

---

## Table of contents

1. [Authentication & Account](#1-authentication--account)
2. [Profile & Onboarding](#2-profile--onboarding)
3. [Dashboard](#3-dashboard)
4. [Study Rooms](#4-study-rooms)
5. [Room Chat](#5-room-chat)
6. [Focus Timer](#6-focus-timer)
7. [Shared Notes](#7-shared-notes)
8. [Room Tasks](#8-room-tasks)
9. [AI Assistant & Research](#9-ai-assistant--research)
10. [Flashcards](#10-flashcards)
11. [Educational Games](#11-educational-games)
12. [Meetings & Video Rooms](#12-meetings--video-rooms)
13. [Peer Calls](#13-peer-calls)
14. [Video Broadcast & Study Player](#14-video-broadcast--study-player)
15. [Social Feed & Posts](#15-social-feed--posts)
16. [Friends & People](#16-friends--people)
17. [Direct Messages](#17-direct-messages)
18. [Notifications & Push](#18-notifications--push)
19. [Room Invitations](#19-room-invitations)
20. [Presence](#20-presence)
21. [Analytics & Statistics](#21-analytics--statistics)
22. [Gamification & Leaderboards](#22-gamification--leaderboards)
23. [Calendar Integration](#23-calendar-integration)
24. [Settings & Personalization](#24-settings--personalization)
25. [Realtime Sequences (SignalR)](#25-realtime-sequences-signalr)

---

## 1. Authentication & Account

### UC-01 · Register account
- **Primary actor:** New student
- **Trigger:** User opens `/register`.
- **Preconditions:** None.
- **Success guarantee:** A user account exists; the user is authenticated; profile can be completed.
- **Main flow:**
  1. User submits a username and password.
  2. System validates uniqueness of username/email and hashes the password (BCrypt).
  3. System issues access + refresh tokens and returns the profile.
  4. User lands on the dashboard.
- **Alternate flows:**
  * Alt 1 – Duplicate username/email: system returns `400` with an error; the user corrects the input (step 1).

### UC-02 · Log in
- **Primary actor:** Existing student
- **Trigger:** User opens `/login`.
- **Preconditions:** Account exists.
- **Success guarantee:** User is authenticated; refresh token issued; `LastSeenAt` updated.
- **Main flow:**
  1. User enters username/email and password.
  2. System verifies the BCrypt hash.
  3. System issues access + refresh tokens and returns the profile.
  4. User is redirected to the dashboard.
- **Alternate flows:**
  * Alt 1 – Wrong credentials: system returns `401`; the user retries (step 1).
  * Alt 2 – Excessive attempts: the auth rate limit (10/min per IP) returns `429`.

### UC-03 · Sign in with Google
- **Primary actor:** New or returning student
- **Trigger:** User clicks "Sign in with Google".
- **Preconditions:** A Google identity is available.
- **Success guarantee:** User is authenticated (account created or linked); avatar populated if missing.
- **Main flow:**
  1. System validates the Google ID token server-side.
  2. **New user:** system creates an account with a generated unique username and an unusable random password hash.
  3. **Returning user:** system links the GoogleId to the existing account.
  4. System issues tokens and returns the profile.
- **Alternate flows:**
  * Alt 1 – Token invalid/expired: `400`/`401`; user re-tries Google sign-in.

### UC-04 · Refresh session
- **Primary actor:** Authenticated student
- **Trigger:** Access token expires and any API call returns `401`.
- **Preconditions:** Valid refresh token.
- **Success guarantee:** New access token issued; the user stays logged in (auto-login restoration).
- **Main flow:**
  1. Frontend detects `401`.
  2. Frontend sends the refresh token to `/api/auth/refresh`.
  3. System rotates the refresh token (30-day expiry) and returns a fresh access token.
  4. Frontend retries the original request.
- **Alternate flows:**
  * Alt 1 – Refresh token invalid/expired: `401`; user is logged out and sent to `/login`.

### UC-05 · Change password
- **Primary actor:** Authenticated student
- **Trigger:** User opens Account settings → Change password.
- **Preconditions:** User knows their current password.
- **Success guarantee:** The stored password hash is replaced.
- **Main flow:**
  1. User enters current password + new password (with confirmation), all client-validated.
  2. System verifies the current password; failure → `400`.
  3. System hashes and stores the new password; returns 204.
- **Alternate flows:**
  * Alt 1 – Confirmation mismatch: blocked client-side before submission.
  * Alt 2 – Validation failure: field-level errors; nothing changes.

## 2. Profile & Onboarding

### UC-06 · Complete/update profile
- **Primary actor:** Student
- **Trigger:** User opens Profile settings or responds to the "Complete Profile" reminder.
- **Preconditions:** Authenticated.
- **Success guarantee:** Profile saves; username uniqueness enforced; `/profile/:id` reflects changes.
- **Main flow:**
  1. User edits avatar (with client-side crop), first/last name, username, school, location, birth date, major, interests, bio.
  2. User saves.
  3. System trims/normalizes fields, coerces BirthDate to UTC, and enforces username uniqueness.
- **Alternate flows:**
  * Alt 1 – Username taken: `400`; the user picks another.

### UC-07 · View another user's profile
- **Primary actor:** Student
- **Trigger:** User navigates to `/profile/:id` (from a post, search, or presence dock).
- **Preconditions:** Authenticated.
- **Success guarantee:** Public profile with stats is displayed.
- **Main flow:**
  1. System returns the public profile + aggregate stats.
  2. Frontend renders avatar, name, bio, interests, and stats.

## 3. Dashboard

### UC-08 · Load dashboard
- **Primary actor:** Student
- **Trigger:** User opens `/dashboard`.
- **Preconditions:** Authenticated.
- **Success guarantee:** Dashboard shows status, XP card, recommendations, tools, and quick actions.
- **Main flow:**
  1. System returns statistics, gamification profile, and personalized recommendations.
  2. Frontend renders hero, levels ring / XP progress, milestone badges, entry cards (Flashcards, Games), and a recommendation list.
- **Alternate flows:**
  * Alt 1 – Incomplete profile: a "Complete Profile" banner is shown linking to settings.

## 4. Study Rooms

### UC-09 · Browse and search rooms
- **Primary actor:** Student
- **Trigger:** User opens `/rooms`.
- **Preconditions:** Authenticated.
- **Success guarantee:** Matching public rooms are listed.
- **Main flow:**
  1. User applies optional search text and subject filter.
  2. System returns rooms (name, subject, member count, previews).
  3. Frontend renders the list.

### UC-10 · Create a room
- **Primary actor:** Student
- **Trigger:** User opens `/rooms/create` or clicks "Create room".
- **Preconditions:** Authenticated.
- **Success guarantee:** Room exists; creator is the `host`; private rooms get a 6-char join code.
- **Main flow:**
  1. User enters name, subject, description, privacy.
  2. System validates (name required ≤100) and creates the room.
  3. System auto-adds the creator as `host`; if private, generates a join code.
  4. Creator is navigated into the new room.
- **Alternate flows:**
  * Alt 1 – Missing/blank name: blocked before submission.

### UC-11 · Join a room
- **Primary actor:** Student
- **Trigger:** User clicks Join on a room (or enters a join code for a private room).
- **Preconditions:** Authenticated; user not already a member.
- **Success guarantee:** Membership created; the user sees the room.
- **Main flow:**
  1. User requests to join.
  2. **Private:** user supplies the exact join code.
  3. System validates (code exact; no duplicate membership) and adds the member.
- **Alternate flows:**
  * Alt 1 – Wrong/absent join code: rejected; user is not joined.
  * Alt 2 – Already a member: rejected.

### UC-12 · Leave a room
- **Primary actor:** Room member
- **Trigger:** User clicks Leave in the room.
- **Preconditions:** Member of the room.
- **Success guarantee:** Membership removed.
- **Main flow:**
  1. User clicks Leave.
  2. System removes the membership.
- **Alternate flows:**
  * Alt 1 – Not a member: `400`.

### UC-13 · Manage room roles
- **Primary actor:** Room Host
- **Trigger:** Host opens the member list / Manage roles control.
- **Preconditions:** Caller is the room host.
- **Success guarantee:** Member role updated (`member`/`cohost`).
- **Main flow:**
  1. Host selects a member and a new role.
  2. System updates the role; hosts/co-hosts show the appropriate badge.
- **Alternate flows:**
  * Alt 1 – Non-host tries to change a role: `403`.
  * Alt 2 – Host attempts to change their own role: rejected.

### UC-14 · Update room
- **Primary actor:** Room Host / Co-host
- **Trigger:** Host (or co-host) edits room details.
- **Preconditions:** Caller is owner or co-host.
- **Success guarantee:** Room details updated.
- **Alternate flows:**
  * Alt 1 – Plain member: `403`.

### UC-15 · Delete room
- **Primary actor:** Room Host (owner)
- **Trigger:** Owner deletes the room.
- **Preconditions:** Caller is the owner.
- **Success guarantee:** Room removed.
- **Alternate flows:**
  * Alt 1 – Non-owner: `403`.

### UC-16 · Upload room background
- **Primary actor:** Room Host
- **Trigger:** Host selects an image in the room header.
- **Preconditions:** Owner; file valid.
- **Success guarantee:** Background applied.
- **Main flow:**
  1. Host uploads an image (≤5 MB, jpg/jpeg/png/webp).
  2. System stores the URL; the room background updates for everyone.
- **Alternate flows:**
  * Alt 1 – Invalid type/size: rejected.
  * Alt 2 – Non-owner: `403`.

### UC-17 · Copy room invite link
- **Primary actor:** Room member
- **Trigger:** Member clicks the share/invite-link button.
- **Preconditions:** Member of the room.
- **Success guarantee:** Shareable link copied to clipboard (join code embedded for private rooms).

## 5. Room Chat

### UC-18 · Send a room chat message
- **Primary actor:** Room member
- **Trigger:** User types a message in the room Chat tab.
- **Preconditions:** Member; connected over SignalR; content ≤2000 chars.
- **Success guarantee:** Message persisted and delivered to all online room members instantly.
- **Main flow:**
  1. User sends a message.
  2. Hub validates membership, persists the message, and broadcasts `ReceiveMessage` to the `room_{id}` group.
  3. All members' chat panes update in real time.
- **Alternate flows:**
  * Alt 1 – Empty/oversized content: blocked.

## 6. Focus Timer

### UC-19 · Start a focus session
- **Primary actor:** Room member
- **Trigger:** User starts the timer in the Focus tab (or quick-study).
- **Preconditions:** Member; the room has no in-progress session (an in-progress session for the room is resumed).
- **Success guarantee:** Timer runs; room sees the user as focusing; server schedules completion; the `sessionId` is returned for tab-switch reporting.
- **Main flow:**
  1. User starts with a chosen duration.
  2. System reuses the room's in-progress session (updating duration + start) **or** creates a fresh one; returns `sessionId`; schedules server-side completion; broadcasts `TimerStarted` + updates the "focusing" count.
  3. Frontend runs the countdown (breaks optional; auto-start-next toggle respected) and reports later tab switches against the `sessionId`.
- **Alternate flows:**
  * Alt 1 – Friends in the room: accepted friends present receive a "Someone you know is studying" notification.

### UC-20 · Complete a focus session
- **Primary actor:** Room member
- **Trigger:** Timer reaches zero or the user completes early.
- **Preconditions:** An active session for the room exists.
- **Success guarantee:** Session recorded exactly once, validated, and — if verified — rewarded (XP + milestones + calendar sync + notification).
- **Main flow:**
  1. System computes elapsed minutes and **claims the session atomically** (`Completed`, `DurationMinutes`, `IsVerified`, `AwardProcessed` set in one operation; concurrent duplicate requests/retries lose the race and get "no active session").
  2. Validation runs (duration bounds, minutes-aware daily cap, tab-switch round-trip allowance) → verified or not with a `VerifiedReason`.
  3. **If verified (and not already awarded):** milestones checked, XP awarded (1/min), one daily calendar event created/extended (auto-sync on), "Focus session complete" notification sent.
  4. `TimerCompleted` broadcast; streak/leaderboard/analytics refresh.
- **Alternate flows:**
  * Alt 1 – Invalid session (too long / too short / >600 verified min today / too many tab-switch round-trips): it still records, but earns no XP/badges/calendar entry and its stats are flagged unverified.
  * Alt 2 – Client closed mid-session: if older than 6 hours, the server auto-finalizes as unverified (`idle_timeout`) and notifies the user.
  * Alt 3 – Duplicate completion: a second complete (or pause/reset) for the same room finds nothing to finalize; nothing is awarded twice.

### UC-21 · Pause/reset/break
- **Primary actor:** Room member
- **Trigger:** User pauses, resets the timer, or starts a break.
- **Preconditions:** An active timer/session exists.
- **Success guarantee:** Timer state broadcast; active sessions finalized for pause/reset/break; break timer scheduled.
- **Main flow:**
  1. User triggers the action.
  2. System cancels the room's server timer; pause/reset **and break** pass the room's active focus session through the finalizer (validated + awarded once); breaks then schedule a new timer.
  3. `TimerPaused` / `TimerReset` / `TimerStarted` broadcast to the room.

### UC-22 · Add session notes
- **Primary actor:** Student (session owner)
- **Trigger:** User saves notes on a completed session.
- **Preconditions:** Session belongs to the user; ≤2000 chars.
- **Success guarantee:** `SessionNotes` stored on the session.

### UC-23 · View session trust score
- **Primary actor:** Student (session owner)
- **Trigger:** User inspects a session.
- **Preconditions:** Session belongs to the user.
- **Success guarantee:** Trust score (`max(30, 100 − 2 × roundTrips)`) and verification state shown.

## 7. Shared Notes

### UC-24 · Edit room notes (live collaboration)
- **Primary actor:** Room member
- **Trigger:** User types in the room Notes tab.
- **Preconditions:** Member.
- **Success guarantee:** Content auto-saved and broadcast to all members in real time; version snapshot recorded on change.
- **Main flow:**
  1. User edits; auto-save fires ~1s after idle.
  2. Frontend PUTs the content; system snapshots the previous content (only when different) with editor name/timestamp.
  3. SignalR broadcasts `NotesUpdated`; everyone's editor syncs.
- **Alternate flows:**
  * Alt 1 – Identical content: no version row is created.

### UC-25 · Restore a note version
- **Primary actor:** Room member
- **Trigger:** User opens History → Restore on a version.
- **Preconditions:** At least one version exists.
- **Success guarantee:** Note content replaced; everyone (via SignalR) sees the restored text.
- **Main flow:**
  1. User opens the History modal (versions newest-first: who + when + preview).
  2. User clicks Restore on a version.
  3. System rewrites the note content; frontend syncs via broadcast.
- **Alternate flows:**
  * Alt 1 – No versions yet: the modal shows an informational empty state.

### UC-26 · Export notes
- **Primary actor:** Room member
- **Trigger:** User clicks export in the Notes tab.
- **Preconditions:** Notes exist.
- **Success guarantee:** DOCX or PDF file downloads client-side.

## 8. Room Tasks

### UC-27 · Create a task
- **Primary actor:** Room member
- **Trigger:** User types a task in the room Tasks tab (optionally via the edit modal).
- **Preconditions:** Member; non-empty title.
- **Success guarantee:** Task appears in the list.
- **Main flow:**
  1. User enters a title (optionally description, assignee, due date) and saves.
  2. System resolves the assignee's display name and stores the task.
  3. List refreshes (open tasks first).

### UC-28 · Complete a task
- **Primary actor:** Room member
- **Trigger:** User toggles a task's checkbox.
- **Preconditions:** Member.
- **Success guarantee:** Task marked complete with `CompletedBy`/`CompletedAt`; progress bar updates.
- **Alternate flows:**
  * Alt 1 – Un-toggle: completion fields are cleared.

### UC-29 · Edit / assign / delete a task
- **Primary actor:** Room member
- **Trigger:** User opens a task's edit menu.
- **Preconditions:** Member.
- **Success guarantee:** Task updated (or removed). Overdue tasks are highlighted after their due date.

## 9. AI Assistant & Research

### UC-30 · Ask the academic assistant (chat mode)
- **Primary actor:** Student
- **Trigger:** User asks a question in the room AI tab or global assistant.
- **Preconditions:** Authenticated; AI reachable (or offline fallback).
- **Success guarantee:** A subject- and notes-context-aware answer is displayed with typing indicator and error safeguards.
- **Main flow:**
  1. User types (or clicks a suggested chip) and sends.
  2. System builds the prompt (subject + room notes + last 10 history messages).
  3. Gemini responds (with model fallback chain); frontend shows the answer; user can download as DOCX/PDF.
- **Alternate flows:**
  * Alt 1 – AI unavailable/timeout (120s client guard): a graceful fallback answer or retry prompt appears.
  * Alt 2 – Wrong question: user edits the question (regenerated) or retries.

### UC-31 · Research mode (guided paper building)
- **Primary actor:** Student
- **Trigger:** User enables Research mode and starts a new conversation.
- **Preconditions:** Authenticated.
- **Success guarantee:** Six-phase research outline produced with real paper references.
- **Main flow:**
  1. User creates a research conversation (subject, room, research mode).
  2. Assistant walks through Introduction → Problem Statement → Literature Review → Methodology → Expected Outcomes → Timeline, injecting real references from Semantic Scholar.
  3. User advances phases via "Continue to next phase"; each response shows references with "View paper" links.
- **Alternate flows:**
  * Alt 1 – Paper search fails: references degrade gracefully (empty), the outline still generated.

### UC-32 · Manage AI conversations
- **Primary actor:** Student
- **Trigger:** User opens the conversation side-bar.
- **Preconditions:** Authenticated; conversation owned by user.
- **Success guarantee:** User can list, load, delete, clear messages of, and start new conversations.
- **Alternate flows:**
  * Alt 1 – Not the owner: `404` (conversation hidden).

## 10. Flashcards

### UC-33 · Create and manage decks
- **Primary actor:** Student
- **Trigger:** User opens `/flashcards`.
- **Preconditions:** Authenticated.
- **Success guarantee:** Deck created (title required); user can edit/delete it.
- **Alternate flows:**
  * Alt 1 – Editing another user's deck: `404`.

### UC-34 · Study a deck (flip cards)
- **Primary actor:** Student
- **Trigger:** User clicks Study on a deck.
- **Preconditions:** Deck has cards.
- **Success guarantee:** 3D flip-card study view with navigation, position counter, and shuffle.
- **Main flow:**
  1. User taps a card to flip front/back.
  2. User navigates prev/next or shuffles the order.

### UC-35 · Generate flashcards with AI
- **Primary actor:** Student
- **Trigger:** User opens Generate with AI.
- **Preconditions:** Authenticated; source text provided.
- **Success guarantee:** A preview of AI-built cards (3–30) appears; user can save as a new deck.
- **Main flow:**
  1. User pastes lecture notes/outline (≤6000 chars) and optional focus; picks count (3–30).
  2. System generates and validates cards (dedupe + length caps).
  3. User previews and saves as a deck (title auto-suggested from focus/first line).
- **Alternate flows:**
  * Alt 1 – AI failure: error surfaced; user can retry (no deck created).

## 11. Educational Games

### UC-36 · Play an educational game
- **Primary actor:** Student
- **Trigger:** User opens `/games` and picks a game.
- **Preconditions:** Authenticated.
- **Success guarantee:** A playable round with scoring; best score tracked locally.
- **Main flow:**
  1. User selects a game (Quick Math, Word Scramble, Trivia Quiz, Memory Match, True/False Sprint, Flag Finder, Element Symbols).
  2. Game loads (built-in or AI-generated content).
  3. User plays; score computed; best score saved to `localStorage`.

### UC-37 · AI question generation for games
- **Primary actor:** Student
- **Trigger:** User enables "AI-generated questions" with a topic + difficulty and plays.
- **Preconditions:** AI reachable.
- **Success guarantee:** A fresh question set each play.
- **Main flow:**
  1. User picks topic + difficulty for Math/Scramble/Quiz/Memory/True-False.
  2. System generates content (schema-validated, counts clamped 1–30) and starts the game.
- **Alternate flows:**
  * Alt 1 – AI produces invalid content or fails: the game silently uses built-in questions.

## 12. Meetings & Video Rooms

### UC-38 · Schedule a meeting
- **Primary actor:** Room member
- **Trigger:** User clicks Schedule in the room header.
- **Preconditions:** Member.
- **Success guarantee:** Meeting created with attendees optionally RSVP'd.
- **Main flow:**
  1. User enters title (required), description, time, duration.
  2. System defaults duration to 60 if ≤0 and stores the meeting (organizer = creator).
- **Alternate flows:**
  * Alt 1 – Non-member: `403`.

### UC-39 · RSVP to a meeting
- **Primary actor:** Room member
- **Trigger:** User clicks Accept/Decline on a meeting.
- **Preconditions:** Member.
- **Success guarantee:** Attendance record upserted; accepted counts reflect it.
- **Alternate flows:**
  * Alt 1 – Invalid status value: rejected (only `Accepted`/`Declined` allowed).

### UC-40 · Update/delete a meeting
- **Primary actor:** Meeting Organizer (update/delete), Room Host/Co-host (delete)
- **Trigger:** User edits or deletes a meeting.
- **Success guarantee:** Meeting updated or removed.
- **Alternate flows:**
  * Alt 1 – Organizer update by non-organizer: `403`.
  * Alt 2 – Delete by non-organizer and not host/co-host: `403`.

### UC-41 · Join a video meeting room
- **Primary actor:** Room member (or guest with join code)
- **Trigger:** User opens the Meet tab / Start Call.
- **Preconditions:** Member, or guest with a valid join code.
- **Success guarantee:** A short-lived LiveKit token is issued and the user joins the room's video call.
- **Main flow:**
  1. System authorizes (membership or guest join code).
  2. System issues a LiveKit token (publish/subscribe for camera, mic, screen-share; creator flagged host).
  3. User joins the room; meeting starts.

### UC-42 · See other-rooms meetings (smart schedule)
- **Primary actor:** Student
- **Trigger:** User views the meetings list in a room.
- **Preconditions:** Authenticated.
- **Success guarantee:** Upcoming meetings from the user's OTHER rooms are surfaced as a heads-up so timings don't clash.

## 13. Peer Calls

### UC-43 · Start an outgoing call
- **Primary actor:** Student
- **Trigger:** User clicks the audio/video call button in a message thread or room header.
- **Preconditions:** Both parties online or reachable via push; only one ringing call per callee.
- **Success guarantee:** Callee gets an incoming-call screen (and web push if offline); ringing state is stored.
- **Main flow:**
  1. Caller picks audio or video.
  2. Hub stores the call state and rings the callee's `user_` group; a web push is always sent.
  3. Callee answers → SDP/ICE relayed; call connects.
- **Alternate flows:**
  * Alt 1 – Callee busy (already ringing): new ring rejected.
  * Alt 2 – Callee cold-starts from the push: offer/ICE are buffered (cap 50) and recovered via `GetCallOffer` / `GetCallIceCandidates`.

### UC-44 · Answer, decline, or cancel a call
- **Primary actor:** Callee (answer/decline), Caller (cancel)
- **Success guarantee:** Call state transitions; both peers notified (`CallAccepted`/`CallDeclined`/`CallCancelled`); decline/cancel send pushes.
- **Main flow:**
  1. Callee answers → `CallAccepted`, call becomes active.
  2. Or callee declines / caller cancels → call torn down with a status screen ("Call declined"/"Call ended").

### UC-45 · Manage an active call
- **Primary actor:** Both parties
- **Success guarantee:** Attendees control mute, camera, speaker, screen-off, and end the call; a timer tracks duration.
- **Alternate flows:**
  * Alt 1 – One party disconnects: the hub closes the call and notifies the peer (+ push).
  * Alt 2 – Receiver was offline: cold-start recovery (see UC-43).

## 14. Video Broadcast & Study Player

### UC-46 · Host a YouTube broadcast in a room
- **Primary actor:** Room Host
- **Trigger:** Host pastes a YouTube link in the Broadcast dialog.
- **Preconditions:** Host role; valid YouTube ID.
- **Success guarantee:** Video plays for every room member in sync (host excluded); state stored for resync.
- **Main flow:**
  1. Host pastes a URL; system validates the YouTube ID (watch/embed/shorts/live/youtu.be/bare ID).
  2. Host's play/pause/seek controls broadcast to others (echo-free).
  3. On reconnect, the current position is resynced to the member.
- **Alternate flows:**
  * Alt 1 – Invalid link: rejected with an error.
  * Alt 2 – Non-host tries to control/stop: ignored.

### UC-47 · Use the personal YouTube study player
- **Primary actor:** Student
- **Trigger:** User opens the study player from the floating dock.
- **Success guarantee:** User searches/pastes a video, queues songs, shuffles, and listens while the screen stays awake; collapses to a mini-pill.

## 15. Social Feed & Posts

### UC-48 · Create a post
- **Primary actor:** Student
- **Trigger:** User writes a post on the timeline (global or in a room).
- **Preconditions:** Content non-empty (or a shared post); room membership when posting to a room.
- **Success guarantee:** Post published (to friends for global; to the room group for room posts) and other users' feeds invalidate/refresh.
- **Main flow:**
  1. User writes and submits content.
  2. System stores the post and broadcasts `PostCreated` to the right audience.
  3. Friends'/room members' feeds update in real time.
- **Alternate flows:**
  * Alt 1 – Room post by non-member: `403`.
  * Alt 2 – Empty content and no shared post: rejected.

### UC-49 · Like a post
- **Primary actor:** Student
- **Trigger:** User clicks the heart on a post.
- **Preconditions:** Authenticated.
- **Success guarantee:** Like toggled on/off; reaction count updated everywhere.
- **Main flow:**
  1. User likes → `PostReaction` inserted, count +1.
  2. User un-likes → reaction removed, count −1.
  3. Counts broadcast (`PostStatsChanged`).

### UC-50 · Comment and reply
- **Primary actor:** Student
- **Trigger:** User comments on a post, or replies in a thread.
- **Preconditions:** Content non-empty; reply parent belongs to the same post.
- **Success guarantee:** Comment/reply stored, counts updated, and the post author (or parent-comment author) notified.
- **Main flow:**
  1. User submits a comment (or reply).
  2. System stores it (nested replies allowed), increments comment count, and notifies the target author (truncated to 120 chars; never self-notify).
- **Alternate flows:**
  * Alt 1 – Reply to a comment on a different post: rejected.

### UC-51 · Share a post
- **Primary actor:** Student
- **Trigger:** User clicks Share with a caption.
- **Success guarantee:** A new post referencing the original is created; clicking the shared card opens the original.

### UC-52 · Delete a post
- **Primary actor:** Student (author)
- **Trigger:** User deletes their post.
- **Success guarantee:** Post removed everywhere (feed caches invalidated, `PostDeleted` broadcast).
- **Alternate flows:**
  * Alt 1 – Non-author: `403`.

## 16. Friends & People

### UC-53 · Search users and view suggestions
- **Primary actor:** Student
- **Trigger:** User opens People → Discover and searches, or views suggestions.
- **Preconditions:** Authenticated.
- **Success guarantee:** Results show relationship status, mutual friends, shared rooms; suggestions ranked by profile affinity.
- **Main flow:**
  1. User types a query (1–100 chars) — or the system preloads suggestions.
  2. System scores/returns users; frontend shows inline Add/Accept actions.

### UC-54 · Send / accept / decline a friend request
- **Primary actor:** Student
- **Trigger:** User clicks Add Friend, or handles an incoming request.
- **Preconditions:** Valid target; not self; not already friends/pending.
- **Success guarantee:** Relationship transitions Pending → Accepted (or declined/cancelled); notifications sent; the user appears in the friends list.
- **Main flow:**
  1. Requester sends → `friend_request` notification to the addressee.
  2. Addressee accepts (`friend_accept` notification) or declines.
- **Alternate flows:**
  * Alt 1 – Already friends or pending: rejected as duplicates.
  * Alt 2 – Non-addressee tries to accept: `403`.

### UC-55 · Remove a friend / cancel a request
- **Primary actor:** Either party
- **Success guarantee:** Friendship removed, or pending request cancelled.

## 17. Direct Messages

### UC-56 · Open and read a conversation
- **Primary actor:** Student
- **Trigger:** User opens a thread in Messages (or receives a DM).
- **Preconditions:** Friends (DM-enabled) .
- **Success guarantee:** Thread displayed; messages marked read; unread counts update.
- **Main flow:**
  1. User opens a conversation.
  2. System returns the thread and marks it read; both clients reflect read state.

### UC-57 · Send a direct message
- **Primary actor:** Student
- **Trigger:** User types and sends in a thread.
- **Preconditions:** Receiver exists; not self; generally requires accepted friendship.
- **Success guarantee:** Message delivered real-time to both parties (+ push to receiver if offline).
- **Main flow:**
  1. User sends.
  2. Hub persists and broadcasts `ReceiveDirectMessage`; a "New message" push is queued.
- **Alternate flows:**
  * Alt 1 – Receiver offline: push notification delivered; stale-message reminder may later fire if unread >12h.

### UC-58 · Delete a direct message
- **Primary actor:** Student (sender)
- **Trigger:** User deletes one of their own messages.
- **Success guarantee:** Message removed for both participants (`MessageDeleted` broadcast).
- **Alternate flows:**
  * Alt 1 – Non-sender: `403`.

### UC-59 · Call from a conversation
- **Primary actor:** Student
- **Trigger:** User clicks the audio/video call button in a thread header.
- **Success guarantee:** Standard call flow started (see UC-43).

## 18. Notifications & Push

### UC-60 · View and manage notifications
- **Primary actor:** Student
- **Trigger:** User opens `/notifications`.
- **Preconditions:** Authenticated.
- **Success guarantee:** Feed with unread highlighting; single-mark-read and mark-all-read work; clicking navigates to the relevant page/profile.
- **Main flow:**
  1. Feed lists the user's notifications (default 50).
  2. User marks a single or all as read.
  3. User clicks an item → deep link opens.

### UC-61 · Subscribe to web push
- **Primary actor:** Student
- **Trigger:** User grants notification permission in Notification settings.
- **Preconditions:** Browser supports push; valid subscription fields.
- **Success guarantee:** Endpoint registered (VAPID keys server-side); the user receives desktop notifications.
- **Main flow:**
  1. Frontend requests permission and registers the service-worker subscription.
  2. System stores the subscription (requires endpoint + p256dh + auth).
- **Alternate flows:**
  * Alt 1 – Invalid payload: `400`.
  * Alt 2 – Endpoint dead (410/404): subscription automatically pruned.

## 19. Room Invitations

### UC-62 · Invite someone to a room
- **Primary actor:** Room member
- **Trigger:** User invites a friend via the room's invite control.
- **Preconditions:** Inviter is a member; invitee not already a member; no duplicate pending invite.
- **Success guarantee:** Invitation pending; invitee notified.
- **Alternate flows:**
  * Alt 1 – Invitee already a member: rejected.
  * Alt 2 – Duplicate pending invite: rejected.

### UC-63 · Accept/decline/cancel an invitation
- **Primary actor:** Invitee (accept/decline), Inviter (cancel)
- **Success guarantee:** Accept adds the invitee as a room member (and notifies); decline/cancel remove the invitation.
- **Main flow:**
  1. Invitee accepts → membership created → navigated into the room.
  2. Or invitee declines / inviter cancels.
- **Alternate flows:**
  * Alt 1 – Wrong user acts on the invite: `403`.

## 20. Presence

### UC-64 · See who's online and studying
- **Primary actor:** Student
- **Trigger:** User opens the presence dock or views People/Messages.
- **Preconditions:** Authenticated; connection active.
- **Success guarantee:** The dock shows a live count of people studying now; expanding shows who's online and in which room; online dots/last-seen show everywhere.
- **Main flow:**
  1. Hub tracks per-user connection counts (multi-tab safe).
  2. Dock / lists render online state; clicking an avatar opens their profile or jumps into their room.

## 21. Analytics & Statistics

### UC-65 · View study analytics
- **Primary actor:** Student
- **Trigger:** User opens `/analytics`.
- **Preconditions:** Authenticated.
- **Success guarantee:** Overview cards, room breakdown, daily trend (30 days), hourly distribution, and weekly-goal tracking are rendered from verified sessions only.
- **Main flow:**
  1. User selects a view/range (trend days clamped 7–90; recent sessions limited 1–50).
  2. System aggregates verified sessions and renders charts.

### UC-66 · Set a weekly goal
- **Primary actor:** Student
- **Trigger:** User saves a weekly target.
- **Success guarantee:** Goal stored keyed to ISO week; actual minutes recomputed from the week's start.

### UC-67 · Export study data
- **Primary actor:** Student
- **Trigger:** User clicks Export (CSV or JSON).
- **Preconditions:** Authenticated.
- **Success guarantee:** File download of completed/verified sessions over the last 90 days.

## 22. Gamification & Leaderboards

### UC-68 · Earn XP and level up
- **Primary actor:** Student
- **Trigger:** Session completes verified (focus time).
- **Success guarantee:** XP ledger updated (1/min, min 1); level computed from the curve; progress displayed on dashboard/profile.
- **Main flow:**
  1. Verified completion awards XP.
  2. Frontend refreshes the gamification profile (level, XP-into-level, next-level need).
- **Alternate flows:**
  * Alt 1 – Unverified session: no XP.

### UC-69 · Earn milestone badges
- **Primary actor:** Student
- **Trigger:** A milestone threshold is crossed on verified completion.
- **Success guarantee:** New badge awarded once (streak 7/14/30/60/100, sessions 10/50/100/500, hours 10/50/100/500/1000) and shown on profile/dashboard.
- **Main flow:**
  1. Post-completion, the system derives totals and awards any newly-qualifying badges (idempotent).
  2. Badge count updates in the gamification profile.

### UC-70 · View room leaderboard
- **Primary actor:** Room member
- **Trigger:** User views the room's leaderboard/weekly stats.
- **Preconditions:** Member.
- **Success guarantee:** Ranking by verified minutes/sessions/streak with podium + collective-groups goal progress.

### UC-71 · View friends leaderboard
- **Primary actor:** Student
- **Trigger:** User opens People → Leaderboard.
- **Preconditions:** Authenticated.
- **Success guarantee:** Self + accepted friends ranked weekly XP (then total XP), with medals, levels, streaks, minutes, XP bars.
- **Main flow:**
  1. System computes weekly XP across friends + self.
  2. Frontend renders rankings (take clamp 1–100) with the caller always included.

## 23. Calendar Integration

### UC-72 · Connect Google Calendar / Outlook
- **Primary actor:** Student
- **Trigger:** User opens Calendar settings → Connect.
- **Preconditions:** OAuth consent granted.
- **Success guarantee:** Provider connection stored (tokens + auto-sync default on).
- **Main flow:**
  1. System builds the provider OAuth URL (calendar scopes, offline access).
  2. User authorizes; callback exchanges the code for tokens; connection saved.
- **Alternate flows:**
  * Alt 1 – Code exchange fails: error returned; no connection stored.

### UC-73 · Auto-sync study events
- **Primary actor:** Student
- **Trigger:** A verified session completes (system-side), or user clicks Sync Now.
- **Preconditions:** At least one auto-sync connection.
- **Success guarantee:** One study event (transparent/free) exists per connected calendar **per day**; a later session the same day **extends** (PATCHes) the event's end time rather than duplicating; expired tokens refreshed first.
- **Main flow:**
  1. On completion the system loops active connections and refreshes tokens expiring within 5 min.
  2. For each provider it looks up the day's `CalendarStudyEvents` marker: if present, PATCH the event end time; if absent, create the event and store the marker.
- **Alternate flows:**
  * Alt 1 – One provider fails: logged; other providers still complete.
  * Alt 2 – Manual Sync Now: creates a standalone event from the request (title/description passthrough, no aggregation).

### UC-74 · Disconnect a calendar
- **Primary actor:** Student
- **Trigger:** User clicks Disconnect.
- **Success guarantee:** Connection removed; sync stops.

## 24. Settings & Personalization

### UC-75 · Manage notification preferences
- **Primary actor:** Student
- **Trigger:** User edits Notification settings.
- **Success guarantee:** Desktop permission, sound (type/volume/test), previews, quiet hours, and per-event toggles are persisted and honored by the notification service.
- **Main flow:**
  1. User configures preferences.
  2. In-app and push notifications respect sound/quiet-hours/per-event toggles.

### UC-76 · Customize appearance
- **Primary actor:** Student
- **Trigger:** User edits Appearance settings.
- **Success guarantee:** Theme (light/system/dark), accent color (presets/custom), corner style, text size, font, compact mode, reduce motion, and high contrast apply across the app and persist.

### UC-77 · Set study preferences
- **Primary actor:** Student
- **Trigger:** User edits Study settings.
- **Success guarantee:** Focus duration, break duration, daily goal (10–720 clamp), and auto-start-next are saved and used by the timer/dashboard.

### UC-78 · Manage account security
- **Primary actor:** Student
- **Trigger:** User opens Account settings.
- **Success guarantee:** Email/role/online status visible (auto-refreshing) and password change flow works (UC-05).

## 25. Realtime Sequences (SignalR)

Listed as sequence-level guarantees that power the realtime features above.

### UC-79 · Join a room connection
- **Primary actor:** Room member
- **Trigger:** A member opens/closes a room (or the app reconnects).
- **Success guarantee:**
  1. On join: membership group added, presence registered, `UserJoined` + online list broadcast, and any active YouTube broadcast is resynced.
  2. On disconnect: presence decremented (multi-tab aware), `LastSeenAt` updated, focus tracking cleaned, active calls closed (+ peer/push notified), broadcasts resynced.

### UC-80 · Timer/broadcast realtime fan-out
- **Primary actor:** Any member (timers), Host (broadcast)
- **Success guarantee:** Timer start/pause/reset/complete and focus counts broadcast to the room; host-only video broadcast/control/stop rules enforced; reconnect resync guaranteed.

### UC-81 · Admin creates a notification
- **Primary actor:** Admin
- **Trigger:** Admin broadcasts a message to any user.
- **Preconditions:** Caller role is `Admin`.
- **Success guarantee:** A notification row is created for the target user and fanned out (SignalR + web push).
- **Main flow:**
  1. Admin POSTs `/api/notifications` (type/title/body/recipient).
  2. System authorizes the `Admin` role — any non-admin caller gets `403` and nothing is created (the frontend never calls this endpoint).
  3. Notification created and fanned out to `user_{id}`.

### UC-82 · Receive timezone-aware reminders
- **Primary actor:** User / Room host
- **Trigger:** A scheduled delivery moment arrives.
- **Preconditions:** A `TimeZoneId` is stored on the profile (browser-detected IANA id; fallback UTC); notification preferences allow the type.
- **Success guarantee:** Daily nudge, room-quiet alerts, schedule reminders, and the weekly summary arrive at the correct **local** wall-clock time for the user (or room host), regardless of where the servers run.
- **Main flow:**
  1. Profile save persists the browser-detected time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`) via `UpdateProfileDto`.
  2. The hourly sweep computes "now" in that zone: the daily nudge fires at local 20:00 (no verified session yet today), schedule reminders 30 min before preferred windows, and quiet-room alerts at the host's local 0/6/12/18.
  3. The weekly summary fires at the user's local Sunday 20:00 and is guarded against duplicates (no `weekly_summary` notification in the last 24h).
- **Alternate flows:**
  * Alt 1 – Missing/invalid `TimeZoneId`: falls back to UTC (delivery may then occur at UTC wall clock).

### UC-83 · Browse a top-level page (consistent hero header)
- **Primary actor:** User
- **Trigger:** User opens any main page (Timeline, People, Analytics, Flashcards, Games, Messages, Invitations, Notifications, Settings).
- **Preconditions:** Authenticated.
- **Success guarantee:** The page renders the shared `app-hero-card` (gradient: title + subtitle + optional action + stat badges) matching Dashboard and Study Rooms.
- **Main flow:**
  1. Router activates the page.
  2. The shared hero renders the page title/subtitle; page-specific action buttons (e.g. Analytics CSV/JSON export, Notifications "Mark all as read") project into the action slot; dynamic stats (posts, friends, decks, games, unread counts…) appear as badges.
- **Alternate flows:**
  * Alt 1 – No dynamic data yet: badges show zero/empty counts while data loads.

---

*Extracted from a full codebase scan of the StudyRoom solution. Cross-referenced with `USER_STORIES.md` and `BUSINESS_RULES.md`.*