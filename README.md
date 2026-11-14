# Poemario

Un poema cada día, por Mario Núñez y Mariel — https://mtmonk.github.io/poemario

- **Sitio**: Astro, publicado en GitHub Pages.
- **Escribir**: https://mtmonk.github.io/poemario/admin/ (hace falta una llave).
- **Redes**: Facebook e Instagram, publicados por GitHub Actions.

## Setup (Mario, once)

### 1. Key for the admin
1. Signed in to GitHub as **MTmonk**: Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Repository access: **Only select repositories** → `poemario`.
3. Permissions → Repository → **Contents: Read and write**. Nothing else.
4. Open this link once on each device that should be able to write (yours, your father's):
   `https://mtmonk.github.io/poemario/admin/#llave=PASTE_TOKEN_HERE`
   The page stores the key in that browser and removes it from the address bar.

If a device is lost, delete the token on GitHub and make a new one. Tokens expire on the date you pick; when that happens the admin asks for a key again.

### 2. Facebook and Instagram
Needed: a Facebook **Page** for the poems, an Instagram **professional** account linked to that Page, and a Meta developer app (Live mode) with `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic` and `instagram_content_publish`. Instagram is optional: without `META_IG_USER_ID` only Facebook is used.

Add these in the repo under Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `META_PAGE_TOKEN` | Page access token |
| `META_PAGE_ID` | Facebook Page ID |
| `META_IG_USER_ID` | Instagram professional account ID (leave out to post to Facebook only) |

Until these exist the site works normally and nothing is posted to social networks. Only poems from the last two days are posted, so older poems are never sent in bulk.

## Day to day
- A poem dated today or earlier appears a few minutes after it is saved.
- A poem with a future date waits in the repo and is published at about 6:05 (Mexico City) on its day.
- If a run fails, GitHub emails the repo owner; the Actions tab has the details. The admin list also shows it to the poet.

## Limits
- GitHub turns the daily schedule off after 60 days without any commit to the repo. The admin shows a warning; re-enable it in Actions → Publicar → Enable workflow.
- The scheduled run can start up to an hour late.
- The admin token expires on the date chosen when it was created; the browser cannot read that date, so the admin simply asks for a new key that day.
- Social posts are made once per poem and are never edited or deleted by the site.
- GitHub Pages: 1 GB site size, 100 GB bandwidth per month. The music is about 70 MB.

See `CLAUDE.md` for how the code is organised and `GUIA.md` for the poet's guide.
