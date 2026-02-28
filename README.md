# VJ cPanel DNS to Cloudflare Importer

Convert copied cPanel DNS data into a Cloudflare-importable TXT zone file.

## Files

- `cpanel-html-to-cloudflare-zone.html` - Main page (structure)
- `styles.css` - Styles (branding/theme)
- `app.js` - Parser + editor + export logic

## Features

- Paste full cPanel DNS HTML table and parse records
- Paste plain copied rows (`Name TTL Type Record`) and parse records
- Edit records in table
- Add records with type-specific form fields
- Filter by record type (`All`, `A`, `AAAA`, `CNAME`, `MX`, `SRV`, `TXT`, `CAA`)
- Export as domain-named `.txt` file (BIND-style)
- Step-by-step actions in UI (`Step 1: Load Input` -> `Step 2: Generate TXT` -> `Step 3: Download`)

## Local usage

1. Open `cpanel-html-to-cloudflare-zone.html` in your browser.
2. Paste HTML or copied DNS text.
3. Click `Step 1: Load Input`.
4. Edit/add records if needed.
5. Click `Step 2: Generate TXT`.
6. Click `Download .txt` from the Step 3 section.

## Cloudflare import

1. Open Cloudflare dashboard.
2. Go to your domain -> `DNS`.
3. Use DNS import and upload the generated `.txt` file.
4. Verify all records before changing nameservers.

## Publish to GitHub

```bash
git init
git add .
git commit -m "Add cPanel DNS to Cloudflare importer"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

## Notes

- This is a static client-side tool. No server required.
- Review generated DNS records before production use.
