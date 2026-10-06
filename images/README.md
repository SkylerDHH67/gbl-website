# GBL Website Images

Drop static, league-wide brand assets here — things that rarely change and are
part of the site's own design, not per-player/per-build data:

- `gbl-logo.png` / `gbl-wordmark.png` — primary league logo/wordmark
- `favicon.png`
- banners, backgrounds, season art, sponsor logos (if not using the Sheet's
  `feed_media` tab for those instead)

Reference any file here from HTML/CSS as a relative path, e.g.:

```html
<img src="images/gbl-logo.png" alt="Global Blade League">
```

Per-player badges/wordmarks and per-part/build images are handled
differently — those stay URL-driven from the Google Sheet
(`Players.badge_logo_url`, `Parts Catalog.image_url`) so they can be updated
without touching this repo at all. This folder is only for assets that are
part of the site's own fixed design.
