# Subscriptions

Enable Subscriptions in Settings → Subscriptions or Overview. Add a service with its price per billing cycle, currency, next renewal date and the number of days before renewal you need to cancel. Free trials use the first payment date and the price that will apply afterwards. Dates accept English phrases such as “tomorrow” and “in 30 days”, as well as YYYY-MM-DD. The interpreted date appears before saving.

Next 30 days shows entries whose cancellation deadlines fall within the next month, including overdue entries. All active includes active services and trials regardless of date. Cancelled holds the archive. Each entry opens an editor for its dates, notes, service logo and management link. The archive button records that you cancelled a service elsewhere; it does not cancel anything at the provider. Reopen the editor and set Status to Active to restore an archived entry. Deleting asks for a second confirmation.

Renewal dates stay visible until you confirm what happened. Use Renewed after checking a charge, or Started paid plan after a trial converts. These actions advance to the first renewal after today and keep the original billing day: January 31 becomes February 28 and then March 31. Trials are not converted automatically. Change the date in the editor if a service uses a different billing rule.

The summary estimates monthly and yearly equivalents for active plans. Trials and cancelled services are excluded. Every currency has its own total; Moo does not fetch exchange rates. Weekly plans use 52 payments per year, quarterly plans use four, and monthly plans use twelve. These are planning estimates from the prices you entered, including tax only if you included it. The widget neither reads a bank account nor sends notifications while the browser is closed.

## Service artwork

The searchable catalogue contains 3,515 service logos from [Dashboard Icons by Homarr Labs](https://github.com/homarr-labs/dashboard-icons), pinned to revision `d767d7327db7f8ebd3715b552523f61889eea41c`. The bundled catalogue keeps logo ids, aliases and formats, without contributor profiles. Forty-six common logos are bundled locally; other artwork loads from the pinned GitHub revision only when displayed. Most artwork is SVG; entries without SVG use the library's PNG artwork. No favicon service is used. Missing or unavailable logos fall back to initials.

Search and matching happen locally. GitHub receives image requests for unbundled logos, without a referrer; it does not receive search queries, costs, renewal dates or notes. Turn off Load additional service logos to use only bundled images and initials. Offline mode also disables remote logos. Logo choices are saved in Backups. The library's Apache-2.0 license and attribution are packaged in `src/assets/subscription-icons/LICENSE` and `src/assets/subscription-icons/NOTICE`; brand logos remain the property of their respective owners.

## Storage

Up to 200 entries are stored in this browser profile and included in Backups. Changes synchronize between local tabs; stale edits are rejected so they cannot overwrite a newer entry. Unreadable saved data is preserved and editing is blocked until a valid backup is restored. Classic/Glass styling and separate Standard/Focus placements work as for other widgets. These new widget strings currently use English in every interface language.
