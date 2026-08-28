# StudyRoom — User Stories

> **Maintenance convention:** every new feature updates **all three** specification artifacts: user stories (this file), business rules (`BUSINESS_RULES.md`), and use cases (`USE_CASES.md`). See the use-case template in `USE_CASES.md`.

This document catalogs the product capabilities of StudyRoom (a collaborative online study platform) as user stories, generated from a full scan of the codebase (ASP.NET Core API + SignalR + PostgreSQL backend, Angular frontend).

Story groups:
[1. Authentication](#1-authentication--account) · [2. Profile & Onboarding](#2-profile--onboarding) · [3. Dashboard](#3-dashboard) · [4. Study Rooms](#4-study-rooms) · [5. Room Chat](#5-room-chat) · [6. Focus Timer](#6-focus-timer) · [7. Shared Notes](#7-shared-notes) · [8. Room Tasks](#8-room-tasks) · [9. AI Assistant & Research](#9-ai-assistant--research) · [10. Flashcards](#10-flashcards) · [11. Educational Games](#11-educational-games) · [12. Meetings](#12-meetings) · [13. Peer Calls](#13-peer-calls) · [14. Video & Study Player](#14-video--study-player) · [15. Social Feed](#15-social-feed) · [16. Friends & People](#16-friends--people) · [17. Direct Messages](#17-direct-messages) · [18. Notifications](#18-notifications) · [19. Room Invitations](#19-room-invitations) · [20. Presence](#20-presence) · [21. Analytics](#21-analytics) · [22. Gamification](#22-gamification) · [23. Leaderboards](#23-leaderboards) · [24. Calendar](#24-calendar) · [25. Nudges & Summaries](#25-nudges--summaries) · [26. Settings](#26-settings) · [27. Global Shell](#27-global-shell)

---

## 1. Authentication & Account

- As a new student, I want to **register with a username and password** so that I can create an account and start using StudyRoom.
- As a returning student, I want to **log in with my username or email and password** so that I can access my study rooms and data.
- As a user, I want to **sign in with my Google account** so that I can skip registration and log in with one click.
- As a user, I want my session to stay alive via a **refresh token** so that I am not logged out while studying.
- As a user, I want to **change my password** (by confirming my current password) so that I can keep my account secure.
- As a user, I want **automated login restoration on page reload** so that I don't have to sign in repeatedly.
- As an administrator, I want **rate limiting on authentication endpoints** so that the app is protected against brute-force attacks.

## 2. Profile & Onboarding

- As a user, I want to **set up my public profile** (avatar, first/last name, username, school, location, birth date, major, interests, bio) so that others can learn about me.
- As a user, I want a **"Complete Profile" reminder banner** when my profile is incomplete so that I know what to fill in.
- As a user, I want a **client-side image cropper for my profile picture** so that I can upload a well-framed avatar.
- As a visitor, I want to **view any user's public profile** (avatar, bio, interests, stats) so that I can decide whether to connect with them.

## 3. Dashboard

- As a user, I want a **personalized home dashboard** so that I can see my status at a glance.
- As a user, I want a **welcome/hero section** that makes it easy to start a study session.
- As a user, I want **quick links to create/open rooms** so that I can start studying with minimal clicks.
- As a user, I want to see my **XP, level ring, and progress toward the next level** so that I feel motivated.
- As a user, I want **entry cards for Flashcards and Games** so that I can jump straight into studying tools.
- As a user, I want **personalized recommendations** (e.g., protect your streak, hit your daily goal, join a room, lower/raise your goal, start a Pomodoro) so that I know what to do next.

## 4. Study Rooms

- As a user, I want to **browse and search public study rooms** (by name and subject) so that I can find study groups that match my interests.
- As a user, I want to **create a study room** (name, subject, description, privacy setting) so that I can invite people to study together.
- As a user, I want to **make my room private with a join code** so that only invited people can join.
- As a user, I want to **join a room**, including **with a join code for private rooms**, so that I can participate in a study group.
- As a user, I want to **leave a room** so that I can stop participating.
- As a room creator, I want to **assign co-host roles to members** so that I can share moderation duties.
- As a room host/co-host, I want to **edit the room** (name, description, subject) so that the room stays up to date.
- As the room owner, I want to **delete the room** so that I can remove a space I no longer need.
- As a room host, I want to **upload a background image** so that the room feels personal.
- As a room host, I want to **copy an invite link** so that I can bring people in easily.
- As a room host, I want to **manage member roles** and see host/co-host badges so that responsibilities are clear.

## 5. Room Chat

- As a room member, I want to **send and receive messages in real time** so that I can coordinate with study partners.
- As a room member, I want chat to appear **instantly via live updates** so that I don't have to refresh.
- As a room member, I want to see **who wrote each message** (avatar + name) so that the conversation is clear.

## 6. Focus Timer

- As a user, I want a **Pomodoro-style focus timer** with configurable focus and break durations so that I can study in structured intervals.
- As a user, I want to **start, pause, complete, and reset** my focus session so that I control my flow.
- As a user, I want to **auto-select long breaks** and **auto-start the next session** so that I can run a hands-free Pomodoro cycle.
- As a room member, I want to **see who else in the room is focusing right now** (live "focusing" counter) so that I feel part of a collective effort.
- As a user, I want my completed focus sessions to be **recorded and count toward my study statistics** so that my effort is tracked.
- As a user, I want to **add notes to a completed session** so that I can remember what I covered.
- As a user, I want focus sessions to be **validated as "verified"** (reasonable duration, not too many sessions, not too many tab switches) so that my stats are honest.
- As a user, I want a **trust score per session** (decreased by tab-switching) so that I can understand how my focus quality is assessed.
- As a user, I want sessions that run when the app is closed to be **auto-finalized by the server** so that I still get credit when I actually studied.

## 7. Shared Notes

- As a room member, I want a **shared notes editor** for the room so that everyone can contribute to one document.
- As a user, I want notes to **auto-save** so that I never lose my work.
- As a user, I want notes to **update live for everyone in the room** so that we collaborate in real time.
- As a user, I want **Markdown support** in the notes so that I can format them richly.
- As a user, I want to **see the version history** of a note (who edited, when) so that I can review changes.
- As a user, I want to **restore an earlier version of a note** so that I can undo bad edits.
- As a user, I want to **export notes to DOCX or PDF** so that I can save or share them outside the app.
- As a user, I want the **AI assistant to use the room notes as context** so that answers are personalized to my study material.

## 8. Room Tasks

- As a room member, I want a **shared to-do list for the room** so that we can manage study goals together.
- As a room member, I want to **create, edit, and delete tasks** so that the list stays accurate.
- As a room member, I want to **check tasks off** (and see overall completion progress) so that progress is visible.
- As a room member, I want to **assign tasks to specific members** so that responsibilities are clear.
- As a room member, I want to **set due dates** (with overdue highlighting) so that deadlines are not missed.

## 9. AI Assistant & Research

- As a user, I want an **AI study assistant** that answers academic questions (subject-aware, room-notes-aware) so that I can learn faster.
- As a user, I want the assistant to have **Chat and Research modes** so that I can either ask freely or build a paper step by step.
- As a user, I want **guided research phases** (Introduction → Problem Statement → Literature Review → Methodology → Expected Outcomes → Timeline) with a progress bar so that a paper outline is built methodically.
- As a user, I want the research mode to **pull real academic paper references** (title, authors, year, venue, links) so that I can cite real sources.
- As a user, I want **suggested question chips** and a welcoming screen so that I know how to start.
- As a user, I want to **edit my questions and retry** when an answer fails so that I can recover from AI hiccups.
- As a user, I want **conversation history** (list, reload, delete, clear, start new) so that I can return to past sessions.
- As a user, I want to **download long answers as DOCX or PDF** so that I can keep them offline.
- As a user, I want a **global assistant** available from anywhere in the app so that I can ask questions without navigating.
- As a user, I want **offline fallback answers** when the AI is unavailable so that the assistant never leaves me empty-handed.
- As a user, I want the assistant to **research academic topics** (paper search, proposals, paper details by URL) so that I can prepare for projects.

## 10. Flashcards

- As a user, I want to **create and manage flashcard decks** (title, description) so that I can build study materials.
- As a user, I want to **add, edit, remove, and reorder cards** (front/back) so that my decks are correct.
- As a user, I want a **study/flip-card view** (tap to flip, next/previous, position counter, shuffle) so that I can drill myself.
- As a user, I want to **generate flashcards with AI from my lecture notes or outline** (preview, then save as a deck) so that I can create materials fast.

## 11. Educational Games

- As a user, I want to play **educational mini-games** to reinforce learning:
  - **Quick Math** (60-second arithmetic sprint with story problems) — I want to improve mental math speed.
  - **Word Scramble** — I want to improve vocabulary by unscrambling words.
  - **Trivia Quiz** (10 multiple-choice, general knowledge) — I want to test general knowledge.
  - **Memory Match** (match terms to definitions) — I want to memorize concepts.
  - **True/False Sprint** (timed fact checks) — I want to test knowledge quickly.
  - **Flag Finder** (identify countries by flag) — I want to learn geography.
  - **Element Symbols** (match elements to chemical symbols) — I want to drill chemistry.
- As a user, I want each game to **track my best score locally** so that I can try to beat myself.
- As a user, I want an **AI-generated questions mode** (pick a topic + difficulty; fresh questions each play, with built-in fallback) so that gameplay never gets stale.

## 12. Meetings

- As a room member, I want to **schedule meetings** (title, description, time, duration) so that group study sessions are planned.
- As a room member, I want to **view the room's meeting list** so that I know what's coming up.
- As a meeting organizer, I want to **update or delete a meeting** so that plans can change.
- As a room host/co-host, I want to **delete any meeting** so that I can moderate the room schedule.
- As a room member, I want to **RSVP (accept/decline) a meeting** so that organizers can plan attendance.
- As a user, I want **meetings from my other rooms** surfaced as a heads-up so that I don't double-book my time.
- As a room member, I want to **join a video meeting room** so that I can study face-to-face with the group.

## 13. Peer Calls

- As a user, I want to **start audio or video calls** with friends (from Direct Messages and room headers) so that we can talk live.
- As a user, I want an **incoming call screen** (caller info + Answer/Decline) so that I can choose whether to join.
- As a user, I want **push notification for incoming calls** so that I'm alerted even if the app is closed and can recover the call afterward.
- As a caller, I want to **cancel an outgoing call** so that I can back out.
- As a user in a call, I want **mute, camera on/off, speaker, screen-off, and end-call** controls with a call timer so that I can manage the conversation.
- As a user, I want to know when a call is **declined or ended** so that the status is unambiguous.

## 14. Video & Study Player

- As a room host, I want to **broadcast a YouTube video to the whole room** (play/pause/seek synced to others) so that we can watch lectures together.
- As a room host, I want to **start/stop the broadcast and switch videos** so that I control the shared screen.
- As a viewer, I want the **broadcast to resync on reconnect** so that I never lose the position.
- As a user, I want a **YouTube study-music player** (search YouTube or paste a link; queue, shuffle, enqueue) so that I can listen while studying.
- As a user, I want the study player to **keep the screen awake while playing** so that my device doesn't sleep mid-session.
- As a user, I want the player to **collapse to a mini-pill** so that it doesn't block my work.

## 15. Social Feed

- As a user, I want a **timeline feed** of posts from me and my friends so that I can follow what people are studying.
- As a user, I want to **create posts** (or share existing posts with a caption) so that I can share milestones and questions.
- As a user, I want to **like/unlike posts** and see reaction counts so that I can engage with content.
- As a user, I want to **comment on posts and reply in threads** so that conversations happen around content.
- As a user, I want to **delete my own posts** so that I can take things down.
- As a user, I want **room-scoped posts** visible only to room members so that study groups have private feed space.
- As a user, I want the feed to **update in real time** (new posts, like/comment counts) so that the timeline stays fresh.
- As a user, I want to **be notified when someone comments** on my post or reply so that I can respond.

## 16. Friends & People

- As a user, I want to **search for people** (with shared rooms, mutual friends, and relationship status) so that I can find classmates.
- As a user, I want **smart suggestions** ("people you may know" scored by mutual friends, school, location, major, interests, shared rooms) so that I can grow my network.
- As a user, I want to **send, accept, decline, and cancel friend requests** so that I control my connections.
- As a user, I want to **remove a friend** so that I can curate my circle.
- As a user, I want to see **online status / last-seen** on friends so that I know when to reach out.
- As a user, I want a **Discover / Friends / Leaderboard** page layout so that I can browse people, manage requests, and see rankings in one place.

## 17. Direct Messages

- As a user, I want **private one-to-one conversations** with friends so that I can talk outside a room.
- As a user, I want a **two-pane messenger** (conversation list + thread) with unread counts so that messages are easy to manage.
- As a user, I want to **delete my own messages** so that I can remove mistakes.
- As a user, I want **real-time message delivery** and read state so that conversations feel instant.
- As a user, I want to **start an audio/video call from a conversation header** so that chat can escalate to a call.
- As a user, I want a **pinned AI Assistant conversation** in my message list so that I can chat with the assistant from one place.
- As a user, I want **"message waiting" reminders** for unread messages older than 12 hours so that I don't miss important replies.

## 18. Notifications

- As a user, I want an **in-app notification feed** (friend requests, room invites, comments, timer events, nudges, summaries, messages) so that nothing slips by.
- As a user, I want **unread counts** (badges on the navbar, dots on items) so that I can see what needs attention.
- As a user, I want to **mark a notification read or mark all read** so that I can clear my queue.
- As a user, I want clicking a notification to **open the relevant page/profile** so that I can act on it.
- As a user, I want **desktop/Web Push notifications** (with per-event toggles, sound, and quiet hours) so that I'm productive even when the tab is in the background.

## 19. Room Invitations

- As a room member, I want to **invite a friend to a room** so that they can join my study group.
- As a user, I want to see **pending room invitations** (room name, subject, inviter, time) so that I can decide whether to accept.
- As a user, I want to **accept or decline** an invitation (accepting navigates into the room) so that I control my memberships.
- As an inviter, I want to **cancel an invitation** so that I can retract it.

## 20. Presence

- As a user, I want to see who is **online and in which room** via a floating presence dock so that I can find study partners.
- As a user, I want the dock to show a **live count of people studying now** so that I know the app is active.
- As a user, I want to **jump into a friend's room or visit their profile** from the dock so that connecting is one click.
- As a user, I want my **own online status to update automatically** (multi-tab aware) so that friends see me correctly.

## 21. Analytics

- As a user, I want an **analytics dashboard** so that I can understand my study habits.
- As a user, I want **overview statistics** (total time, sessions, average session, current + longest streak, peak time of day, week-over-week change, active days) so that I can evaluate progress.
- As a user, I want to see **study time by room**, **daily trends**, and **hourly distribution** so that I can spot patterns.
- As a user, I want **weekly goal tracking** (set a target, progress vs. actual) so that I can plan my workload.
- As a user, I want to **export my study data as CSV or JSON** so that I can analyze it elsewhere.
- As a user, I want a **recent-sessions/activity feed** of completed verified sessions and earned milestones so that I can reflect on achievements.

## 22. Gamification

- As a user, I want to **earn XP for verified focus minutes** (1 XP per minute) so that my studying is rewarded.
- As a user, I want **levels** with a clear curve and progress toward the next level so that I have long-term goals.
- As a user, I want **streaks** (consecutive days studied, forgiving of today/yesterday) so that I build consistent habits.
- As a user, I want **milestone badges** for streaks (7/14/30/60/100 days), sessions (10/50/100/500), and total verified hours (10/50/100/500/1000) so that I earn recognition.
- As a user, I want to **see my badges on my profile and dashboard** so that achievements are visible.
- As a user, I want my **weekly XP and minutes** tracked so that I can gauge my current week.

## 23. Leaderboards

- As a user, I want a **room leaderboard** ranked by verified study minutes, sessions, and streak so that I can compete with my room.
- As a user, I want a **friends leaderboard** ranked by weekly XP (with levels, streaks, minutes, medals for the top 3) so that friendly competition motivates me.
- As a user, I want to **see my own rank included** in the friend leaderboard even when I'm not in the top so that I know where I stand.

## 24. Calendar

- As a user, I want to **connect my Google Calendar or Microsoft Outlook** so that study events appear in my agenda.
- As a user, I want **completed focus sessions automatically added to my connected calendar** (with auto-sync toggle) so that my schedule stays accurate without manual work.
- As a user, I want a **manual sync button** so that I can push records on demand.
- As a user, I want to **disconnect a calendar** so that I can revoke access.

## 25. Nudges & Summaries

- As a user, I want a **daily nudge** (at 8 PM if I haven't studied) personalized to my streak/goal status so that I don't break momentum.
- As a room host, I want **quiet-room alerts** when my room has had no study activity in 24 hours so that I can revive the group.
- As a user, I want **accountability-partner suggestions** (weekly pairing of active, non-friends sharing a room) so that I can study with someone.
- As a user, I want **schedule reminders** before my preferred study windows so that I start on time.
- As a user, I want a **weekly summary** (verified minutes, sessions, streak, most-active room) every Sunday evening so that I can review my week.

## 26. Settings

- As a user, I want to manage my **profile settings** (avatar, name, school, bio, interests, etc.) so that my identity is accurate.
- As a user, I want to manage my **account settings** (email, role, online status, change password) so that my account is safe.
- As a user, I want to customize **appearance** (light/system/dark theme, accent color, corner style, text size, font, compact mode, reduce motion, high contrast) so that the app fits my preferences.
- As a user, I want to configure **notifications** (desktop permission, sound type/volume, previews, quiet hours, per-event toggles) so that I control interruptions.
- As a user, I want to set my **study preferences** (focus/break duration, daily goal minutes, auto-start next session) so that the timer fits my workflow.
- As a user, I want to manage my **calendar connections** so that integrations stay under my control.

## 27. Global Shell

- As a user, I want a **fixed navigation bar** (Dashboard, Rooms, Timeline, People, Notifications, Invitations, Messages, Games, Settings) with unread badges so that I can move around easily.
- As a user, I want a **command palette (Ctrl/Cmd+K)** that jumps to any page or room so that I can navigate fast.
- As a user, I want a **global AI assistant button** in the navbar so that help is always one click away.
- As a user, I want **desktop notifications handled via a service worker** so that alerts work even in the background.
- As a user, I want the interface to be **responsive** (mobile tab bars, single-pane messaging, floating docks) so that I can use StudyRoom on any device.

---

*Generated from a full codebase scan of the StudyRoom solution. Endpoint, service, and component details were verified against the backend API/controllers/services/hub and the Angular frontend pages/components/services.*