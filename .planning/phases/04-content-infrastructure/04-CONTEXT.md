# Phase 4: Content Infrastructure - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Creators can publish text, image, and video content with automated CSAM scanning before any content goes live. Includes post creation, media upload/processing, content display on creator profiles, and moderation pipeline. Token-gating, reactions, comments, and discovery are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Post composer
- Plain text only — no rich text editor, no markdown formatting
- Mixed media + text — images and videos inline within the text flow (blog-style posts)
- Auto-save drafts — work-in-progress saved automatically, accessible from a drafts list
- Modal/overlay composer — opens on top of current page, no navigation away

### Content presentation
- Feed/timeline layout — vertical scroll of posts, newest first, on creator profile
- Long text truncated with "Read more" — show first ~300 chars, expand inline or navigate to detail
- Images display full width within posts
- Videos show thumbnail with play button — click to play, no autoplay

### Media processing
- Image upload limit: 25 MB
- Video length limit: 10 minutes
- Cloud transcoding service for video (e.g., Mux or Cloudflare Stream — HLS, ABR, CDN delivery)
- Upload progress bar shown to creator, then "Processing..." state — post appears in feed once media is ready

### Moderation flow
- Flagged content visible to creator only — marked as "Under review", not visible to anyone else
- Admin review queue — flagged content goes to admin dashboard for human approve/reject
- Generic notice to creator — "Your post is under review for policy compliance" (no specifics on trigger)
- Strike system — confirmed violations remove the post + issue a strike. After N strikes, account suspended

### Claude's Discretion
- Exact draft auto-save interval and storage mechanism
- Image optimization parameters (Sharp settings, output format, responsive sizes)
- Video transcoding service selection (Mux vs Cloudflare Stream vs other)
- Admin review queue UI design
- Strike threshold (how many strikes before suspension)
- Post detail view design and URL structure

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-content-infrastructure*
*Context gathered: 2026-02-01*
