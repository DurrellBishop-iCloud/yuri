# GitHub Pages

This project is ready to publish both web apps from one GitHub Pages site.

## Share URLs

After deployment, use these URLs:

- Ride: `https://YOUR-USER.github.io/YOUR-REPO/`
- Path editor: `https://YOUR-USER.github.io/YOUR-REPO/editor`
- Path editor fallback: `https://YOUR-USER.github.io/YOUR-REPO/#editor`

For a user/organization Pages repo named `YOUR-USER.github.io`, the URLs are:

- Ride: `https://YOUR-USER.github.io/`
- Path editor: `https://YOUR-USER.github.io/editor`

## Setup

1. Push this folder to GitHub.
2. Run `npm run build`.
3. Push the contents of `dist` to the `gh-pages` branch.
4. In the GitHub repo, open **Settings > Pages**.
5. Set **Source** to **Deploy from a branch**.
6. Set **Branch** to `gh-pages` and folder to `/`.

The build creates a `404.html` copy of the app so direct links like `/editor` work on GitHub Pages.
