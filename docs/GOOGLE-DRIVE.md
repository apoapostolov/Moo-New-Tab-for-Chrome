# Google Drive

Enable Google Drive under Settings → Google or in Overview. It shares the existing Google connection. Enable the Google Drive API in the same Google Cloud project as Gmail, Calendar and Tasks, then reconnect Google to approve the new `drive.metadata.readonly` permission. Existing connections keep working for the other widgets; Drive asks for reconnection when its permission is missing.

Recent shows the most recently modified files. Starred and Shared filter that list; Search file names searches within the selected view or folder. Open a folder to browse it and use Back to return. Show more loads another page. File links open in a new tab, and the title opens Google Drive. Moo does not download file contents, upload, delete, rename or share files. Folder shortcuts open in Drive rather than being browsed inside the widget.

Files per page, refresh interval and Classic/Glass styling are configured in Settings → Google. Refresh checks the current view immediately. Drive also reloads when the tab becomes visible. Offline mode prevents API requests. Listings are kept in memory, discarded on account changes and excluded from Backups; visibility, placement and display settings are included. Standard and Focus layouts can show the widget independently.

Google Workspace administrators can restrict access to the API or OAuth scope. Follow the error from Google if a project or organization blocks access. This feature uses the same browser-specific OAuth client setup as the existing Google widgets.

API references: [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [file listing](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list) and [filename searches](https://developers.google.com/workspace/drive/api/guides/search-files).
