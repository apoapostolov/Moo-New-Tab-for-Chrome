# Subscriptions

Enable Subscriptions in Settings → Subscriptions or Overview. Add a service with its price per billing cycle, currency, next renewal date and the number of days before renewal you need to cancel. Free trials use the first payment date and the price that will apply afterwards. Dates accept English phrases such as “tomorrow” and “in 30 days”, as well as YYYY-MM-DD. The interpreted date appears before saving.

Next 30 days shows entries whose cancellation deadlines fall within the next month, including overdue entries. All active includes active services and trials regardless of date. Cancelled holds the archive. Each entry uses two lines: the name and cost on the left, with the renewal date and status on the right. Click the name or logo to edit dates, notes, original billing price or management link. The management link is available inside the editor. Deleting asks for a second confirmation.

Changing the row from Active to Cancelled records that you cancelled elsewhere. It does not contact the provider. The row remains in the current view with its saved cancel-by date and an undo icon, so you can immediately reverse the change. Once you switch views, normal filtering applies: it leaves Active and appears in Cancelled. Undo restores Active without changing the billing date. Free trials have a Trial status until you change them.

The renewal icon records a renewal after its date has arrived. It advances to the first renewal after today and keeps the original billing day: January 31 becomes February 28 and then March 31. Trials are not converted automatically. Change the date in the editor if a service uses a different billing rule.

## Display currency and exchange rates

Choose Display currency in Settings → Subscriptions. It also supplies the initial currency for new entries. Original prices and billing currencies remain stored and editable. Rows and the centered monthly/yearly summary convert to the display currency using [Frankfurter](https://frankfurter.dev/) reference rates, without an API key. Only currency codes are sent to the provider, not service names, amounts, notes or renewal dates.

Rates are cached for up to an hour, refreshed on a new local day and checked again when the tab becomes visible. Each pair keeps its actual reference date; this can be an earlier business day on weekends or holidays. Hover over the total to see the date or a saved-rate indication. Reference conversions are estimates and do not include a bank's fees. These figures are not a transaction ledger.

The summary includes active plans, excluding trials and cancelled services. Weekly plans use 52 payments per year, quarterly plans use four, and monthly plans use twelve. Include tax in the price if you want it counted. If a conversion is unavailable, that row keeps its original currency and the combined total is unavailable; unlike currencies are never added together. Matching saved rates can still be used offline, with their date retained. Exchange-rate caches are excluded from Backups.

## Service artwork

The searchable catalogue contains 3,515 service logos from [Dashboard Icons by Homarr Labs](https://github.com/homarr-labs/dashboard-icons), pinned to revision `d767d7327db7f8ebd3715b552523f61889eea41c`. The bundled catalogue keeps logo ids, aliases and formats, without contributor profiles. Forty-six common logos are bundled locally; other artwork loads from the pinned GitHub revision only when displayed. Most artwork is SVG; entries without SVG use the library's PNG artwork. No favicon service is used. Missing or unavailable logos fall back to initials.

Search and matching happen locally. GitHub receives image requests for unbundled logos, without a referrer; it does not receive search queries, costs, renewal dates or notes. Turn off Load additional service logos to use only bundled images and initials. Offline mode also disables remote logos. Logo choices are saved in Backups. The library's Apache-2.0 license and attribution are packaged in `src/assets/subscription-icons/LICENSE` and `src/assets/subscription-icons/NOTICE`; brand logos remain the property of their respective owners.

## Storage

Up to 200 entries are stored in this browser profile and included in Backups. Changes synchronize between local tabs; stale edits are rejected so they cannot overwrite a newer entry. Unreadable saved data is preserved and editing is blocked until a valid backup is restored. Classic/Glass styling and separate Standard/Focus placements work as for other widgets. These new widget strings currently use English in every interface language.
