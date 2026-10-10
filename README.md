<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# DropZone_G

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3e5c7389-29d5-4fb0-8a16-bfed2657f51b

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Map Zones

Before using Map & Zones with Supabase, apply [`migrations/sql/001_zones.sql`](migrations/sql/001_zones.sql) in the Supabase SQL Editor. It creates zone and join tables, adds zone links to posts, and keeps row-level security enabled. The local map uses OpenStreetMap tiles.

See [PRIVACY.md](PRIVACY.md) for location collection, retention, and deletion notes.
