# Mykhailo Kovalenko — CV site

Static HTML/CSS/JS for GitHub Pages. No React, no build step.

- **Home** — resume for recruiters
- **Notes** — short public conspect
- **Q&A** — interview answers (English is spoken / short sentences)
- **Challenge** — Northgate Console (fake TEST back-office, planted bugs)
- **Learn** — Playwright quizzes

## Preview locally

Do not open `index.html` as a file. The browser will block JSON.

```bash
python3 -m http.server 4173
```

Open http://127.0.0.1:4173/

## Live

**https://kovalenkomykhailo.github.io/**

User site from repo `KovalenkoMykhailo.github.io`, branch `main`, folder `/`. No `/myCV/` in the URL. HTTPS comes from GitHub.

To turn Pages on for a fork: **Settings → Pages → Deploy from a branch → `main` / root**.

## Contacts and PDF

Edit [`content/site.json`](content/site.json):

```json
{
  "email": "kovalenko.mikhail.vadim@gmail.com",
  "linkedin": "https://www.linkedin.com/in/mykhailo-k-420b271a3/",
  "telegram": "https://t.me/MykhailoKov_AQA",
  "github": "https://github.com/KovalenkoMykhailo",
  "pdf": "cv/Kovalenko_Mykhailo_Senior_General_QA_Engineer.pdf",
  "siteUrl": "https://kovalenkomykhailo.github.io",
  "formEndpoint": "https://formsubmit.co/ajax/kovalenko.mikhail.vadim@gmail.com"
}
```

Empty contact fields are hidden. If `pdf` is empty, the header shows Print / Save PDF instead (the page has a print stylesheet).

Optional `e2eDispatchToken` in `site.json` lets the sandbox **Tests** tab start GitHub Actions from the page. Use a **fine-grained PAT**: only `northgate-console-e2e`, **Actions: Read and write**. Do not paste a `gh` login token. The value is public on Pages. Without it, Run tests opens a prefilled `[e2e]` issue (the workflow starts on Submit).

## Edit text

| Page | Files |
| --- | --- |
| CV | `content/uk.json`, `content/en.json` |
| Notes | `content/notes-uk.json`, `content/notes-en.json` |
| Q&A | `content/qa-uk.json`, `content/qa-en.json` |
| Challenge | `content/sandbox-en.json`, `content/sandbox-uk.json`, `content/sandbox-docs-en.json`, `content/sandbox-docs-uk.json` |
| Learn | `content/learn-en.json`, `content/learn-uk.json` |

To add a question, append `{ "q": "…", "a": "…" }` inside the right `groups[].items` array. No new HTML.

Language: UA / EN in the header. Theme: Light / Dark. Both are stored in `localStorage`.
