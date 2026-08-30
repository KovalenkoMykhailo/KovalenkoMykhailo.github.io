(function () {
  const root = document.documentElement;
  const page = root.dataset.page;
  const base = root.dataset.base || "./";

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

  const paragraphs = (texts) =>
    (texts || []).map((text) => el("p", { text }));

  async function loadJson(path) {
    const res = await fetch(base + path);
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
    document.querySelectorAll("[data-theme-btn]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.themeBtn === theme));
    });
  }

  function setLang(lang) {
    localStorage.setItem("site-lang", lang);
    location.reload();
  }

  function contentFile(lang) {
    if (page === "notes") return `content/notes-${lang}.json`;
    if (page === "qa") return `content/qa-${lang}.json`;
    return `content/${lang}.json`;
  }

  function href(path) {
    return base + path;
  }

  const CV_SECTIONS = ["top", "experience", "skills", "contact"];

  function hashId() {
    return (location.hash || "").replace("#", "");
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
    event.preventDefault();
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", "#" + id);
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
    window.addEventListener("popstate", scrollToHash);
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function startTerminal(term, mount) {
    const body = mount.querySelector(".term-body");
    if (!body || !term) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cursor = () =>
      el("span", { class: "cursor", "aria-hidden": "true" });

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

  function renderHeader(nav, site, lang) {
    const pdfReady = hasContact(site.pdf);
    const theme = detectTheme();
    const themeLabel = lang === "uk" ? "Тема" : "Theme";
    const actions = el("div", { class: "header-actions" }, [
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
      el("div", { class: "lang", role: "group", "aria-label": themeLabel }, [
        el("button", {
          type: "button",
          text: lang === "uk" ? "Світла" : "Light",
          "data-theme-btn": "light",
          "aria-pressed": theme === "light",
          onClick: () => setTheme("light"),
        }),
        el("button", {
          type: "button",
          text: lang === "uk" ? "Темна" : "Dark",
          "data-theme-btn": "dark",
          "aria-pressed": theme === "dark",
          onClick: () => setTheme("dark"),
        }),
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
    ]);

    const header = document.getElementById("site-header");
    header.replaceChildren(
      el("div", { class: "header-inner" }, [
        el("a", { class: "brand", href: href("index.html"), text: "MK" }),
        el("nav", { class: "nav", "aria-label": "Main" }, [
          el("div", { class: "nav-group", "aria-label": nav.onPage || "On this page" }, [
            el("a", {
              href: href("index.html") + "#top",
              text: nav.home,
              "data-cv-section": "top",
              "aria-current": page === "home" && !hashId() ? "page" : null,
              onClick: (event) => goToCvSection("top", event),
            }),
            el("a", {
              href: href("index.html") + "#experience",
              text: nav.experience,
              "data-cv-section": "experience",
              onClick: (event) => goToCvSection("experience", event),
            }),
            el("a", {
              href: href("index.html") + "#skills",
              text: nav.skills,
              "data-cv-section": "skills",
              onClick: (event) => goToCvSection("skills", event),
            }),
            el("a", {
              href: href("index.html") + "#contact",
              text: nav.contacts,
              "data-cv-section": "contact",
              onClick: (event) => goToCvSection("contact", event),
            }),
          ]),
          el("span", { class: "nav-split", "aria-hidden": "true" }),
          el("div", { class: "nav-group nav-pages", "aria-label": nav.pages || "Pages" }, [
            el("span", { class: "nav-pages-label", text: nav.pages || "Pages" }),
            el("a", {
              href: href("notes/index.html"),
              text: nav.notes,
              "aria-current": page === "notes" ? "page" : null,
            }),
            el("a", {
              href: href("qa/index.html"),
              text: nav.qa,
              "aria-current": page === "qa" ? "page" : null,
            }),
          ]),
        ]),
        actions,
      ])
    );
  }

  function renderHome(data, site) {
    const c = data.contact;
    const links = [
      ["email", c.email, site.email],
      ["linkedin", c.linkedin, site.linkedin],
      ["telegram", c.telegram, site.telegram],
      ["github", c.github, site.github],
    ].filter(([, , value]) => hasContact(value));

    const term = renderTerminal(data.terminal);
    const main = document.getElementById("main");
    main.replaceChildren(
      el("section", { class: "hero", id: "top" }, [
        el("div", { class: "hero-copy" }, [
          el("h1", { text: data.hero.name }),
          el("p", { class: "role", text: data.hero.role }),
          el("p", { class: "location", text: data.hero.location }),
          el("p", { class: "pitch", text: data.hero.pitch }),
          el("div", { class: "hero-actions" }, [
            hasContact(site.pdf)
              ? el("a", {
                  class: "btn btn-primary",
                  href: href(site.pdf),
                  download: "",
                  text: data.nav.download,
                })
              : hasContact(site.email)
                ? el("a", {
                    class: "btn btn-primary",
                    href: "mailto:" + site.email,
                    text: c.email,
                  })
                : null,
            el("a", {
              class: "btn btn-ghost",
              href: href("notes/index.html"),
              text: data.now.notesLink,
            }),
            el("a", {
              class: "btn btn-ghost",
              href: href("qa/index.html"),
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
      el("section", { id: "now" }, [
        el("h2", { text: data.now.title }),
        el("div", { class: "now-card" }, [
          el("p", { text: data.now.body }),
          el("div", { class: "now-links" }, [
            el("a", {
              class: "btn btn-primary",
              href: href("notes/index.html"),
              text: data.now.notesLink,
            }),
            el("a", {
              class: "btn btn-ghost",
              href: href("qa/index.html"),
              text: data.now.qaLink,
            }),
          ]),
        ]),
      ]),
      el("section", { id: "experience" }, [
        el("h2", { text: data.experience.title }),
        ...data.experience.jobs.map((job) =>
          el("article", { class: "job" }, [
            el("div", { class: "job-head" }, [
              el("h3", { text: job.company + " · " + job.role }),
              job.period ? el("span", { class: "period", text: job.period }) : null,
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
              group.items.map((item) => el("li", { text: item }))
            ),
          ])
        ),
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
        el("h2", { text: data.projects.title }),
        el("p", { class: "lede", text: data.projects.intro }),
        ...data.projects.items.map((item) =>
          el("article", { class: "project" }, [
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
            el("p", { text: item.text }),
          ])
        ),
      ]),
      el("section", { id: "contact" }, [
        el("h2", { text: c.title }),
        links.length
          ? el(
              "div",
              { class: "contacts" },
              links.map(([type, label, value]) =>
                el("a", {
                  href: contactHref(type, value),
                  text: type === "email" ? value : label,
                  rel: type === "email" ? null : "noreferrer",
                  target: type === "email" ? null : "_blank",
                })
              )
            )
          : el("p", { class: "empty-contacts", text: c.empty }),
      ])
    );
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
              href: href("qa/index.html"),
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

    const paint = (query) => {
      const q = (query || "").trim().toLowerCase();
      list.replaceChildren();
      let shown = 0;
      data.groups.forEach((group) => {
        const items = group.items.filter((item) => {
          if (!q) return true;
          return (item.q + " " + item.a).toLowerCase().includes(q);
        });
        if (!items.length) return;
        shown += items.length;
        list.append(
          el("section", { class: "qa-group", id: group.id }, [
            el("h2", { text: group.title }),
            ...items.map((item) =>
              el("details", {}, [
                el("summary", { text: item.q }),
                el("p", { text: item.a }),
              ])
            ),
          ])
        );
      });
      if (!shown) {
        list.append(el("p", { class: "lede", text: data.emptyFilter }));
      }
    };

    main.replaceChildren(
      el("header", { class: "hero" }, [
        el("p", { class: "badge", text: data.badge }),
        el("h1", { text: data.title }),
        el("p", { class: "pitch", text: data.intro }),
        el("div", { class: "hero-actions" }, [
          el("a", {
            class: "btn btn-ghost",
            href: href("notes/index.html"),
            text: data.notesCta,
          }),
        ]),
      ]),
      el("input", {
        class: "filter",
        type: "search",
        placeholder: data.searchPlaceholder,
        "aria-label": data.searchPlaceholder,
        onInput: (event) => paint(event.target.value),
      }),
      list
    );
    paint("");
  }

  function renderFooter(text) {
    document.getElementById("site-footer").textContent = text;
  }

  async function init() {
    const lang = detectLang();
    root.lang = lang === "uk" ? "uk" : "en";
    applyTheme(detectTheme());

    try {
      const [site, data] = await Promise.all([
        loadJson("content/site.json"),
        loadJson(contentFile(lang)),
      ]);

      document.title = data.metaTitle;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", data.metaDescription);

      renderHeader(data.nav, site, lang);
      if (page === "notes") renderNotes(data);
      else if (page === "qa") renderQa(data);
      else {
        renderHome(data, site);
        scrollToHash();
        watchCvSections();
      }
      renderFooter(data.footer);
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
