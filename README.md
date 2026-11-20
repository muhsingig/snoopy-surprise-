# Snoopy birthday gift

An interactive birthday gift site modelled on the "Snoopy - Birthday Template" Canva site.

Flow: landing (Accept / Decline) → Happy birthday → Gifts hub → 5 gifts
(blow the candles, flowers, song, photos, letter).

## Personalise it
- **All text, the song and photo paths:** `data.js`
- **Photos:** replace `assets/photo-1.jpg` … `photo-3.jpg` (square crops look best)
- **Song:** put the YouTube video id in `data.js` → `youtubeId`

## Preview
Open the folder with any static server, e.g. `python -m http.server 5190`, then go to http://localhost:5190.

## Share it
Deploy the folder as a static site (Vercel, Netlify, GitHub Pages). Then change
`og:image` in `index.html` to the full URL (e.g. `https://your-site.vercel.app/assets/og.jpg`)
so the DM link preview shows the Snoopy card.

Snoopy art: Peanuts characters, collected from public image results. Fine for a personal gift, not for resale.
