# Media Feature Safety Checklist

Reference for building media-related features (study player, movies, watch-links,
user uploads) without turning the app into a piracy hub or an abuse target.

## Audit status (2026-08-17)

- [x] Media endpoints behind `[Authorize]` — verified: `YoutubeController`,
      `UsersController`, `PostsController`.
- [x] No raw stream endpoints — verified: no `.mp4`/`.m3u8` serving anywhere;
      no upload/static-file endpoints exist.
- [x] YouTube URL allow-list — verified: frontend `extractYouTubeId` accepts only
      `youtube.com` / `youtu.be` patterns or bare 11-char IDs.
- [x] Official embed only — verified: player uses YouTube IFrame API.
- [x] Rate limiting — **added** per-user "search" policy (30/min), applied to
      `YoutubeController` and `UsersController`; auth endpoints keep the existing
      per-IP "auth" policy (10/min).
- [x] Input validation — verified/added: YouTube query length (≤120) and
      `maxResults` clamp; added user-search query guard (≤100).
- [x] No API keys in frontend — verified: keys only in server config/env
      (`YOUTUBE_API_KEY`).

## Rules (non-negotiable)

1. **Never host or embed unlicensed content.** The site links out and embeds
   official players only. No "paste any .mp4/.m3u8 URL" feature, no scraping of
   other sites' streams, no DRM circumvention.
2. **Embed only official players.** Current example: the study player embeds
   YouTube's IFrame player (`YoutubePlayerComponent`), never re-hosts the video.
   Keep every future embed on the same pattern.
3. **Content search must use licensed/legal data sources** (e.g., TMDB for
   metadata; official availability/affiliate sources for "where to watch").

## Backend / API checklist

- [ ] Media endpoints are behind `[Authorize]` (same as `PostsController` /
      `YoutubeController`).
- [ ] No endpoint returns raw stream URLs to anonymous callers.
- [ ] User-provided URLs are validated to a known allow-list of domains (e.g.,
      only `youtube.com` / `youtu.be` IDs are extracted and re-encoded).
- [ ] Rate limiting on any search/query endpoint (prevents catalog scraping).
- [ ] Input length + shape validated (`CreatePostDto`-style DTOs, not free-form).

## Uploads / file serving checklist (only if we ever add uploads)

- [ ] Require auth for upload and download.
- [ ] Serve files via short-lived, signed URLs (e.g., Azure SAS-style tokens).
- [ ] File-type sniffing + extension allow-list; scan executables; no `.html`
      served inline (prevents stored XSS via upload).
- [ ] Per-user watermark if we ever deliver premium video.

## Frontend checklist

- [ ] Player embed uses the official `<iframe>` / IFrame API with a fixed
      `origin` and no arbitrary URL injection.
- [ ] "Where to watch" features open the platform app/site via deep links, never
      play the content inline.
- [ ] No feature accepts an arbitrary stream URL as a playable source.
- [ ] Keep API keys in server-side config (e.g., `YOUTUBE_API_KEY`), never in
      the frontend bundle.

## Review trigger

Any new feature that plays, links to, or uploads media should be checked against
this list before merging. If in doubt about licensing, link out instead of
playing in.