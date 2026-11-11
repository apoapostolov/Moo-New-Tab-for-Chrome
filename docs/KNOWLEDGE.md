# Knowledge

Enable Knowledge in Settings → Knowledge or Overview. It displays a random Wikipedia article or Wikimedia Commons file with its title, a short introduction or file description, an image when available, and links to the original page and image credits. No account or API key is needed. Classic/Glass styling and separate Standard/Focus layouts work as for other widgets.

Choose Wikipedia, Wikimedia Commons or both. Wikipedia defaults to English; eleven article languages are available. Commons uses the description available for the file, which may be in another language. Wikipedia selections skip disambiguation pages. Commons selections use image files with a usable preview.

## Subjects

Enter up to twenty comma-separated subjects, each up to 100 characters, such as `astronomy, architecture, ancient history`. Empty filters allow unrestricted random discovery. With filters, Moo searches for a subject and chooses randomly from a small pool of relevant results. It may try up to three of the subjects when a search has no usable result. It does not replace an unsuccessful filtered search with an unrelated random page. Refresh can try a different selection. A narrow subject with only one suitable result can return that page again.

## When the page changes

- On each page reload chooses a page once for that document. Returning to the tab or changing layout does not reroll it. A newly opened or reloaded tab can choose another page.
- Once per day keeps the selection until local midnight, including across reloads and other tabs in this browser profile.
- Every X hours keeps the selection for the chosen elapsed time, starting when it is fetched. Eight hours is the default; the range is 1–168 hours.

An open, visible widget checks for an expired selection approximately every thirty seconds and checks again when the tab becomes visible. Refresh explicitly picks another page immediately and starts a new interval. The widget tries to avoid repeating the previous page when alternatives are available; it does not promise a globally unique page each day or a complete history of discoveries.

Selections are cached locally. A matching saved page remains readable when offline or when a request fails; remote thumbnails are hidden in offline mode. Subjects and other preferences are included in Backups, while cached pages and temporary rate-limit state are excluded. Resetting the profile clears the selection. Switching subjects or sources never displays an unrelated old cached selection. Wikimedia rate limits are respected, including Retry-After responses.

## Sources and image credits

Wikipedia pages are discovered with the [MediaWiki Action API](https://www.mediawiki.org/wiki/API:Random), with [subject searches](https://www.mediawiki.org/wiki/API:Search) when configured. Summaries come from the [Page Content Service](https://www.mediawiki.org/wiki/Page_Content_Service). The widget requests free page images and links to the file page for image details. Commons previews and creator/license metadata use [Imageinfo](https://www.mediawiki.org/wiki/API:Imageinfo). Wikimedia text and image metadata are displayed as plain text rather than injected HTML. Image and article links are limited to their Wikimedia sources.

Source and image-credit links remain visible on the card. Wikipedia text links to its reuse terms; Commons images link to their individual file page, where their license and attribution details are available. New widget labels currently use English fallback strings in other interface languages.

Widget headers hide settings shortcuts by default. Enable Settings Button on every Widget in Settings → Misc to show them across the page. Refresh remains available independently.
