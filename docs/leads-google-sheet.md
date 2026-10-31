# Leads → Google Sheet

Render's free plan has no persistent disk, so the SQLite waitlist can be wiped on a redeploy.
Every sign-up from `/api/waitlist/join` is therefore also posted to a Google Apps Script web app
that appends a row to the **Skill N Success — Leads** sheet and emails the owner.

Sheet: https://docs.google.com/spreadsheets/d/1kEbfkxKl_WjUWYe0DEj9fovX_vzESLwpUnNiZhuFARY/edit

## One-time setup

1. Open the sheet → **Extensions → Apps Script**.
2. Replace the editor contents with `docs/leads-apps-script.gs`. Save.
3. Choose `testSetup` in the function list → **Run** → allow the permissions (Google shows an
   "unverified app" screen for your own script: Advanced → Go to project). A test row appears
   and you get an email.
4. **Deploy → New deployment → Web app**. Execute as **Me**, Who has access **Anyone** → Deploy.
   Copy the URL ending in `/exec`.
5. Render → the skillnsuccess service → **Environment** → add:
   - `LEADS_WEBHOOK_URL` = the `/exec` URL
   - `ADMIN_KEY` = any long random text (enables the backup CSV export)
   - optional `LEADS_WEBHOOK_SECRET` = random text; add the same value as script property
     `SECRET` (Apps Script → Project Settings → Script properties)
6. Save; Render redeploys. Reserve a copy on /rooted-rising/ with your own email and check the
   sheet.

Backup export of the server's own copy: `https://skillnsuccess.com/api/waitlist/export?key=ADMIN_KEY`

If you edit the script later, use **Deploy → Manage deployments → Edit → New version** so the
`/exec` URL stays the same.
