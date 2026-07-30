# Seat Mixer

A static classroom seating chart generator designed for GitHub Pages.

## Features

- Fixed playing-card orientation at every table:
  - upper left: Clubs
  - upper right: Spades
  - lower left: Diamonds
  - lower right: Hearts
- Front-seat priority
- Multiple table naming systems
- Printable color and grayscale layouts
- Google Slides 16:9 preview and copy-ready text
- Saved charts and preferences using browser local storage
- No server and no account required

## Publish with GitHub Pages

1. Sign in to GitHub.
2. Create a new **public** repository named `seat-mixer`.
3. Upload all files from this folder to the root of the repository:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `.nojekyll`
4. Commit the files.
5. Open **Settings → Pages**.
6. Under **Build and deployment**, set:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
7. Click **Save**.

Your site will normally appear at:

`https://YOUR-GITHUB-USERNAME.github.io/seat-mixer/`

## Updating the site

Edit or replace the files in the repository and commit the change. GitHub Pages republishes from the selected branch.

## Privacy

Seat Mixer stores rosters, preferences, and saved charts in the browser's `localStorage`. Data is not uploaded to a database. Clearing browser storage or using a different device/browser will not carry the saved data over.

Do not place real student rosters directly in the public repository. Enter names only through the live app.
