# BirrFlow - clean public copy

This is the blank, installable BirrFlow app for public hosting. It contains no personal income records. Each browser stores its own records locally; there is no shared database or sync.

## Try it locally

Open `index.html`, or run `python -m http.server 8000` and visit `http://localhost:8000`.

## Publish and install

Upload the contents of this folder to a static HTTPS host. Open its URL in Chrome, then select **Install BirrFlow** when it appears or use Chrome's install icon/menu. The HTTPS host enables installation and offline app-shell support.

## Move your personal records

Use the personal copy's **Backup** control to download a private JSON backup. Open BirrFlow at the hosted URL on your own device and restore that file. The upload folder is blank; your backup is never part of this public copy.
