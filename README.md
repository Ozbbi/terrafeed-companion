# Terrafeed Companion

A small Chrome extension that reads whatever article is open in the current
tab, works out which countries and topics it's actually about, and copies a
ready-made filter you can paste straight into
[Terrafeed](https://github.com/OWNER/terrafeed)'s topic watchlist.

Nothing leaves the browser. Detection is a bundled place list plus a keyword
list, matched entirely inside the extension — no server, no analytics, no
network request of any kind.

## What it does

- **Popup → Scan this page.** Extracts the title, headings and body text of
  the active tab, matches them against ~170 country names, ~140 cities and
  demonyms, and ten topic categories (conflict, sanctions, disasters,
  economy…), then shows the result as chips with a severity meter.
- **Copy Terrafeed topic filter.** One click copies a comma-separated line —
  the detected countries and topics — sized for Terrafeed's *Topics → Describe
  a topic* box.
- **Right-click → Terrafeed.** Works without opening the popup: right-click a
  page or a selection and copy a filter for just that paragraph.

## Install (unpacked, for now)

1. Clone this repo.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the repo folder.

## How detection works

`places.js` is a generated, standalone copy of Terrafeed's place index —
country names, major cities, and the demonyms and aliases that let "Turkish"
resolve to Turkey without "turkey" (the bird) triggering a false match.
Regenerate it after Terrafeed's gazetteer changes:

```bash
node scripts/gen-places.mjs
```

`detect.js` does the matching (word-boundary, Unicode-aware, longest term
wins) and keyword scoring. Both are plain scripts — no bundler, no
dependencies — so the whole extension loads as-is.

## Privacy

The `activeTab` and `scripting` permissions only ever act on the tab you're
looking at, only when you click **Scan** or use the context menu. There is no
`host_permissions` entry, no background scraping, and no data collected
anywhere.

## License

MIT — see [LICENSE](LICENSE).
