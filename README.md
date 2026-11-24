# Snoopy birthday gift

An interactive birthday gift site modelled on the "Snoopy - Birthday Template" Canva site.

Flow: landing (Accept / Decline) → Happy birthday → Gifts hub → 5 gifts
(blow the candles, flowers, song, photos, letter).

## Make one for a friend (Gift Studio)
1. Double-click **Make a Gift.bat**. Gift Studio opens at http://localhost:5191/studio/
   (keep the black window open while you work).
2. Pick **Bestie** or **Partner** for the starting wording, type their name, then change
   any line you like: flower notes, song (paste a YouTube link), 3 photos, the letter.
3. **Save & preview** shows it in the phone on the right. The buttons above the phone
   jump straight to each gift.
4. **Publish & get link** pushes it to GitHub; Vercel puts it live in about a minute at
   `https://snoopy-surprise.vercel.app/<their-link>`. Copy it or send it on WhatsApp.

Every gift you made is listed at the top of the studio, so you can open one again,
edit it and publish again (same link).

Each gift lives in `gifts/<their-link>/` (`gift.js` + photos). `/?for=<their-link>`
also works. The plain URL with no link name shows the sample in `data.js`.

Note: the GitHub repo is public, so anything in `gifts/` (photos included) can be seen
there. Make the repo private on GitHub if that matters; Vercel keeps deploying.

## Preview without the studio
`python -m http.server 5190`, then http://localhost:5190/?for=<their-link>.

Snoopy art: Peanuts characters, collected from public image results. Fine for a personal gift, not for resale.

## Online Gift Studio (any device)
https://claude.ai/artifact/8CZXfAdFxoBU9wdqTohjT4 (private claude.ai page, `studio/online.html`).
Fill in the gift there, click **Ready for link**, then ask Claude "make the link for <name>".

What Claude does for each gift marked ready (status `ready` in the artifact db, collection `gifts`):
1. `ArtifactData` query `gifts` where `status == "ready"`, saved with `out_dir`.
2. Download every `asset:<id>` in the gift (photos, `bouquet`) with the Artifact tool's
   `read` + `path: <id>` (one asset per call) into one folder.
3. `node studio/import-online.js <doc.json> <that folder>` writes `gifts/<link>/`.
4. Commit, push, wait for Vercel, open the link to check it.
5. `ArtifactData` update the doc: `status: "live"`, `liveUrl` (the page then shows the link).

To republish the online studio after changing its files, publish `studio/online.html` with the
same `files` map (studio.css, templates.js, online.js, preview.html, app.js, style.css, assets/).
