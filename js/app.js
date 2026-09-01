(function () {
  const root = document.documentElement;
  const page = root.dataset.page;
  const base = root.dataset.base || "./";
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || "");

  let chrome = { data: null, site: null, lang: "en" };
  let paintProjects = () => {};
  let paintQa = () => {};
  let toastTimer = 0;

  const el = (tag, props, children) => {
    const node = document.createElement(tag);
    if (props) {
      Object.entries(props).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key.startsWith("on") && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (value === false && !key.startsWith("aria-")) return;
        else node.setAttribute(key, value === true && !key.startsWith("aria-") ? "" : String(value));
      });
    }
    (children || []).forEach((child) => {
      if (child) node.append(child);
    });
    return node;
  };

  const paragraphs = (texts) => (texts || []).map((text) => el("p", { text }));

  function svgIcon(className, html) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", className);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.innerHTML = html;
    return svg;
  }

  async function loadJson(path) {
    const res = await fetch(base + path, { cache: "no-store" });
    if (!res.ok) throw new Error("Cannot load " + path);
    return res.json();
  }

  function detectLang() {
    const stored = localStorage.getItem("site-lang");
    if (stored === "uk" || stored === "en") return stored;
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("uk") ? "uk" : "en";
  }

  function detectTheme() {
    const stored = localStorage.getItem("site-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.style.backgroundColor = theme === "dark" ? "#101614" : "#eef3ef";
  }

  function setTheme(theme) {
    localStorage.setItem("site-theme", theme);
    applyTheme(theme);
    const btn = document.querySelector("[data-theme-toggle]");
    if (btn) {
      btn.setAttribute("aria-pressed", String(theme === "dark"));
      btn.setAttribute("data-theme", theme);
    }
  }

  function toggleTheme() {
    setTheme(root.dataset.theme === "dark" ? "light" : "dark");
  }

  function setLang(lang) {
    localStorage.setItem("site-lang", lang);
    location.reload();
  }

  function contentFile(lang) {
    if (page === "notes") return `content/notes-${lang}.json`;
    if (page === "qa") return `content/qa-${lang}.json`;
    if (page === "sandbox") return `content/sandbox-${lang}.json`;
    if (page === "sandbox-docs") return `content/sandbox-docs-${lang}.json`;
    if (page === "learn") return `content/learn-${lang}.json`;
    return `content/${lang}.json`;
  }

  function href(path) {
    return base + path;
  }

  function homeHref(hash) {
    const rootPath = page === "home" ? "./" : base;
    if (!hash || hash === "top") return rootPath;
    return rootPath + "#" + hash;
  }

  function notesHref() {
    return page === "notes" ? "./" : base + "notes/";
  }

  function qaHref(hash) {
    const path = page === "qa" ? "./" : base + "qa/";
    return hash ? path + "#" + hash : path;
  }

  function sandboxHref() {
    return page === "sandbox" ? "./" : base + "sandbox/";
  }

  function sandboxDocsHref(hash) {
    const id = hash || "docs";
    if (page === "sandbox") return "#" + id;
    return sandboxHref() + "#" + id;
  }

  function learnHref() {
    return page === "learn" ? "./" : base + "learn/";
  }

  const CV_SECTIONS = ["top", "experience", "skills", "contact"];
  const FOUND_KEY = "mk-access-found";

  function hashId() {
    return decodeURIComponent((location.hash || "").replace("#", ""));
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9а-яіїєґ]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
  }

  function qaItemId(item) {
    if (!item._qid) item._qid = "q-" + (slugify(item.q) || "item");
    return item._qid;
  }

  function setCvNavCurrent(id) {
    document.querySelectorAll("[data-cv-section]").forEach((link) => {
      if (link.dataset.cvSection === id) {
        link.setAttribute("aria-current", id === "top" ? "page" : "location");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function highlightSection(id) {
    document.querySelectorAll("main > section.is-target").forEach((node) => {
      node.classList.remove("is-target");
    });
    if (!id || id === "top") return;
    const node = document.getElementById(id);
    if (!node) return;
    void node.offsetWidth;
    node.classList.add("is-target");
  }

  function scrollToHash() {
    const id = hashId();
    if (!id) return;
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: "instant", block: "start" });
    setCvNavCurrent(CV_SECTIONS.includes(id) ? id : "top");
    highlightSection(id);
  }

  function goToCvSection(id, event) {
    if (page !== "home") return;
    if (event) event.preventDefault();
    const node = document.getElementById(id);
    if (!node) return;
    closeMenu();
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    const path = location.pathname.replace(/index\.html$/, "") || "./";
    const search = location.search || "";
    history.pushState(null, "", id === "top" ? path + search : path + search + "#" + id);
    setCvNavCurrent(id);
    highlightSection(id);
  }

  function watchCvSections() {
    if (page !== "home") return;
    const nodes = CV_SECTIONS.map((id) => document.getElementById(id)).filter(Boolean);
    if (!nodes.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setCvNavCurrent(visible.target.id);
      },
      { rootMargin: "-28% 0px -58% 0px", threshold: [0.1, 0.25, 0.5] }
    );
    nodes.forEach((node) => observer.observe(node));
    window.addEventListener("hashchange", scrollToHash);
    window.addEventListener("popstate", () => {
      scrollToHash();
      paintProjects();
    });
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function startTerminal(term, mount) {
    const body = mount.querySelector(".term-body");
    if (!body || !term) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cursor = () => el("span", { class: "cursor", "aria-hidden": "true" });

    async function typeInto(node, text) {
      for (const char of text) {
        node.textContent += char;
        await sleep(22 + Math.random() * 28);
      }
    }

    async function run() {
      body.replaceChildren();
      for (const row of term.lines || []) {
        if (row.type === "cmd") {
          const cmd = el("span", { class: "term-cmd" });
          const caret = cursor();
          const line = el("div", { class: "term-line" }, [
            el("span", { class: "term-prompt", text: term.prompt + " " }),
            cmd,
            caret,
          ]);
          body.append(line);
          if (reduce) cmd.textContent = row.text;
          else await typeInto(cmd, row.text);
          caret.remove();
          await sleep(reduce ? 0 : 180);
        } else {
          body.append(el("div", { class: "term-line term-out", text: row.text }));
          await sleep(reduce ? 0 : 240);
        }
      }
      body.append(
        el("div", { class: "term-line" }, [
          el("span", { class: "term-prompt", text: term.prompt + " " }),
          cursor(),
        ])
      );
    }

    run();
  }

  function renderTerminal(term) {
    if (!term) return null;
    return el("aside", { class: "term", "aria-label": term.label }, [
      el("div", { class: "term-bar" }, [
        el("span", { class: "term-dot term-dot-r", "aria-hidden": "true" }),
        el("span", { class: "term-dot term-dot-y", "aria-hidden": "true" }),
        el("span", { class: "term-dot term-dot-g", "aria-hidden": "true" }),
        el("span", { class: "term-title", text: term.title }),
      ]),
      el("div", { class: "term-body" }),
    ]);
  }

  function hasContact(value) {
    return Boolean(value && String(value).trim());
  }

  function contactHref(type, value) {
    if (type === "email") return "mailto:" + value;
    if (type === "telegram") {
      if (value.startsWith("http")) return value;
      return "https://t.me/" + value.replace(/^@/, "");
    }
    return value;
  }

  function contactNick(type, value) {
    if (type === "email") return value;
    try {
      if (type === "telegram") {
        if (value.includes("t.me/")) return "@" + value.split("t.me/")[1].replace(/\/$/, "");
        return value.startsWith("@") ? value : "@" + value;
      }
      const path = new URL(value).pathname.split("/").filter(Boolean);
      return path[path.length - 1] || value;
    } catch {
      return value;
    }
  }

  function contactIco(type) {
    if (type === "email") return "@";
    if (type === "linkedin") return "in";
    if (type === "telegram") return "tg";
    return "gh";
  }

  function setMenuOpen(open) {
    document.body.classList.toggle("nav-open", open);
    const btn = document.querySelector("[data-menu-toggle]");
    if (btn) btn.setAttribute("aria-expanded", String(open));
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleMenu() {
    setMenuOpen(!document.body.classList.contains("nav-open"));
  }

  function showToast(text) {
    let toast = document.getElementById("site-toast");
    if (!toast) {
      toast = el("div", {
        id: "site-toast",
        class: "toast",
        role: "status",
        "data-testid": "toast",
      });
      document.body.append(toast);
    }
    toast.textContent = text;
    toast.classList.remove("is-on");
    void toast.offsetWidth;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), 2200);
  }

  function markCopied(button, okLabel) {
    if (!button) return;
    if (!button.dataset.copyLabel) button.dataset.copyLabel = button.textContent;
    button.textContent = okLabel;
    button.classList.add("is-copied");
    clearTimeout(Number(button.dataset.copyTimer));
    const timer = setTimeout(() => {
      button.textContent = button.dataset.copyLabel;
      button.classList.remove("is-copied");
    }, 2200);
    button.dataset.copyTimer = String(timer);
  }

  async function copyText(text, okLabel, button) {
    const done = okLabel || "Copied";
    markCopied(button, done);
    showToast(done);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const box = el("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.left = "-9999px";
      document.body.append(box);
      box.select();
      document.execCommand("copy");
      box.remove();
    }
  }

  function repoFromUrl(url) {
    const match = String(url || "").match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (!match) return null;
    return match[1] + "/" + match[2].replace(/\.git$/, "");
  }

  async function githubMeta(url) {
    const repo = repoFromUrl(url);
    if (!repo) return null;
    const key = "gh:" + repo;
    try {
      const cached = sessionStorage.getItem(key);
      if (cached) return JSON.parse(cached);
    } catch {
      /* ignore quota / private mode */
    }
    try {
      const res = await fetch("https://api.github.com/repos/" + repo);
      if (!res.ok) return null;
      const data = await res.json();
      const meta = {
        stars: data.stargazers_count,
        language: data.language,
        updated: data.pushed_at ? String(data.pushed_at).slice(0, 10) : "",
      };
      try {
        sessionStorage.setItem(key, JSON.stringify(meta));
      } catch {
        /* ignore */
      }
      return meta;
    } catch {
      return null;
    }
  }

  async function hydrateGithub(scope, labels) {
    const nodes = (scope || document).querySelectorAll("[data-repo]");
    await Promise.all(
      [...nodes].map(async (node) => {
        const meta = await githubMeta(node.dataset.repo);
        if (!meta) {
          node.remove();
          return;
        }
        const bits = [
          meta.language,
          meta.stars ? "★ " + meta.stars : "",
          meta.updated ? (labels.updated || "Updated") + " " + meta.updated : "",
        ].filter(Boolean);
        node.textContent = bits.join(" · ");
      })
    );
  }

  function kindFromUrl() {
    const kind = new URLSearchParams(location.search).get("kind");
    if (["task", "pet", "practice", "notes"].includes(kind)) return kind;
    return "all";
  }

  function setKind(kind) {
    const url = new URL(location.href);
    if (!kind || kind === "all") url.searchParams.delete("kind");
    else url.searchParams.set("kind", kind);
    const hash = url.hash && url.hash !== "#top" ? url.hash : "#projects";
    history.pushState(null, "", url.pathname + url.search + hash);
    paintProjects();
    const projects = document.getElementById("projects");
    if (projects) projects.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function ensureOverlay() {
    if (document.querySelector(".nav-overlay")) return;
    document.body.append(
      el("div", {
        class: "nav-overlay",
        "aria-hidden": "true",
        onPointerDown: (event) => {
          event.preventDefault();
          closeMenu();
        },
      })
    );
  }

  function paletteItems() {
    const { data, site, lang } = chrome;
    if (!data) return [];
    const nav = data.nav;
    const items = [
      { id: "home", label: nav.home, hint: "Page", href: homeHref(), section: page === "home" ? "top" : null },
      { id: "exp", label: nav.experience, hint: "CV", href: homeHref("experience"), section: "experience" },
      { id: "skills", label: nav.skills, hint: "CV", href: homeHref("skills"), section: "skills" },
      { id: "contact", label: nav.contacts, hint: "CV", href: homeHref("contact"), section: "contact" },
      { id: "notes", label: nav.notes, hint: nav.pages || "Pages", href: notesHref() },
      { id: "qa", label: nav.qa, hint: nav.pages || "Pages", href: qaHref() },
      { id: "sandbox", label: nav.challenge, hint: nav.pages || "Pages", href: sandboxHref() },
      {
        id: "sandbox-docs",
        label: nav.consoleDocs || (lang === "uk" ? "Доку консолі" : "Console docs"),
        hint: nav.pages || "Pages",
        href: sandboxDocsHref(),
      },
      { id: "learn", label: nav.learn, hint: nav.pages || "Pages", href: learnHref() },
      {
        id: "theme",
        label: lang === "uk" ? "Перемкнути тему" : "Toggle theme",
        hint: nav.command,
        run: () => toggleTheme(),
      },
    ];
    const guide = chrome.guide;
    if (page === "sandbox" && guide && guide.sections) {
      guide.sections.forEach((section) => {
        items.push({
          id: "g-" + section.id,
          label: section.title,
          hint: nav.consoleDocs || "Docs",
          href: sandboxDocsHref(section.id),
        });
      });
    }
    if (hasContact(site && site.pdf)) {
      items.push({
        id: "pdf",
        label: nav.download,
        hint: "PDF",
        href: href(site.pdf),
      });
    }
    (data.projects && data.projects.items ? data.projects.items : []).forEach((item) => {
      items.push({
        id: "p-" + slugify(item.name),
        label: item.name,
        hint: item.kind,
        href: item.url,
        external: true,
      });
    });
    (data.groups || []).forEach((group) => {
      (group.items || []).forEach((item) => {
        items.push({
          id: qaItemId(item),
          label: item.q,
          hint: group.title,
          href: qaHref(qaItemId(item)),
          qaId: qaItemId(item),
        });
      });
    });
    return items;
  }

  function runPaletteItem(item) {
    closePalette();
    if (!item) return;
    if (item.run) {
      item.run();
      return;
    }
    if (item.qaId && page === "qa") {
      location.hash = item.qaId;
      paintQa();
      return;
    }
    if (item.section && page === "home") {
      goToCvSection(item.section);
      return;
    }
    if (item.external && item.href) {
      window.open(item.href, "_blank", "noreferrer");
      return;
    }
    if (item.href) location.assign(item.href);
  }

  function closePalette() {
    const pal = document.getElementById("command-palette");
    if (!pal) return;
    pal.hidden = true;
    document.body.classList.remove("palette-open");
  }

  function openPalette() {
    closeMenu();
    const pal = document.getElementById("command-palette");
    if (!pal) return;
    pal.hidden = false;
    document.body.classList.add("palette-open");
    const input = pal.querySelector("input");
    input.value = "";
    renderPaletteList("");
    input.focus();
  }

  function renderPaletteList(query) {
    const pal = document.getElementById("command-palette");
    if (!pal) return;
    const list = pal.querySelector("[data-palette-list]");
    const empty = pal.querySelector("[data-palette-empty]");
    const q = (query || "").trim().toLowerCase();
    const items = paletteItems().filter((item) => {
      if (!q) return true;
      return (item.label + " " + (item.hint || "")).toLowerCase().includes(q);
    });
    list.replaceChildren();
    pal.dataset.active = "0";
    if (!items.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    items.forEach((item, index) => {
      list.append(
        el("button", {
          type: "button",
          class: "palette-item" + (index === 0 ? " is-active" : ""),
          role: "option",
          id: "palette-opt-" + index,
          "aria-selected": index === 0,
          "data-index": String(index),
          onMouseEnter: () => setPaletteActive(index),
          onClick: () => runPaletteItem(item),
        }, [
          el("span", { class: "palette-item-label", text: item.label }),
          item.hint ? el("span", { class: "palette-item-hint", text: item.hint }) : null,
        ])
      );
    });
    list._items = items;
  }

  function setPaletteActive(index) {
    const pal = document.getElementById("command-palette");
    if (!pal) return;
    const list = pal.querySelector("[data-palette-list]");
    const buttons = [...list.querySelectorAll(".palette-item")];
    if (!buttons.length) return;
    const next = (index + buttons.length) % buttons.length;
    pal.dataset.active = String(next);
    buttons.forEach((btn, i) => {
      btn.classList.toggle("is-active", i === next);
      btn.setAttribute("aria-selected", String(i === next));
    });
    buttons[next].scrollIntoView({ block: "nearest" });
  }

  function bindPaletteKeys(input) {
    input.addEventListener("keydown", (event) => {
      const pal = document.getElementById("command-palette");
      const list = pal.querySelector("[data-palette-list]");
      const items = list._items || [];
      const active = Number(pal.dataset.active || 0);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPaletteActive(active + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setPaletteActive(active - 1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        runPaletteItem(items[active]);
      } else if (event.key === "Escape") {
        event.preventDefault();
        closePalette();
      }
    });
  }

  function ensurePalette(nav) {
    if (document.getElementById("command-palette")) return;
    const input = el("input", {
      class: "palette-input",
      type: "search",
      "data-testid": "command-input",
      placeholder: nav.commandHint,
      "aria-label": nav.command,
      autocomplete: "off",
      onInput: (event) => renderPaletteList(event.target.value),
    });
    bindPaletteKeys(input);
    const panel = el("div", { class: "palette-panel", role: "listbox" }, [
      el("div", { class: "palette-bar" }, [
        el("span", { class: "palette-prompt", text: "MK:~$" }),
        input,
      ]),
      el("div", { class: "palette-list", "data-palette-list": "true" }),
      el("p", {
        class: "palette-empty",
        "data-palette-empty": "true",
        hidden: true,
        text: nav.commandEmpty,
      }),
    ]);
    const pal = el("div", {
      id: "command-palette",
      class: "palette",
      hidden: true,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": nav.command,
      "data-testid": "command-palette",
      onClick: (event) => {
        if (event.target === pal) closePalette();
      },
    }, [panel]);
    document.body.append(pal);
  }

  function bindGlobalKeys() {
    window.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const pal = document.getElementById("command-palette");
        if (pal && !pal.hidden) closePalette();
        else openPalette();
      } else if (event.key === "Escape") {
        closePalette();
        closeMenu();
      }
    });
  }

  function renderHeader(nav, site, lang) {
    const pdfReady = hasContact(site.pdf);
    const theme = detectTheme();
    const themeLabel = lang === "uk" ? "Світла або темна тема" : "Light or dark theme";
    const shortcut = isMac ? "⌘K" : "Ctrl+K";
    const ctaFull =
      (chrome.data && chrome.data.hero && chrome.data.hero.challengeCta) ||
      (lang === "uk" ? "Спробуй себе як QA" : "Try yourself as a QA");
    const actions = el("div", { class: "header-actions" }, [
      el("a", {
        class: "btn btn-primary challenge-cta",
        href: sandboxHref(),
        "data-testid": "challenge-cta",
        "aria-current": page === "sandbox" ? "page" : null,
        onClick: closeMenu,
      }, [
        el("span", { class: "cta-full", text: ctaFull }),
        el("span", { class: "cta-short", text: nav.challenge }),
      ]),
      el("button", {
        class: "cmd-btn",
        type: "button",
        "data-testid": "command-open",
        "aria-label": nav.command + " " + shortcut,
        onClick: openPalette,
      }, [
        el("span", { class: "cmd-btn-text", text: nav.command }),
        el("kbd", { text: shortcut }),
      ]),
      pdfReady
        ? el("a", {
            class: "btn btn-ghost",
            href: href(site.pdf),
            download: "",
            text: nav.download,
          })
        : page === "home"
          ? el("button", {
              class: "btn btn-ghost",
              type: "button",
              text: nav.print,
              onClick: () => window.print(),
            })
          : null,
      el("button", {
        class: "theme-toggle",
        type: "button",
        "data-theme-toggle": "true",
        "data-theme": theme,
        "aria-pressed": theme === "dark",
        "aria-label": themeLabel,
        title: themeLabel,
        onClick: toggleTheme,
      }, [
        el("span", { class: "theme-toggle-track", "aria-hidden": "true" }, [
          svgIcon(
            "theme-icon theme-icon-sun",
            '<circle cx="12" cy="12" r="4" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></g>'
          ),
          el("span", { class: "theme-toggle-knob" }),
          svgIcon(
            "theme-icon theme-icon-moon",
            '<path fill="currentColor" d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7.2 7.2 0 0 0 12 21a8.5 8.5 0 0 0 9-6.5z"/>'
          ),
        ]),
      ]),
      el("div", { class: "lang", role: "group", "aria-label": "Language" }, [
        el("button", {
          type: "button",
          text: "UA",
          "aria-pressed": lang === "uk",
          onClick: () => setLang("uk"),
        }),
        el("button", {
          type: "button",
          text: "EN",
          "aria-pressed": lang === "en",
          onClick: () => setLang("en"),
        }),
      ]),
      el("button", {
        class: "menu-toggle",
        type: "button",
        "data-menu-toggle": "true",
        "data-testid": "menu-toggle",
        "aria-expanded": "false",
        "aria-controls": "site-nav",
        "aria-label": nav.menu,
        onClick: toggleMenu,
      }, [
        el("span", { class: "menu-toggle-bar", "aria-hidden": "true" }),
        el("span", { class: "menu-toggle-bar", "aria-hidden": "true" }),
        el("span", { class: "menu-toggle-bar", "aria-hidden": "true" }),
      ]),
    ]);

    const header = document.getElementById("site-header");
    header.replaceChildren(
      el("div", { class: "header-inner" }, [
        el("a", { class: "brand", href: homeHref(), text: "MK" }),
        el("nav", { class: "nav", id: "site-nav", "data-testid": "site-nav", "aria-label": "Main" }, [
          el("div", { class: "nav-group", "aria-label": nav.onPage || "On this page" }, [
            el("a", {
              href: homeHref(),
              text: nav.home,
              "data-cv-section": "top",
              "aria-current": page === "home" && !hashId() ? "page" : null,
              onClick: (event) => goToCvSection("top", event),
            }),
            el("a", {
              href: homeHref("experience"),
              text: nav.experience,
              "data-cv-section": "experience",
              onClick: (event) => goToCvSection("experience", event),
            }),
            el("a", {
              href: homeHref("skills"),
              text: nav.skills,
              "data-cv-section": "skills",
              onClick: (event) => goToCvSection("skills", event),
            }),
            el("a", {
              href: homeHref("contact"),
              text: nav.contacts,
              "data-cv-section": "contact",
              onClick: (event) => goToCvSection("contact", event),
            }),
          ]),
          el("span", { class: "nav-split", "aria-hidden": "true" }),
          el("div", { class: "nav-group nav-pages", "aria-label": nav.pages || "Pages" }, [
            el("span", { class: "nav-pages-label", text: nav.pages || "Pages" }),
            el("a", {
              href: notesHref(),
              text: nav.notes,
              "aria-current": page === "notes" ? "page" : null,
              onClick: closeMenu,
            }),
            el("a", {
              href: qaHref(),
              text: nav.qa,
              "aria-current": page === "qa" ? "page" : null,
              onClick: closeMenu,
            }),
            el("a", {
              href: learnHref(),
              text: nav.learn,
              "aria-current": page === "learn" ? "page" : null,
              onClick: closeMenu,
            }),
            el("a", {
              class: "nav-challenge",
              href: sandboxHref(),
              text: nav.challenge,
              "aria-current": page === "sandbox" ? "page" : null,
              onClick: closeMenu,
            }),
          ]),
        ]),
        actions,
      ])
    );
    ensureOverlay();
    ensurePalette(nav);
  }

  const DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/";
  const SKILL_ICONS = {
    "typescript (playwright)": [
      "typescript/typescript-original.svg",
      "playwright/playwright-original.svg",
    ],
    "java (selenium, rest assured)": [
      "java/java-original.svg",
      "selenium/selenium-original.svg",
    ],
    "ui testing": ["chrome/chrome-original.svg"],
    "api testing": ["postman/postman-original.svg"],
    "e2e testing": ["playwright/playwright-original.svg"],
    "postman": ["postman/postman-original.svg"],
    "newman": ["postman/postman-original.svg"],
    "playwright apirequest": ["playwright/playwright-original.svg"],
    "postgresql": ["postgresql/postgresql-original.svg"],
    "nosql": ["mongodb/mongodb-original.svg"],
    "jenkins": ["jenkins/jenkins-original.svg"],
    "github actions": ["githubactions/githubactions-original.svg"],
    "git": ["git/git-original.svg"],
    "graylog": ["img/skills/graylog.svg"],
    "datadog": ["datadog/datadog-original.svg"],
    "chrome devtools": ["chrome/chrome-original.svg"],
    "charles proxy": ["img/skills/charles.svg"],
    "sentry": ["sentry/sentry-original.svg"],
    "allure": ["img/skills/allure.svg"],
    "auth / tokens / cookies": ["oauth/oauth-original.svg"],
  };
  const SKILL_ICO_DARK = {
    "github/github-original.svg": true,
    "oauth/oauth-original.svg": true,
    "sentry/sentry-original.svg": true,
    "img/skills/charles.svg": true,
    "img/skills/graylog.svg": true,
  };

  function skillIconSrc(path) {
    if (path.startsWith("http")) return path;
    if (path.startsWith("img/")) return base + path;
    return DEVICON + path;
  }

  function renderSkillChip(item) {
    const icons = SKILL_ICONS[String(item).toLowerCase()] || [];
    return el("li", { class: icons.length ? "chip-with-ico" : null }, [
      ...icons.map((path) =>
        el("img", {
          class: "chip-ico" + (SKILL_ICO_DARK[path] ? " chip-ico-dark" : ""),
          src: skillIconSrc(path),
          alt: "",
          width: "16",
          height: "16",
          decoding: "async",
        })
      ),
      el("span", { text: item }),
    ]);
  }

  function renderHome(data, site) {
    const c = data.contact;
    const p = data.projects;
    const links = [
      ["email", c.email, site.email],
      ["linkedin", c.linkedin, site.linkedin],
      ["telegram", c.telegram, site.telegram],
      ["github", c.github, site.github],
    ].filter(([, , value]) => hasContact(value));

    const term = renderTerminal(data.terminal);
    const list = el("div", { class: "project-list", "data-testid": "project-list" });
    const filters = p.filters || {};
    const filterKeys = ["all", "task", "pet", "practice", "notes"];

    paintProjects = () => {
      const kind = kindFromUrl();
      document.querySelectorAll("[data-kind-filter]").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.kindFilter === kind));
      });
      const items = (p.items || []).filter((item) => kind === "all" || item.filter === kind);
      list.replaceChildren();
      if (!items.length) {
        list.append(el("p", { class: "lede", text: p.emptyFilter }));
        return;
      }
      items.forEach((item) => {
        list.append(
          el("article", { class: "project", "data-kind": item.filter || "" }, [
            el("h3", {}, [
              item.url
                ? el("a", {
                    class: "project-link",
                    href: item.url,
                    target: "_blank",
                    rel: "noreferrer",
                    text: item.name,
                  })
                : el("span", { text: item.name }),
            ]),
            el("p", { class: "kind", text: item.kind }),
            item.url
              ? el("p", { class: "project-meta", "data-repo": item.url })
              : null,
            el("p", { text: item.text }),
          ])
        );
      });
      hydrateGithub(list, p);
    };

    const main = document.getElementById("main");
    const wins = data.wins;
    main.replaceChildren(
      el("section", { class: "hero", id: "top" }, [
        el("div", { class: "hero-copy" }, [
          data.hero.badge ? el("p", { class: "badge badge-open", text: data.hero.badge }) : null,
          el("h1", { text: data.hero.name }),
          el("p", { class: "role", text: data.hero.role }),
          el("p", { class: "location", text: data.hero.location }),
          el("p", { class: "pitch", text: data.hero.pitch }),
          el("div", { class: "hero-actions" }, [
            el("a", {
              class: "btn btn-primary",
              href: sandboxHref(),
              text: data.hero.challengeCta || data.nav.challenge,
            }),
            hasContact(site.pdf)
              ? el("a", {
                  class: "btn btn-ghost",
                  href: href(site.pdf),
                  download: "",
                  text: data.nav.download,
                })
              : hasContact(site.email)
                ? el("a", {
                    class: "btn btn-ghost",
                    href: "mailto:" + site.email,
                    text: c.email,
                  })
                : null,
            el("a", {
              class: "btn btn-ghost",
              href: notesHref(),
              text: data.now.notesLink,
            }),
            el("a", {
              class: "btn btn-ghost",
              href: qaHref(),
              text: data.now.qaLink,
            }),
          ]),
        ]),
        term,
      ]),
      el("section", { id: "about" }, [
        el("h2", { text: data.about.title }),
        ...paragraphs(data.about.paragraphs),
      ]),
      el("section", { id: "experience" }, [
        el("h2", { text: data.experience.title }),
        ...data.experience.jobs.map((job) =>
          el("article", { class: "job" }, [
            el("div", { class: "job-head" }, [
              el("h3", { text: job.company + " · " + job.role }),
              el("div", { class: "job-meta" }, [
                job.domain ? el("span", { class: "domain-chip", text: job.domain }) : null,
                job.period ? el("span", { class: "period", text: job.period }) : null,
              ]),
            ]),
            job.place ? el("p", { class: "place", text: job.place }) : null,
            el(
              "ul",
              {},
              job.points.map((point) => el("li", { text: point }))
            ),
            job.stack ? el("p", { class: "stack", text: job.stack }) : null,
          ])
        ),
      ]),
      el("section", { id: "skills" }, [
        el("h2", { text: data.skills.title }),
        ...data.skills.groups.map((group) =>
          el("div", { class: "skill-group" }, [
            el("h3", { text: group.name }),
            el(
              "ul",
              { class: "chips" },
              group.items.map((item) => renderSkillChip(item))
            ),
          ])
        ),
      ]),
      wins
        ? el("section", { id: "wins" }, [
            el("h2", { text: wins.title }),
            el(
              "div",
              { class: "wins-grid" },
              (wins.items || []).map((item) =>
                el("article", { class: "win-card" }, [
                  el("p", { class: "win-tag", text: item.tag }),
                  el("p", { text: item.text }),
                ])
              )
            ),
          ])
        : el("section", { id: "wins", hidden: true }),
      el("section", { id: "now" }, [
        el("h2", { text: data.now.title }),
        el("div", { class: "now-card" }, [
          el("p", { text: data.now.body }),
          el("div", { class: "now-links" }, [
            el("a", {
              class: "btn btn-primary",
              href: notesHref(),
              text: data.now.notesLink,
            }),
            el("a", {
              class: "btn btn-ghost",
              href: qaHref(),
              text: data.now.qaLink,
            }),
          ]),
        ]),
      ]),
      el("section", { id: "education" }, [
        el("h2", { text: data.education.title }),
        el(
          "ul",
          { class: "plain-list" },
          data.education.items.map((item) => el("li", { text: item }))
        ),
      ]),
      el("section", { id: "hobbies" }, [
        el("h2", { text: data.hobbies.title }),
        el(
          "ul",
          { class: "plain-list" },
          data.hobbies.items.map((item) => el("li", { text: item }))
        ),
      ]),
      el("section", { id: "projects" }, [
        el("h2", { text: p.title }),
        el("p", { class: "lede", text: p.intro }),
        el(
          "div",
          {
            class: "kind-filters",
            role: "group",
            "aria-label": p.title,
            "data-testid": "project-filters",
          },
          filterKeys.map((key) =>
            el("button", {
              type: "button",
              class: "kind-filter",
              "data-kind-filter": key,
              "aria-pressed": kindFromUrl() === key,
              text: filters[key] || key,
              onClick: () => setKind(key),
            })
          )
        ),
        list,
      ]),
      el("section", { id: "contact" }, [
        el("h2", { text: c.title }),
        links.length
          ? el(
              "div",
              { class: "contacts" },
              links.map(([type, label, value]) => {
                const card = el("a", {
                  class: "contact-card",
                  href: contactHref(type, value),
                  rel: type === "email" ? null : "noreferrer",
                  target: type === "email" ? null : "_blank",
                }, [
                  el("span", { class: "contact-ico", "aria-hidden": "true", text: contactIco(type) }),
                  el("span", { class: "contact-copy" }, [
                    el("span", { class: "contact-label", text: label }),
                    el("span", { class: "contact-nick", text: contactNick(type, value) }),
                  ]),
                  el("span", { class: "contact-arrow", "aria-hidden": "true", text: "→" }),
                ]);
                if (type !== "email") return card;
                return el("div", { class: "contact-row" }, [
                  card,
                  el("button", {
                    class: "copy-btn",
                    type: "button",
                    "data-testid": "copy-email",
                    text: c.copy,
                    onClick: (event) => copyText(value, c.copied, event.currentTarget),
                  }),
                ]);
              })
            )
          : el("p", { class: "empty-contacts", text: c.empty }),
      ])
    );
    paintProjects();
    if (term) startTerminal(data.terminal, term);
  }

  function renderNotes(data) {
    const main = document.getElementById("main");
    const featured = data.featured;
    const featuredBlock = featured
      ? el("article", { class: "note featured-note" }, [
          el("h2", { text: featured.title }),
          el("p", { text: featured.lead }),
          el(
            "ul",
            { class: "topic-list" },
            (featured.topics || []).map((topic) =>
              el("li", {}, [
                el("a", {
                  href: topic.url,
                  target: "_blank",
                  rel: "noreferrer",
                  text: topic.name,
                }),
                el("span", { text: topic.text }),
              ])
            )
          ),
          el("p", { class: "featured-cta" }, [
            el("a", {
              class: "btn btn-primary",
              href: featured.url,
              target: "_blank",
              rel: "noreferrer",
              text: featured.cta,
            }),
          ]),
        ])
      : null;
    main.replaceChildren(
      ...[
        el("header", { class: "hero" }, [
          el("h1", { text: data.title }),
          el("p", { class: "pitch", text: data.intro }),
          el("div", { class: "hero-actions" }, [
            el("a", {
              class: "btn btn-primary",
              href: qaHref(),
              text: data.qaCta,
            }),
          ]),
        ]),
        featuredBlock,
        ...data.sections.map((section) =>
          el("article", { class: "note" }, [
            el("h2", { text: section.title }),
            ...paragraphs(section.paragraphs),
          ])
        ),
      ].filter(Boolean)
    );
  }

  function renderQa(data) {
    const main = document.getElementById("main");
    const list = el("div", { id: "qa-list" });
    const search = el("input", {
      class: "filter",
      type: "search",
      placeholder: data.searchPlaceholder,
      "aria-label": data.searchPlaceholder,
      "data-testid": "qa-search",
    });
    let tag = "";
    (data.groups || []).forEach((group) => {
      (group.items || []).forEach((item) => qaItemId(item));
    });

    const openFromHash = () => {
      const id = hashId();
      if (!id) return;
      const group = data.groups.find((g) => g.id === id);
      if (group) {
        tag = group.id;
        return;
      }
      const hit = data.groups.some((g) => g.items.some((item) => qaItemId(item) === id));
      if (hit) {
        tag = "";
        search.value = "";
      }
    };

    paintQa = () => {
      openFromHash();
      const q = (search.value || "").trim().toLowerCase();
      document.querySelectorAll("[data-qa-tag]").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.qaTag === tag));
      });
      list.replaceChildren();
      let shown = 0;
      data.groups.forEach((group) => {
        if (tag && group.id !== tag) return;
        const items = group.items.filter((item) => {
          if (!q) return true;
          return (item.q + " " + item.a).toLowerCase().includes(q);
        });
        if (!items.length) return;
        shown += items.length;
        list.append(
          el("section", { class: "qa-group" }, [
            el("h2", { text: group.title }),
            ...items.map((item) => {
              const id = qaItemId(item);
              const details = el("details", { id }, [
                el("summary", { text: item.q }),
                el("div", { class: "qa-answer" }, [
                  el("p", { text: item.a }),
                ]),
              ]);
              details.addEventListener("toggle", () => {
                if (details.open) {
                  history.replaceState(null, "", "#" + id);
                }
              });
              return details;
            }),
          ])
        );
      });
      if (!shown) {
        list.append(el("p", { class: "lede", text: data.emptyFilter }));
      }
      const id = hashId();
      if (id && id.startsWith("q-")) {
        const node = document.getElementById(id);
        if (node && node.tagName === "DETAILS") {
          node.open = true;
          node.scrollIntoView({ behavior: "instant", block: "start" });
        }
      }
    };

    search.addEventListener("input", () => {
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      paintQa();
    });

    main.replaceChildren(
      el("header", { class: "hero" }, [
        el("p", { class: "badge", text: data.badge }),
        el("h1", { text: data.title }),
        el("p", { class: "pitch", text: data.intro }),
        el("div", { class: "hero-actions" }, [
          el("a", {
            class: "btn btn-ghost",
            href: notesHref(),
            text: data.notesCta,
          }),
        ]),
      ]),
      el(
        "div",
        { class: "qa-tags", role: "group", "aria-label": data.title, "data-testid": "qa-tags" },
        [
          el("button", {
            type: "button",
            class: "kind-filter",
            "data-qa-tag": "",
            "aria-pressed": !tag,
            text: data.allTags,
            onClick: () => {
              const y = window.scrollY;
              tag = "";
              history.replaceState(null, "", location.pathname + location.search);
              paintQa();
              window.scrollTo(0, y);
            },
          }),
          ...data.groups.map((group) =>
            el("button", {
              type: "button",
              class: "kind-filter",
              "data-qa-tag": group.id,
              text: group.title,
              onClick: () => {
                const y = window.scrollY;
                tag = tag === group.id ? "" : group.id;
                history.replaceState(null, "", tag ? "#" + tag : location.pathname + location.search);
                paintQa();
                window.scrollTo(0, y);
              },
            })
          ),
        ]
      ),
      search,
      list
    );
    window.addEventListener("hashchange", paintQa);
    paintQa();
  }

  function readFound() {
    try {
      const raw = JSON.parse(localStorage.getItem(FOUND_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function writeFound(ids) {
    localStorage.setItem(FOUND_KEY, JSON.stringify(ids));
  }

  function renderGuideBlocks(blocks) {
    return (blocks || []).map((block) => {
      if (!block || !block.type) return null;
      if (block.type === "p") return el("p", { text: block.text });
      if (block.type === "h3") return el("h3", { text: block.text });
      if (block.type === "note") return el("p", { class: "guide-note", text: block.text });
      if (block.type === "code") return el("pre", { class: "guide-code", text: block.text });
      if (block.type === "ul") {
        return el("ul", {}, (block.items || []).map((item) => el("li", { text: item })));
      }
      if (block.type === "table") {
        return el("div", { class: "guide-table-wrap" }, [
          el("table", { class: "guide-table" }, [
            el("thead", {}, [
              el("tr", {}, (block.headers || []).map((header) => el("th", { text: header }))),
            ]),
            el("tbody", {}, (block.rows || []).map((row) =>
              el("tr", {}, (row || []).map((cell) => el("td", { text: cell })))
            )),
          ]),
        ]);
      }
      return null;
    });
  }

  function buildGuideLayout(guide) {
    const sections = (guide && guide.sections) || [];
    return el("div", { class: "guide-layout", "data-testid": "console-docs-page" }, [
      el("nav", { class: "guide-toc", "aria-label": guide.toc }, [
        el("p", { class: "guide-toc-label", text: guide.toc }),
        ...sections.map((section) =>
          el("a", { href: "#" + section.id, text: section.title })
        ),
      ]),
      el("div", { class: "guide-body" },
        sections.map((section) =>
          el("section", {
            class: "guide-section note",
            id: section.id,
          }, [
            el("h2", { text: section.title }),
            ...renderGuideBlocks(section.blocks),
          ])
        )
      ),
    ]);
  }

  function isSandboxDocsHash(id, guide) {
    if (!id) return false;
    if (id === "docs") return true;
    if (id === "tests") return false;
    return ((guide && guide.sections) || []).some((section) => section.id === id);
  }

  function sandboxPanelFromHash(id, guide) {
    if (id === "tests") return "tests";
    if (isSandboxDocsHash(id, guide)) return "docs";
    return "console";
  }

  const NG_E2E_OWNER = "KovalenkoMykhailo";
  const NG_E2E_NAME = "northgate-console-e2e";
  const NG_E2E_REPO = "https://github.com/" + NG_E2E_OWNER + "/" + NG_E2E_NAME;
  const NG_E2E_REPORTS = "https://kovalenkomykhailo.github.io/" + NG_E2E_NAME;
  const NG_E2E_ACTIONS = NG_E2E_REPO + "/actions/workflows/e2e.yml";
  const NG_E2E_BADGE = NG_E2E_ACTIONS + "/badge.svg?branch=main";
  function suiteCommand(suite) {
    if (suite === "smoke") return "npm run test:smoke";
    if (suite === "regression") return "npm run test:regression";
    if (suite === "planted") return "npm run test:planted";
    return "npm test";
  }

  function suiteQuery(suite) {
    if (suite === "smoke") return "@smoke";
    if (suite === "planted") return "@planted";
    if (suite === "regression") return "@regression";
    return "";
  }

  function buildTestsPanel(data) {
    const uk = chrome.lang === "uk";
    const htmlUrl = NG_E2E_REPORTS + "/html/index.html";
    const allureUrl = NG_E2E_REPORTS + "/allure/index.html";
    const frame = el("iframe", {
      class: "sandbox-tests-frame",
      "data-testid": "tests-frame",
      title: data.testsFrameHtml || "Playwright HTML report",
      src: htmlUrl,
    });
    const statusEl = el("p", {
      class: "lede sandbox-tests-status",
      "data-testid": "tests-status",
      text: data.testsLastRun || (uk ? "Останній CI…" : "Last CI…"),
    });
    const cmdEl = el("code", {
      class: "sandbox-tests-cmd",
      "data-testid": "tests-cmd",
      text: suiteCommand("all"),
    });
    let suite = "all";
    let frameKind = "html";

    const htmlSrc = (filter) => {
      const q = suiteQuery(filter);
      return q ? htmlUrl + "#?q=" + encodeURIComponent(q) : htmlUrl;
    };

    const setFrame = (kind) => {
      frameKind = kind;
      frame.src = kind === "allure" ? allureUrl : htmlSrc(suite);
      frame.title =
        kind === "allure"
          ? data.testsFrameAllure || "Allure report"
          : data.testsFrameHtml || "Playwright HTML report";
      htmlBtn.classList.toggle("btn-primary", kind === "html");
      htmlBtn.classList.toggle("btn-ghost", kind !== "html");
      allureBtn.classList.toggle("btn-primary", kind === "allure");
      allureBtn.classList.toggle("btn-ghost", kind !== "allure");
    };

    const htmlBtn = el("button", {
      class: "btn btn-primary",
      type: "button",
      "data-testid": "tests-frame-html",
      text: data.testsFrameHtml || "HTML",
    });
    const allureBtn = el("button", {
      class: "btn btn-ghost",
      type: "button",
      "data-testid": "tests-frame-allure",
      text: data.testsFrameAllure || "Allure",
    });
    htmlBtn.addEventListener("click", () => setFrame("html"));
    allureBtn.addEventListener("click", () => setFrame("allure"));

    const suiteBtns = ["smoke", "regression", "all", "planted"].map((id) => {
      const label =
        (data.testsSuites && data.testsSuites[id]) ||
        id.charAt(0).toUpperCase() + id.slice(1);
      const btn = el("button", {
        class: "btn " + (id === "all" ? "btn-primary" : "btn-ghost"),
        type: "button",
        "data-testid": "tests-suite-" + id,
        "data-suite": id,
        text: label,
      });
      btn.addEventListener("click", () => {
        suite = id;
        cmdEl.textContent = suiteCommand(id);
        suiteBtns.forEach((other) => {
          const on = other.getAttribute("data-suite") === id;
          other.classList.toggle("btn-primary", on);
          other.classList.toggle("btn-ghost", !on);
        });
        if (frameKind === "html") setFrame("html");
      });
      return btn;
    });

    const paintLastCi = () => {
      fetch(NG_E2E_REPORTS + "/status.json", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((s) => {
          if (!s) return;
          const when = s.at ? String(s.at).slice(0, 16).replace("T", " ") + "Z" : "";
          statusEl.textContent =
            (data.testsLastRun || (uk ? "Останній CI" : "Last CI")) +
            ": " +
            (s.passed ?? "?") +
            " passed · " +
            (s.failed ?? "?") +
            " failed" +
            (when ? " · " + when : "");
        })
        .catch(() => {});
    };
    paintLastCi();

    return el("section", {
      class: "sandbox-tests note",
      id: "tests",
      "data-testid": "sandbox-tests",
    }, [
      el("h2", { text: data.testsTitle || (uk ? "Автотести" : "Automation") }),
      el("p", { class: "lede", text: data.testsIntro }),
      el("p", {}, [
        el("img", {
          class: "sandbox-tests-badge",
          alt: "e2e",
          src: NG_E2E_BADGE,
        }),
      ]),
      statusEl,
      el("div", { class: "sandbox-tests-links" }, [
        el("a", { class: "btn btn-ghost", href: NG_E2E_REPO, target: "_blank", rel: "noopener", "data-testid": "tests-repo", text: data.testsRepo || "Repo" }),
        el("a", { class: "btn btn-ghost", href: NG_E2E_REPORTS + "/", target: "_blank", rel: "noopener", "data-testid": "tests-reports", text: data.testsReports || "Reports" }),
        el("a", { class: "btn btn-ghost", href: htmlUrl, target: "_blank", rel: "noopener", text: data.testsHtml || "Playwright HTML" }),
        el("a", { class: "btn btn-ghost", href: allureUrl, target: "_blank", rel: "noopener", text: data.testsAllure || "Allure" }),
        el("a", { class: "btn btn-ghost", href: NG_E2E_ACTIONS, target: "_blank", rel: "noopener", "data-testid": "tests-actions", text: data.testsCi || "GitHub Actions" }),
      ]),
      el("p", { class: "lede", text: data.testsSuite || (uk ? "Фільтр" : "Filter") }),
      el("div", { class: "hero-actions", role: "group" }, suiteBtns),
      el("p", { class: "sandbox-tests-cmd-row" }, [
        el("span", { class: "lede", text: (data.testsCmd || (uk ? "Локально" : "Local")) + ": " }),
        cmdEl,
      ]),
      el("div", { class: "hero-actions sandbox-switch", role: "group" }, [htmlBtn, allureBtn]),
      frame,
    ]);
  }

  function renderSandbox(data, guide) {
    if (window.__ngSandboxCtl) window.__ngSandboxCtl.abort();
    const ctl = new AbortController();
    window.__ngSandboxCtl = ctl;
    const main = document.getElementById("main");
    const hunter = el("div", { class: "hunter-list", "data-testid": "hunter-list" });
    const scoreNum = el("span", { class: "hunter-score-num" });
    const scoreEl = el("p", {
      class: "hunter-score",
      "data-testid": "hunter-score",
      "aria-live": "polite",
    }, [
      el("span", { class: "hunter-score-label", text: data.score }),
      scoreNum,
    ]);
    const fill = el("span", { class: "hunter-fill" });
    const hint = el("details", {
      class: "hunter-hint",
      "data-testid": "hunter-hint",
    }, [
      el("summary", {
        text: data.hintsToggle || (chrome.lang === "uk" ? "Підказка: які баги є" : "Hint: which bugs are planted"),
      }),
      hunter,
    ]);
    const resetBtn = el("button", {
      class: "hunter-reset",
      type: "button",
      "data-testid": "sandbox-reset",
      text: data.reset,
      onClick: () => {
        if (window.resetAccessDesk) window.resetAccessDesk();
        localStorage.removeItem(FOUND_KEY);
        location.reload();
      },
    });
    const meter = el("div", {
      class: "hunter-meter",
      "data-testid": "hunter-meter",
    }, [
      scoreEl,
      el("div", { class: "hunter-track", "aria-hidden": "true" }, [fill]),
      hint,
      resetBtn,
    ]);

    const paintHunter = () => {
      const found = new Set(readFound());
      const total = (data.bugs || []).length;
      scoreNum.textContent = found.size + " / " + total;
      fill.style.width = total ? (100 * found.size) / total + "%" : "0%";
      hunter.replaceChildren();
      (data.bugs || []).forEach((bug) => {
        const isFound = found.has(bug.id);
        hunter.append(
          el("article", {
            class: "hunter-card" + (isFound ? " is-found" : ""),
            "data-bug": bug.id,
            "data-testid": "hunter-bug",
          }, [
            bug.area ? el("p", { class: "hunter-area", text: bug.area }) : null,
            el("h3", { text: bug.title }),
            el("p", { text: bug.hint }),
            isFound
              ? el("p", { class: "hunter-found", text: data.found })
              : el("button", {
                  class: "btn btn-ghost",
                  type: "button",
                  text: data.mark,
                  onClick: () => {
                    const next = readFound();
                    if (!next.includes(bug.id)) next.push(bug.id);
                    writeFound(next);
                    paintHunter();
                  },
                }),
          ])
        );
      });
    };

    window.addEventListener(
      "sut-bug",
      (event) => {
        const id = event.detail;
        const next = readFound();
        if (id && !next.includes(id)) {
          next.push(id);
          writeFound(next);
          paintHunter();
        }
      },
      { signal: ctl.signal }
    );

    const mount = el("div", { id: "access-app", class: "access-app", "data-testid": "access-app" });
    const docsLabel = data.viewDocs || (chrome.lang === "uk" ? "Доку" : "Docs");
    const appLabel = data.viewApp || data.viewConsole || (chrome.lang === "uk" ? "Апка" : "App");
    const testsLabel = data.viewTests || (chrome.lang === "uk" ? "Автотести" : "Autotests");
    const docsBtn = el("button", {
      class: "btn btn-ghost",
      type: "button",
      "data-testid": "sandbox-docs-btn",
      "aria-pressed": "false",
      text: docsLabel,
    });
    const appBtn = el("button", {
      class: "btn btn-primary",
      type: "button",
      "data-testid": "sandbox-app-btn",
      "aria-pressed": "true",
      text: appLabel,
    });
    const testsBtn = el("button", {
      class: "btn btn-ghost",
      type: "button",
      "data-testid": "sandbox-tests-btn",
      "aria-pressed": "false",
      text: testsLabel,
    });
    const consolePanel = el("div", {
      class: "sandbox-layout",
      "data-testid": "sandbox-console",
    }, [mount]);
    const docsPanel = guide
      ? buildGuideLayout(guide)
      : el("p", { class: "lede", text: "Docs failed to load." });
    const testsPanel = buildTestsPanel(data);
    docsPanel.hidden = true;
    testsPanel.hidden = true;

    const setView = (next) => {
      if (next === "docs") {
        if (!isSandboxDocsHash(hashId(), guide)) location.hash = "docs";
        else applyView("docs");
        return;
      }
      if (next === "tests") {
        if (hashId() !== "tests") location.hash = "tests";
        else applyView("tests");
        return;
      }
      if (location.hash) history.pushState(null, "", location.pathname + location.search);
      applyView("console");
    };

    const paintSwitch = (view) => {
      const map = { docs: docsBtn, console: appBtn, tests: testsBtn };
      Object.keys(map).forEach((key) => {
        const on = key === view;
        map[key].classList.toggle("btn-primary", on);
        map[key].classList.toggle("btn-ghost", !on);
        map[key].setAttribute("aria-pressed", on ? "true" : "false");
      });
      consolePanel.hidden = view !== "console";
      docsPanel.hidden = view !== "docs";
      testsPanel.hidden = view !== "tests";
    };

    const applyView = (view) => {
      paintSwitch(view);
      if (view === "docs") {
        const id = hashId();
        const target = id && id !== "docs" ? document.getElementById(id) : docsPanel;
        if (target && target.scrollIntoView) target.scrollIntoView({ block: "start" });
      }
      if (view === "tests" && testsPanel.scrollIntoView) {
        testsPanel.scrollIntoView({ block: "start" });
      }
    };

    docsBtn.addEventListener("click", () => setView("docs"));
    appBtn.addEventListener("click", () => setView("console"));
    testsBtn.addEventListener("click", () => setView("tests"));
    window.addEventListener(
      "hashchange",
      () => applyView(sandboxPanelFromHash(hashId(), guide)),
      { signal: ctl.signal }
    );

    main.replaceChildren(
      el("header", { class: "hero" }, [
        el("p", { class: "badge", text: data.badge }),
        el("h1", { text: data.title }),
        el("p", { class: "pitch", text: data.intro }),
        el("p", { class: "lede", text: data.hint }),
        meter,
        el("div", {
          class: "hero-actions sandbox-switch",
          role: "group",
          "aria-label": docsLabel + " / " + appLabel + " / " + testsLabel,
        }, [
          docsBtn,
          appBtn,
          testsBtn,
        ]),
      ]),
      consolePanel,
      docsPanel,
      testsPanel
    );
    paintHunter();
    window.__ngDocs = "#docs";
    if (typeof window.bootAccessDesk === "function") window.bootAccessDesk(mount);
    applyView(sandboxPanelFromHash(hashId(), guide));
  }

  function renderLearn(data) {
    const items = data.items || [];
    let index = 0;
    let correct = 0;
    const main = document.getElementById("main");
    const stage = el("div", { class: "quiz-stage", "data-testid": "quiz-stage" });

    const paint = () => {
      stage.replaceChildren();
      if (index >= items.length) {
        stage.append(
          el("p", { class: "fit-score", "data-testid": "quiz-score" }, [
            el("span", { class: "fit-score-num", text: correct + " / " + items.length }),
            el("span", { text: data.score }),
          ]),
          el("button", {
            class: "btn btn-primary",
            type: "button",
            text: data.again,
            onClick: () => {
              index = 0;
              correct = 0;
              paint();
            },
          })
        );
        return;
      }
      const item = items[index];
      const why = el("p", { class: "quiz-why", hidden: true, "data-testid": "quiz-why" });
      const next = el("button", {
        class: "btn btn-primary",
        type: "button",
        hidden: true,
        text: index === items.length - 1 ? data.score : data.next,
        onClick: () => {
          if (!locked) return;
          index += 1;
          paint();
        },
      });
      const opts = el("div", { class: "quiz-options" });
      let locked = false;
      item.options.forEach((label, i) => {
        opts.append(
          el("button", {
            class: "quiz-option",
            type: "button",
            "data-testid": "quiz-option",
            text: label,
            onClick: (event) => {
              if (locked) return;
              locked = true;
              const ok = i === item.answer;
              if (ok) correct += 1;
              event.currentTarget.classList.add(ok ? "is-right" : "is-wrong");
              opts.children[item.answer].classList.add("is-right");
              why.hidden = false;
              why.textContent = (ok ? data.correct : data.wrong) + " " + item.why;
              next.hidden = false;
            },
          })
        );
      });
      stage.append(
        el("p", { class: "quiz-progress", text: index + 1 + " / " + items.length }),
        el("h2", { text: item.q }),
        opts,
        why,
        next
      );
    };

    main.replaceChildren(
      el("header", { class: "hero" }, [
        el("p", { class: "badge", text: data.badge }),
        el("h1", { text: data.title }),
        el("p", { class: "pitch", text: data.intro }),
        el("div", { class: "hero-actions" }, [
          el("a", { class: "btn btn-ghost", href: notesHref(), text: data.notesCta }),
          el("a", { class: "btn btn-ghost", href: qaHref(), text: data.qaCta }),
        ]),
      ]),
      stage
    );
    paint();
  }

  function renderFooter(text, site) {
    const foot = document.getElementById("site-footer");
    const passing = !site || site.ci === "passing";
    foot.replaceChildren(
      el("div", { class: "ci-footer", "data-testid": "ci-footer" }, [
        el("span", { class: "ci-ver", text: "v" + ((site && site.version) || "dev") }),
        el("span", { class: "ci-sep", text: "·" }),
        el("span", {
          class: "ci-branch",
          text: ((site && site.branch) || "main") + "@" + ((site && site.commit) || "local"),
        }),
        el("span", { class: "ci-sep", text: "·" }),
        el("span", {
          class: "ci-status" + (passing ? " is-pass" : ""),
          text: (site && site.ci) || "passing",
        }),
        el("span", { class: "ci-check", "aria-hidden": "true", text: passing ? "✓" : "×" }),
      ]),
      el("p", { class: "ci-copy", text: text })
    );
  }

  async function init() {
    const lang = detectLang();
    root.lang = lang === "uk" ? "uk" : "en";
    applyTheme(detectTheme());

    try {
      const loaders = [loadJson("content/site.json"), loadJson(contentFile(lang))];
      if (page === "sandbox") loaders.push(loadJson("content/sandbox-docs-" + lang + ".json"));
      const loaded = await Promise.all(loaders);
      const site = loaded[0];
      const data = loaded[1];
      const extra = loaded[2];
      const guide = page === "sandbox" ? extra : null;
      chrome = { data, site, lang, guide };

      document.title = data.metaTitle;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", data.metaDescription);

      renderHeader(data.nav, site, lang);
      bindGlobalKeys();
      if (page === "notes") renderNotes(data);
      else if (page === "qa") renderQa(data);
      else if (page === "sandbox") renderSandbox(data, guide);
      else if (page === "sandbox-docs") location.replace(base + "sandbox/#docs");
      else if (page === "learn") renderLearn(data);
      else {
        renderHome(data, site);
        scrollToHash();
        watchCvSections();
      }
      renderFooter(data.footer, site);
    } catch (error) {
      document.getElementById("main").replaceChildren(
        el("div", { class: "error" }, [
          el("h1", { text: "Could not load content" }),
          el("p", {
            text: "Open this site through a local server or GitHub Pages. Opening the HTML file directly blocks JSON.",
          }),
          el("pre", { text: String(error.message || error) }),
        ])
      );
    }
  }

  init();
})();
