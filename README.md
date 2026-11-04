# Leftoff

A small browser extension (Manifest V3) for keeping quick, per-site notes so you can remember where you left off in any show, film or book.

## Installation

1. Clone or download this repository.
2. Open `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
3. Click **Load unpacked** and select the project folder.
4. Optionally pin Leftoff to the toolbar.

## Usage

Open Leftoff by clicking its toolbar icon or pressing **Alt+N** (the shortcut can be changed at `chrome://extensions/shortcuts`).

### Adding a note

1. Go to the site where you're watching or reading something.
2. Open Leftoff and press **+ Add**.
3. Fill in any of the fields:
   - **Title**: the show, film or book.
   - **Progress**: where you are, e.g. `S2E05` or `p. 112`.
   - **Time**: the timestamp, e.g. `00:42:10`.
   - **URL**: prefilled with the current page.
4. Press **← Back** when you're done. Changes save automatically as you type.

A new note left completely empty is discarded when you go back.

### Picking up where you left off

- The list shows your notes grouped by website, with the current site first and the rest alphabetical. Within a site, the most recently updated note comes first.
- Click a note to open its saved URL in a new tab.
- Click the **✎** button on a note to edit it.
- If the site you're on already has notes, Leftoff opens straight to the matching note's editor. It prefers the note with the same URL, otherwise the most recently updated one for that site. Press **← Back** to see the full list.

### Editing a note

- **Link this page** replaces the note's URL with the current tab's URL. This is handy for saving the exact episode or chapter page. It's the copy icon next to the URL field, and is disabled on pages that can't be linked (like `chrome://` pages).
- Editing the URL to a different site moves the note to that site's group.
- **Delete** removes the note after a confirmation.

### Notes

- Notes are kept per website, and `www.` is ignored, so `www.example.com` and `example.com` share a group.
- Adding a note only works on regular `http(s)` pages. On other pages (such as `chrome://` pages), **+ Add** is disabled.

## Storage and permissions

Notes are stored with `chrome.storage.sync`, so they follow you across devices where you're signed in to the browser. Browser sync storage has size limits, which is plenty for text notes.

| Permission  | Why                                                       |
| ----------- | --------------------------------------------------------- |
| `storage`   | Save your notes.                                          |
| `activeTab` | Read the URL of the current tab to prefill and link notes. |

Nothing is sent to any server.
