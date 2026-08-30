# Mykhailo Kovalenko — CV site

Static site for GitHub Pages: CV, notes, and interview Q&A.

- Home = resume for recruiters
- Notes = short public conspect (what I study, how I prepare)
- Q&A = interview answers (English is spoken / short sentences)

## Preview locally

Do not open `index.html` as a file. The browser will block JSON.

```bash
python3 -m http.server 4173
```

Open http://127.0.0.1:4173/

## Live

**https://kovalenkomikhail.github.io/myCV/**

GitHub Pages, branch `main`, folder `/ (root)`. Links are relative, so the `/myCV/` path works.

## Add contacts

Edit [`content/site.json`](content/site.json):

```json
{
  "email": "you@example.com",
  "linkedin": "https://www.linkedin.com/in/…",
  "telegram": "username",
  "github": "https://github.com/…",
  "pdf": "cv/Mykhailo_Kovalenko_QA_EN.pdf"
}
```

Empty contact fields are hidden. Open Graph tags in HTML use `siteUrl` from [`content/site.json`](content/site.json) (`https://kovalenkomikhail.github.io/myCV`). Change it if the Pages URL is different.

## Edit text

| Page | Files |
| --- | --- |
| CV | `content/uk.json`, `content/en.json` |
| Notes | `content/notes-uk.json`, `content/notes-en.json` |
| Q&A | `content/qa-uk.json`, `content/qa-en.json` |

To add a question, append an object `{ "q": "…", "a": "…" }` inside the right `groups[].items` array. No new HTML.

Language: UA / EN in the header. Theme: Light / Dark. Both are stored in `localStorage`.
