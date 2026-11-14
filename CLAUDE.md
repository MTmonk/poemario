# Claude Code — Project Notes

## Project
Daily poetry site for Mario Núñez y Mariel, live at https://mtmonk.github.io/poemario (repo `MTmonk/poemario`). Astro static site on GitHub Pages, a browser-only admin at `/admin/`, and a GitHub Actions workflow that builds, deploys and posts to Facebook and Instagram. Budget is $0: no server, no database, no paid service. Everything visible to readers and to the poet is in Spanish.

## How it works
- **Poems** are files `poemas/AAAA-MM-DD.json` with `{ titulo, fecha, html }`. One poem per day; the filename must match `fecha`. In `html` each `<p>` is a line (or a prose paragraph) and an empty `<p></p>` is a stanza break. Only `p br em i strong b` survive sanitising.
- **Scheduling**: the build only includes poems with `fecha <= today` in `SITIO.zonaHoraria` (`src/config.mjs`). Future poems wait in the repo; the daily cron in `.github/workflows/publicar.yml` (12:05 UTC) brings them out.
- **Admin** (`src/components/Admin.jsx`): React + TipTap. It talks straight to the GitHub API with a fine-grained token kept in the browser's `localStorage`. Setup link: `/admin/#llave=<token>`. `.docx` import uses mammoth in the browser. Poems can be deleted from the list or from the editor. The list shows the site status (`Estado`: last run of `publicar.yml`, read from GitHub's public Actions API without the token), per-poem social results from `datos/social.json`, and the known limits (`Limites`); the editor warns when a limit applies to the poem being written.
- **Cards**: `src/lib/tarjeta.mjs` draws a JPEG per poem with satori + sharp: `/tarjetas/<fecha>.jpg` (4:5, Instagram/Facebook) and `/og/<fecha>.jpg` (link previews).
- **Social**: `scripts/social.mjs` runs after deploy. It posts poems from the last 2 days that are not yet in `datos/social.json`, then the workflow commits that log. A failed post is noted as `error: { <red>: mensaje }` on that date so the admin can show it. Without the `META_*` secrets it does nothing.
- **Music**: `src/musica.mjs` is the playlist. It never autoplays. The player (`.musica`) is fixed on screen so it follows scrolling: a box in the date column on wide screens, a bottom bar on phones.

## Key decisions
- **Astro, not a React SPA**: each poem needs its own real HTML page so Facebook/Instagram link previews work.
- **Poems are loaded with `import.meta.glob`** (`src/lib/poemas.mjs`), not Astro content collections, to stay independent of Astro API changes.
- **`src/lib/poema.mjs` has no dependencies** because Astro, the browser admin and the Node social script all import it.
- **Two-column Word poems** (lines split by tabs) are flattened on import: left column of each block, then right column.
- **No X/Twitter**: removed at Mario's request (the API is paid).
- **Fonts**: Jost (headings, as on the birthday site) and EB Garamond (poems), self-hosted through `@fontsource`.

## Do not change
- Colour tokens in `:root` (paper / ink / one red) — the constructivist palette is intentional. The same three colours are repeated in `src/lib/tarjeta.mjs` and `src/components/Emblema.astro`.
- The poem format and the `poemas/` path: the admin, the build and the social script all depend on them.
- Poem text: never "correct" spelling or punctuation in a poem (for example the title spelling "Treblinca" is the author's).
- Music: only add recordings that are public domain or freely licensed, with the licence and source page recorded in `src/musica.mjs`. The famous Monk / Coltrane / Brubeck / Miles Davis / Sonny Rollins recordings are still under copyright.

## Commands
- `npm run dev` — local site at http://localhost:4321/poemario/
- `npm run build` — static build into `dist/`
- `node scripts/importar-docx.mjs poema.docx AAAA-MM-DD` — add a poem from a Word file without the admin
