# Wave Rise Ringtones

A polished mobile-first ringtone discovery experience built as a dependency-light static frontend. Demo audio is synthesized locally in the browser so the repository does not redistribute copyrighted music.

## Included
- Responsive dark premium UI with neon blue/purple visual system
- 20 fictional, rights-cleared demo records
- Search by title, artist and category
- Working browser audio previews and generated MP3-compatible WAV downloads
- Ringtone detail modal, share/copy link, favorites and theme toggle
- Category browse cards, trending/new sections and empty states
- Admin upload/review panel UI with a rights confirmation gate
- SEO metadata, semantic HTML, canonical URL and copyright workflow copy

## Run locally
This version is static and can be previewed with any static server:

```bash
npm install
npm start
```

`npm start` serves the existing Express app at `http://localhost:3000`.

## Production architecture
For a production launch, connect the admin panel to Supabase:

- Supabase Auth with an `admin` role and MFA
- Postgres `ringtones`, `categories`, `favorites`, `plays`, `downloads`, `rights_documents`, and `dmca_reports` tables
- Private Supabase Storage bucket for source uploads and signed download URLs
- Server-side download route that validates the published record and increments downloads
- RLS policies denying public source-file access and allowing only published, rights-cleared records
- Virus scanning, MIME/duration validation, rate limits, audit logs, and moderation review

### Suggested schema
`ringtones(id uuid, slug text unique, title text, artist text, category_id uuid, tags text[], duration_seconds int, audio_path text, thumbnail_path text, rights_type text, rights_reference text, status text, download_count bigint, play_count bigint, seo_title text, seo_description text, created_at timestamptz)`.

## Environment variables for the production API
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STORAGE_AUDIO_BUCKET=wave-rise-audio
STORAGE_IMAGE_BUCKET=wave-rise-art
NEXT_PUBLIC_SITE_URL=https://your-domain.example
ADMIN_EMAILS=admin@example.com
```

## Deployment
For a static demo, deploy the repository to Vercel with the framework preset set to **Other** and build command empty. For the full production version, migrate the UI to Next.js App Router, place protected route handlers under `app/api/admin` and `app/api/download`, configure the environment variables above in Vercel, and use Supabase migrations/RLS before enabling uploads.

## Adding the first ringtone safely
1. Authenticate as an admin.
2. Upload an original, licensed, or public-domain MP3 and artwork.
3. Attach proof of rights and select **pending review**.
4. Validate duration, MIME type, loudness, artwork dimensions, and filename server-side.
5. Approve it only after the rights record is complete; then generate a signed download URL.

Never scrape or upload commercial movie/music audio without explicit permission.
