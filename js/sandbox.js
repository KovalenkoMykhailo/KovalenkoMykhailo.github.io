(function () {
  const DEMO_EMAIL = "ada.chen@northgate.test";
  const DEMO_PASS = "Access123!";
  const TOKEN = "ng-demo-token";
  const K_TOKEN = "mk-ng-token";
  const K_ACCOUNTS = "mk-ng-accounts";
  const K_TRANSFERS = "mk-ng-transfers";
  const K_MEMBERS = "mk-ng-members";
  const K_OPEN = "mk-ng-open";

  const K_AUDIT = "mk-ng-audit";
  const PAGE_SIZE = 5;
  const CURRENCIES = ["EUR", "USD", "GBP"];
  const ACCOUNT_TYPES = ["Current", "Operating", "Payroll", "Escrow"];
  const ACCOUNT_STATUSES = ["Active", "Frozen", "Closed"];
  const MEMBER_ROLES = ["Viewer", "Member", "Admin", "Contractor"];
  const TABS = [
    ["accounts", "Accounts"],
    ["transfers", "Transfers"],
    ["access", "Access"],
    ["audit", "Audit"],
    ["api", "API"],
  ];
  let deskGen = 0;

  const SEED_MEMBERS = [
    { id: "u1", name: "Ada Chen", email: "ada.chen@northgate.test", role: "Admin", status: "Active" },
    { id: "u2", name: "Bohdan Koval", email: "bohdan.koval@northgate.test", role: "Member", status: "Active" },
    { id: "u3", name: "Clara West", email: "clara.west@northgate.test", role: "Contractor", status: "Invited" },
    { id: "u4", name: "Demo Viewer", email: "viewer@northgate.test", role: "Viewer", status: "Disabled" },
  ];

  const SEED_ACCOUNTS = [
    { id: "acc-1", holder: "Northgate Ops", iban: "NG00 1000 0000 0001", currency: "EUR", balance: 125000.5, status: "Active", type: "Operating" },
    { id: "acc-2", holder: "Northgate Ops", iban: "NG00 1000 0000 0002", currency: "USD", balance: 8800, status: "Active", type: "Operating" },
    { id: "acc-3", holder: "Ada Chen", iban: "NG00 1000 0000 0003", currency: "EUR", balance: 4200.5, status: "Active", type: "Current" },
    { id: "acc-4", holder: "Bohdan Koval", iban: "NG00 1000 0000 0004", currency: "EUR", balance: 150, status: "Frozen", type: "Current" },
    { id: "acc-5", holder: "Clara West", iban: "NG00 1000 0000 0005", currency: "GBP", balance: 0, status: "Active", type: "Current" },
    { id: "acc-6", holder: "Vendor Holdings", iban: "NG00 1000 0000 0006", currency: "EUR", balance: 0, status: "Closed", type: "Escrow" },
    { id: "acc-7", holder: "Demo Viewer", iban: "NG00 1000 0000 0007", currency: "USD", balance: 99.99, status: "Active", type: "Current" },
    { id: "acc-8", holder: "Baltic Payroll", iban: "NG00 1000 0000 0008", currency: "EUR", balance: 50200, status: "Active", type: "Payroll" },
  ];

  const SEED_TRANSFERS = [
    { id: "tx-1", ref: "NG-TX-1001", from: "acc-1", to: "acc-8", amount: 2500, currency: "EUR", status: "Settled", createdAt: "2026-08-28" },
    { id: "tx-2", ref: "NG-TX-1002", from: "acc-1", to: "acc-3", amount: 120, currency: "EUR", status: "Pending", createdAt: "2026-08-30" },
    { id: "tx-3", ref: "NG-TX-1003", from: "acc-2", to: "acc-7", amount: 40, currency: "USD", status: "Failed", createdAt: "2026-08-29" },
    { id: "tx-4", ref: "NG-TX-1004", from: "acc-8", to: "acc-4", amount: 15, currency: "EUR", status: "Settled", createdAt: "2026-08-20" },
    { id: "tx-5", ref: "NG-TX-1005", from: "acc-1", to: "acc-5", amount: 300, currency: "EUR", status: "Pending", createdAt: "2026-08-31" },
  ];

  const SEED_AUDIT = [
    { id: "au-1", at: "2026-08-28T09:12:11Z", actor: "ada.chen@northgate.test", action: "LOGIN", target: "console", result: "OK" },
    { id: "au-2", at: "2026-08-29T14:03:40Z", actor: "system", action: "FREEZE", target: "acc-4", result: "OK" },
    { id: "au-3", at: "2026-08-30T11:20:05Z", actor: "ada.chen@northgate.test", action: "TRANSFER", target: "NG-TX-1002", result: "PENDING" },
    { id: "au-4", at: "2026-08-31T08:44:19Z", actor: "ada.chen@northgate.test", action: "INVITE", target: "clara.west@northgate.test", result: "OK" },
  ];

  const note = (id) => window.dispatchEvent(new CustomEvent("sut-bug", { detail: id }));

  const load = (key, seed) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    return seed.map((row) => Object.assign({}, row));
  };

  const save = (key, rows) => localStorage.setItem(key, JSON.stringify(rows));

  const cloneSeed = (rows) => rows.map((row) => Object.assign({}, row));

  window.resetAccessDesk = () => {
    [K_TOKEN, K_ACCOUNTS, K_TRANSFERS, K_MEMBERS, K_OPEN, K_AUDIT, "mk-access-session", "mk-access-members"].forEach((key) => {
      localStorage.removeItem(key);
    });
  };

  const apiLog = [];
  let logListeners = [];

  function pushLog(entry) {
    apiLog.unshift(entry);
    if (apiLog.length > 12) apiLog.pop();
    logListeners.forEach((fn) => fn());
  }

  function jsonRes(status, body) {
    return { status: status, body: body };
  }

  function readBody(init) {
    if (!init || init.body == null) return {};
    try {
      return typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    } catch {
      return {};
    }
  }

  function headerAuth(init) {
    const headers = (init && init.headers) || {};
    if (typeof headers.get === "function") return headers.get("Authorization") || headers.get("authorization") || "";
    return headers.Authorization || headers.authorization || "";
  }

  function requireAuth(init) {
    const token = localStorage.getItem(K_TOKEN);
    const auth = headerAuth(init);
    return Boolean(token && auth === "Bearer " + token);
  }

  function accounts() {
    return load(K_ACCOUNTS, SEED_ACCOUNTS);
  }

  function transfers() {
    return load(K_TRANSFERS, SEED_TRANSFERS);
  }

  function members() {
    return load(K_MEMBERS, SEED_MEMBERS);
  }

  function auditRows() {
    return load(K_AUDIT, SEED_AUDIT);
  }

  function writeAudit(action, target, result) {
    const rows = auditRows();
    rows.unshift({
      id: "au-" + Date.now(),
      at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      actor: DEMO_EMAIL,
      action: action,
      target: target,
      result: result,
    });
    save(K_AUDIT, rows.slice(0, 40));
  }

  function ibanKey(iban) {
    return String(iban || "").replace(/\s+/g, "").toUpperCase();
  }

  function normalizeAccountInput(body) {
    const holder = String((body && body.holder) || "").trim();
    const iban = String((body && body.iban) || "").trim();
    const currency = (body && body.currency) || "EUR";
    const type = (body && body.type) || "Current";
    const status = (body && body.status) || "Active";
    const balance = Number(body && body.balance);
    if (!holder || !iban) return { error: jsonRes(400, { error: "Holder and IBAN are required." }) };
    if (CURRENCIES.indexOf(currency) < 0) return { error: jsonRes(400, { error: "Invalid currency" }) };
    if (ACCOUNT_STATUSES.indexOf(status) < 0) return { error: jsonRes(400, { error: "Invalid status" }) };
    if (ACCOUNT_TYPES.indexOf(type) < 0) return { error: jsonRes(400, { error: "Invalid type" }) };
    return {
      holder: holder,
      iban: iban,
      type: type,
      currency: currency,
      status: status,
      balance: Number.isFinite(balance) && balance >= 0 ? Math.round(balance * 100) / 100 : 0,
    };
  }

  function handleApi(url, init) {
    const method = ((init && init.method) || "GET").toUpperCase();
    const path = url.pathname.replace(/\/+$/, "");
    const parts = path.split("/api/v1/")[1] || "";
    const segs = parts.split("/").filter(Boolean);
    const q = url.searchParams;
    const body = readBody(init);

    if (method === "POST" && segs[0] === "auth" && segs[1] === "login") {
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      if (email === DEMO_EMAIL && password === DEMO_PASS) {
        localStorage.setItem(K_TOKEN, TOKEN);
        writeAudit("LOGIN", "console", "OK");
        return jsonRes(200, { token: TOKEN, user: { email: DEMO_EMAIL, name: "Ada Chen", role: "Admin" } });
      }
      note("auth-code");
      return jsonRes(403, { error: "Forbidden", message: "You cannot access this resource." });
    }

    if (method === "POST" && segs[0] === "auth" && segs[1] === "logout") {
      note("logout-session");
      return jsonRes(204, {});
    }

    if (!requireAuth(init) && !(segs[0] === "auth" && segs[1] === "login")) {
      return jsonRes(401, { error: "Unauthorized" });
    }

    if (method === "GET" && segs[0] === "me") {
      return jsonRes(200, { email: DEMO_EMAIL, name: "Ada Chen", role: "Admin" });
    }

    if (method === "GET" && segs[0] === "stats") {
      const rows = accounts();
      if (!localStorage.getItem(K_OPEN)) localStorage.setItem(K_OPEN, String(rows.length));
      const open = Number(localStorage.getItem(K_OPEN));
      return jsonRes(200, {
        open: open,
        frozen: rows.filter((row) => row.status === "Frozen").length,
        closed: rows.filter((row) => row.status === "Closed").length,
        pending: transfers().filter((row) => row.status === "Pending").length,
      });
    }

    if (method === "GET" && segs[0] === "accounts" && !segs[1]) {
      let rows = accounts();
      const search = q.get("q") || "";
      const status = q.get("status") || "";
      const currency = q.get("currency") || "";
      const min = q.get("minBalance");
      const max = q.get("maxBalance");
      const sort = q.get("sort") || "";
      const dir = q.get("dir") === "desc" ? -1 : 1;

      if (search) {
        const hit = rows.filter((row) => row.holder.includes(search) || row.iban.includes(search));
        const loose = rows.filter(
          (row) =>
            row.holder.toLowerCase().includes(search.toLowerCase()) ||
            row.iban.toLowerCase().includes(search.toLowerCase())
        );
        if (search !== search.toUpperCase() && hit.length === 0 && loose.length) note("search-case");
        rows = hit;
      }

      if (status && status !== "All") {
        if (status === "Active") {
          const mixed = rows.filter((row) => row.status === "Active" || row.status === "Frozen");
          if (mixed.some((row) => row.status === "Frozen")) note("filter-status");
          rows = mixed;
        } else {
          rows = rows.filter((row) => row.status === status);
        }
      }

      if (currency && currency !== "All") {
        if (rows.some((row) => row.currency !== currency)) note("filter-currency");
      }

      if (min != null && min !== "") {
        rows = rows.filter((row) => row.balance >= Number(min));
      }
      if (max != null && max !== "") {
        const cap = Number(max);
        const exact = accounts().some((row) => row.balance === cap);
        rows = rows.filter((row) => row.balance < cap);
        if (exact) note("balance-max");
      }

      if (sort === "holder") {
        rows = rows.slice().sort((a, b) => a.iban.localeCompare(b.iban) * dir);
        note("sort-wrong");
      }

      const page = Math.max(1, Number(q.get("page") || 1));
      const pageSize = Math.max(1, Math.min(100, Number(q.get("pageSize") || 20)));
      const total = rows.length;
      const items = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
      return jsonRes(200, { items: items, total: total, page: page, pageSize: pageSize });
    }

    if (method === "POST" && segs[0] === "accounts" && !segs[1]) {
      const parsed = normalizeAccountInput(body);
      if (parsed.error) return parsed.error;
      const list = accounts();
      if (list.some((row) => ibanKey(row.iban) === ibanKey(parsed.iban))) {
        return jsonRes(409, { error: "DUPLICATE_IBAN" });
      }
      const row = Object.assign({ id: "acc-" + Date.now() }, parsed);
      list.unshift(row);
      save(K_ACCOUNTS, list);
      writeAudit("CREATE", row.id, "OK");
      return jsonRes(201, row);
    }

    if (method === "GET" && segs[0] === "accounts" && segs[1]) {
      const row = accounts().find((item) => item.id === segs[1]);
      if (!row) return jsonRes(404, { error: "Not found" });
      return jsonRes(200, row);
    }

    if (method === "PUT" && segs[0] === "accounts" && segs[1]) {
      const list = accounts();
      const idx = list.findIndex((item) => item.id === segs[1]);
      if (idx < 0) return jsonRes(404, { error: "Not found" });
      const parsed = normalizeAccountInput(body);
      if (parsed.error) return parsed.error;
      if (list.some((row) => row.id !== segs[1] && ibanKey(row.iban) === ibanKey(parsed.iban))) {
        return jsonRes(409, { error: "DUPLICATE_IBAN" });
      }
      const row = Object.assign({}, list[idx], parsed, { id: segs[1] });
      list[idx] = row;
      save(K_ACCOUNTS, list);
      writeAudit("UPDATE", row.id, "OK");
      return jsonRes(200, row);
    }

    if (method === "PATCH" && segs[0] === "accounts" && segs[1]) {
      const rows = accounts();
      const row = rows.find((item) => item.id === segs[1]);
      if (!row) return jsonRes(404, { error: "Not found" });
      const nextStatus = body.status || row.status;
      note("freeze-lie");
      writeAudit(nextStatus === "Frozen" ? "FREEZE" : "UNFREEZE", segs[1], "ACCEPTED");
      return jsonRes(200, Object.assign({}, row, { status: nextStatus }));
    }

    if (method === "DELETE" && segs[0] === "accounts" && segs[1]) {
      const list = accounts();
      const idx = list.findIndex((item) => item.id === segs[1]);
      if (idx < 0) return jsonRes(404, { error: "Not found" });
      const pending = transfers().some(
        (tx) => tx.status === "Pending" && (tx.from === segs[1] || tx.to === segs[1])
      );
      if (pending) return jsonRes(409, { error: "ACCOUNT_HAS_PENDING_TRANSFERS" });
      const removed = list[idx];
      list.splice(idx, 1);
      save(K_ACCOUNTS, list);
      writeAudit("DELETE", removed.id, "OK");
      return jsonRes(204, {});
    }

    if (method === "GET" && segs[0] === "transfers") {
      let rows = transfers();
      const status = q.get("status") || "";
      const min = q.get("minAmount");
      const max = q.get("maxAmount");
      if (status && status !== "All") rows = rows.filter((row) => row.status === status);
      if (min != null && min !== "") rows = rows.filter((row) => row.amount >= Number(min));
      if (max != null && max !== "") rows = rows.filter((row) => row.amount <= Number(max));
      return jsonRes(200, { items: rows, total: rows.length });
    }

    if (method === "POST" && segs[0] === "transfers") {
      const list = transfers();
      const accs = accounts();
      const from = accs.find((row) => row.id === body.from);
      const to = accs.find((row) => row.id === body.to);
      const amount = Number(body.amount);
      if (!from || !to || !(amount > 0)) return jsonRes(400, { error: "Invalid transfer" });
      if (from.currency !== to.currency) return jsonRes(409, { error: "CURRENCY_MISMATCH" });
      if (amount > from.balance) {
        note("transfer-code");
        writeAudit("TRANSFER", from.id + "→" + to.id, "INSUFFICIENT_FUNDS");
        return jsonRes(200, { ok: false, error: "INSUFFICIENT_FUNDS" });
      }
      from.balance = Math.round((from.balance - amount) * 100) / 100;
      to.balance = Math.round((to.balance + amount) * 100) / 100;
      save(K_ACCOUNTS, accs);
      const tx = {
        id: "tx-" + Date.now(),
        ref: "NG-TX-" + String(Date.now()).slice(-6),
        from: from.id,
        to: to.id,
        amount: amount,
        currency: from.currency,
        status: "Pending",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      list.unshift(tx);
      save(K_TRANSFERS, list);
      writeAudit("TRANSFER", tx.ref, "PENDING");
      return jsonRes(201, tx);
    }

    if (method === "GET" && segs[0] === "members") {
      return jsonRes(200, { items: members(), total: members().length });
    }

    if (method === "POST" && segs[0] === "members") {
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim();
      const role = body.role || "Viewer";
      if (!name || !email.includes("@")) return jsonRes(400, { error: "Name and email are required." });
      const savedRole = role === "Admin" ? "Viewer" : role;
      if (role === "Admin") note("role-swap");
      return jsonRes(201, addMember(name, email, savedRole));
    }

    if (method === "GET" && segs[0] === "audit") {
      return jsonRes(200, { items: auditRows() });
    }

    return jsonRes(404, { error: "No route", path: path, method: method });
  }

  function addMember(name, email, role) {
    const list = members();
    const row = { id: "u" + Date.now(), name: name, email: email, role: role, status: "Invited" };
    list.push(row);
    save(K_MEMBERS, list);
    writeAudit("INVITE", email, "OK");
    return row;
  }

  function fulfillApi(url, init) {
    const result = handleApi(url, init || {});
    pushLog({
      method: ((init && init.method) || "GET").toUpperCase(),
      path: url.pathname + url.search,
      status: result.status,
      body: result.body,
    });
    return result;
  }

  function toResponse(result) {
    if (result.status === 204) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function wrapFetch() {
    if (window.__ngFetchWrap) return;
    window.__ngFetchWrap = true;
    const orig = window.fetch.bind(window);
    window.fetch = async function (input, init) {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      if (!url.pathname.includes("/api/v1/")) return orig(input, init);
      return toResponse(fulfillApi(url, init || {}));
    };
  }

  function bindSwBridge() {
    if (window.__ngSwBridge || !("serviceWorker" in navigator)) return;
    window.__ngSwBridge = true;
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data;
      if (!data || data.type !== "ng-api" || !event.ports || !event.ports[0]) return;
      const url = new URL(data.url, location.href);
      const result = fulfillApi(url, {
        method: data.method,
        headers: data.headers || {},
        body: data.body,
      });
      event.ports[0].postMessage({ status: result.status, body: result.body });
    });
  }

  async function registerApiWorker() {
    if (!("serviceWorker" in navigator)) return false;
    try {
      await navigator.serviceWorker.register("sw.js", { scope: "./" });
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          const done = () => resolve();
          navigator.serviceWorker.addEventListener("controllerchange", done, { once: true });
          setTimeout(done, 2000);
        });
      }
      return Boolean(navigator.serviceWorker.controller);
    } catch {
      return false;
    }
  }

  function installApi() {
    if (!window.__ngApiReady) {
      bindSwBridge();
      window.__ngApiReady = registerApiWorker()
        .then((viaSw) => {
          if (!viaSw) wrapFetch();
        })
        .catch(() => wrapFetch());
    }
    return window.__ngApiReady;
  }

  async function api(path, opts) {
    const headers = Object.assign({ "Content-Type": "application/json" }, (opts && opts.headers) || {});
    const token = localStorage.getItem(K_TOKEN);
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch("api/v1/" + path, Object.assign({}, opts, { headers: headers }));
    const text = await res.text();
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }
    }
    return { status: res.status, body: body };
  }

  window.bootAccessDesk = function (root) {
    if (!root) return;
    const gen = ++deskGen;
    const apiReady = installApi();
    let tab = "accounts";
    let accFilters = { q: "", status: "All", currency: "All", minBalance: "", maxBalance: "" };
    let txFilters = { status: "All", minAmount: "", maxAmount: "" };
    let accPage = 1;
    let selectedAccount = "";
    let modalClose = null;

    const alive = () => gen === deskGen;

    const paint = async () => {
      if (!alive()) return;
      if (modalClose) {
        modalClose();
        modalClose = null;
      }
      root.replaceChildren();
      if (!localStorage.getItem(K_TOKEN)) {
        paintLogin();
        return;
      }
      await paintApp();
    };

    function paintLogin() {
      const err = document.createElement("p");
      err.className = "sut-error";
      err.hidden = true;
      err.dataset.testid = "login-error";
      err.setAttribute("role", "alert");
      const email = document.createElement("input");
      email.type = "email";
      email.dataset.testid = "login-email";
      email.autocomplete = "username";
      email.value = DEMO_EMAIL;
      const password = document.createElement("input");
      password.type = "password";
      password.dataset.testid = "login-password";
      password.autocomplete = "current-password";
      const submit = btn("submit", "login-submit", "btn btn-primary", "Sign in");
      const form = document.createElement("form");
      form.className = "sut-card";
      form.dataset.testid = "login-form";
      bindBusy(form, submit, async () => {
        const res = await api("auth/login", {
          method: "POST",
          body: JSON.stringify({ email: email.value.trim(), password: password.value }),
        });
        if (res.status === 200 && res.body.token) {
          paint();
          return;
        }
        err.hidden = false;
        err.textContent = (res.status || 403) + " " + ((res.body && res.body.message) || "Forbidden");
      });
      const h = document.createElement("h3");
      h.textContent = "Northgate Console";
      const env = document.createElement("span");
      env.className = "sut-env";
      env.textContent = "TEST";
      const p = document.createElement("p");
      p.className = "sut-muted";
      p.textContent = "B2B admin · Demo: " + DEMO_EMAIL + " / " + DEMO_PASS;
      form.append(h, env, p, labelWrap("Email", email), labelWrap("Password", password), err, submit);
      root.append(form);
    }

    async function paintApp() {
      const shell = document.createElement("div");
      shell.className = "sut-shell";
      shell.dataset.testid = "console-shell";
      const bar = document.createElement("div");
      bar.className = "sut-bar";
      const brand = document.createElement("strong");
      brand.textContent = "Northgate Console";
      const env = document.createElement("span");
      env.className = "sut-env";
      env.dataset.testid = "env-badge";
      env.textContent = "TEST";
      const who = document.createElement("span");
      who.className = "sut-muted";
      who.dataset.testid = "session-user";
      who.textContent = "Ada Chen · Admin";
      const out = btn("button", "logout", "btn btn-ghost", "Log out");
      out.addEventListener("click", async () => {
        await api("auth/logout", { method: "POST" });
        root.replaceChildren();
        const bye = document.createElement("p");
        bye.className = "sut-muted";
        bye.textContent = "Signed out.";
        const again = btn("button", "back-login", "btn btn-primary", "Back to login");
        again.addEventListener("click", paint);
        root.append(bye, again);
      });
      bar.append(brand, env, who, out);

      const nav = document.createElement("div");
      nav.className = "sut-tabs";
      nav.setAttribute("role", "tablist");
      nav.setAttribute("aria-label", "Northgate Console");
      TABS.forEach(([id, label]) => {
        const tabBtn = btn("button", "tab-" + id, "sut-tab" + (tab === id ? " is-on" : ""), label);
        tabBtn.setAttribute("role", "tab");
        tabBtn.setAttribute("aria-selected", String(tab === id));
        tabBtn.addEventListener("click", () => {
          tab = id;
          paint();
        });
        nav.append(tabBtn);
      });

      const body = document.createElement("div");
      body.className = "sut-body";
      body.dataset.testid = "console-body";
      logListeners = [];
      shell.append(bar, nav, body);
      root.append(shell);

      if (tab === "accounts") await paintAccounts(body);
      else if (tab === "transfers") await paintTransfers(body);
      else if (tab === "access") await paintAccess(body);
      else if (tab === "audit") await paintAudit(body);
      else paintApi(body);
    }

    async function paintAccounts(body) {
      const stats = await api("stats");
      const kpi = document.createElement("div");
      kpi.className = "sut-kpis";
      [
        ["Open accounts", stats.body.open, "kpi-open"],
        ["Frozen", stats.body.frozen, "kpi-frozen"],
        ["Pending transfers", stats.body.pending, "kpi-pending"],
      ].forEach(([label, value, testid]) => {
        const card = document.createElement("article");
        card.className = "sut-kpi";
        card.dataset.testid = testid;
        const k = document.createElement("p");
        k.className = "sut-kpi-label";
        k.textContent = label;
        const v = document.createElement("p");
        v.className = "sut-kpi-value";
        v.textContent = String(value == null ? "—" : value);
        card.append(k, v);
        kpi.append(card);
      });

      const qs = toQuery({
        q: accFilters.q,
        status: accFilters.status,
        currency: accFilters.currency,
        minBalance: accFilters.minBalance,
        maxBalance: accFilters.maxBalance,
        page: accPage,
        pageSize: PAGE_SIZE,
      });
      const res = await api("accounts?" + qs);
      const items = (res.body && res.body.items) || [];

      const create = document.createElement("form");
      create.className = "sut-filters";
      create.dataset.testid = "account-create";
      const fields = accountFields(
        {
          holder: "account-holder",
          iban: "account-iban",
          type: "account-type",
          ccy: "account-ccy",
          balance: "account-balance-in",
          status: "account-new-status",
        },
        { type: "Current", currency: "EUR", balance: 0, status: "Active" }
      );
      const createErr = document.createElement("p");
      createErr.className = "sut-error";
      createErr.hidden = true;
      createErr.dataset.testid = "account-create-error";
      const createSubmit = btn("submit", "account-create-submit", "btn btn-primary", "Add account");
      bindBusy(create, createSubmit, async () => {
        createErr.hidden = true;
        const created = await api("accounts", {
          method: "POST",
          body: JSON.stringify(fields.body()),
        });
        if (created.status >= 400) {
          failBox(createErr, created, "Create failed");
          toast((created.body && created.body.error) || "Create failed", "err");
          return;
        }
        fields.holder.value = "";
        fields.iban.value = "";
        fields.bal.value = "0";
        accPage = 1;
        toast("Account " + created.body.id + " created", "ok");
        paint();
      });
      create.append(
        filterRow(
          labeled("Client", fields.holder, "sut-filter-grow"),
          labeled("IBAN", fields.iban, "sut-filter-grow"),
          labeled("Type", fields.type),
          labeled("CCY", fields.ccy)
        ),
        filterRow(
          labeled("Balance", fields.bal),
          labeled("Status", fields.status),
          actions(createSubmit)
        ),
        createErr
      );

      const filters = document.createElement("form");
      filters.className = "sut-filters";
      filters.dataset.testid = "account-filters";
      const search = input("search", "account-search", "Search holder or IBAN");
      search.value = accFilters.q;
      const status = select("account-status", ["All"].concat(ACCOUNT_STATUSES), accFilters.status);
      const currency = select("account-currency", ["All"].concat(CURRENCIES), accFilters.currency);
      const min = input("number", "account-min", "Min balance");
      min.value = accFilters.minBalance;
      min.step = "0.01";
      const max = input("number", "account-max", "Max balance");
      max.value = accFilters.maxBalance;
      max.step = "0.01";
      const apply = btn("submit", "account-apply", "btn btn-primary", "Apply filters");
      const clear = btn("button", "account-clear", "btn btn-ghost", "Clear");
      filters.addEventListener("submit", (event) => {
        event.preventDefault();
        accPage = 1;
        accFilters = {
          q: search.value,
          status: status.value,
          currency: currency.value,
          minBalance: min.value,
          maxBalance: max.value,
        };
        paint();
      });
      clear.addEventListener("click", () => {
        accPage = 1;
        accFilters = { q: "", status: "All", currency: "All", minBalance: "", maxBalance: "" };
        paint();
      });
      filters.append(
        filterRow(
          labeled("Search", search, "sut-filter-grow"),
          actions(apply, clear)
        ),
        filterRow(
          labeled("Status", status),
          labeled("Currency", currency),
          labeled("Min balance", min),
          labeled("Max balance", max)
        )
      );

      const table = document.createElement("table");
      table.className = "sut-table";
      table.dataset.testid = "account-table";
      table.append(
        tableHead([
          {
            text: "Client",
            testid: "sort-holder",
            onClick: async () => {
              const sorted = await api("accounts?" + qs + "&sort=holder");
              renderAccountRows(table, (sorted.body && sorted.body.items) || []);
            },
          },
          "IBAN",
          "Type",
          "CCY",
          "Balance",
          "Status",
          "Actions",
        ]),
        document.createElement("tbody")
      );
      renderAccountRows(table, items);

      const total = Number(res.body.total || items.length);
      const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      const meta = document.createElement("div");
      meta.className = "sut-meta";
      const count = document.createElement("p");
      count.className = "sut-muted";
      count.dataset.testid = "account-total";
      count.textContent = total + " accounts · page " + accPage + " of " + pages + " · GET " + res.status;
      const exportBtn = btn("button", "account-export", "btn btn-ghost", "Export CSV");
      exportBtn.addEventListener("click", async () => {
        const all = await api(
          "accounts?" +
            toQuery({
              q: accFilters.q,
              status: accFilters.status,
              currency: accFilters.currency,
              minBalance: accFilters.minBalance,
              maxBalance: accFilters.maxBalance,
              page: 1,
              pageSize: 100,
            })
        );
        downloadCsv((all.body && all.body.items) || items);
        toast("CSV exported", "ok");
      });
      meta.append(count, exportBtn);

      const pager = document.createElement("div");
      pager.className = "sut-pager";
      pager.dataset.testid = "account-pager";
      const prev = btn("button", "account-prev", "btn btn-ghost", "Previous");
      prev.disabled = accPage <= 1;
      const next = btn("button", "account-next", "btn btn-ghost", "Next");
      next.disabled = accPage >= pages;
      prev.addEventListener("click", () => {
        accPage -= 1;
        paint();
      });
      next.addEventListener("click", () => {
        accPage += 1;
        paint();
      });
      pager.append(prev, next);

      const empty = document.createElement("p");
      empty.className = "sut-empty";
      empty.hidden = items.length > 0;
      empty.dataset.testid = "account-empty";
      empty.textContent = "No accounts match these filters.";

      body.append(kpi, create, filters, meta, empty, tableWrap(table), pager);
      if (selectedAccount) await paintAccountDrawer(body, selectedAccount);
    }

    function renderAccountRows(table, items) {
      const tbody = table.querySelector("tbody");
      tbody.replaceChildren();
      items.forEach((row) => {
        const tr = document.createElement("tr");
        tr.dataset.testid = "account-row";
        tr.dataset.id = row.id;
        tr.dataset.status = row.status;
        tr.dataset.currency = row.currency;
        if (row.id === selectedAccount) tr.classList.add("is-selected");
        const shown = row.id === "acc-3" ? String(Math.floor(row.balance)) : money(row.balance);
        tr.style.cursor = "pointer";
        tr.append(
          td(row.holder),
          td(row.iban, "iban"),
          td(row.type),
          td(row.currency),
          td(shown, "account-balance"),
          statusCell(row.status)
        );
        const act = document.createElement("td");
        act.className = "sut-row-actions";
        act.addEventListener("click", (event) => event.stopPropagation());
        const edit = btn("button", "account-edit", "sut-row-btn", "Edit");
        edit.addEventListener("click", (event) => {
          event.stopPropagation();
          openAccountEditor(row);
        });
        act.append(edit);
        if (row.status !== "Closed") {
          const freeze = btn("button", "account-freeze", "sut-row-btn", row.status === "Frozen" ? "Unfreeze" : "Freeze");
          freeze.addEventListener("click", (event) => {
            event.stopPropagation();
            confirmAction(
              row.status === "Frozen" ? "Unfreeze account?" : "Freeze account?",
              row.holder + " · " + row.iban + ". Outgoing transfers will be blocked while frozen.",
              async () => {
                const nextStatus = row.status === "Frozen" ? "Active" : "Frozen";
                await api("accounts/" + row.id, {
                  method: "PATCH",
                  body: JSON.stringify({ status: nextStatus }),
                });
                toast("Request accepted: " + nextStatus, "ok");
                paint();
              }
            );
          });
          act.append(freeze);
        }
        const del = btn("button", "account-delete", "sut-row-btn", "Delete");
        del.addEventListener("click", (event) => {
          event.stopPropagation();
          confirmAction(
            "Delete account?",
            row.holder + " · " + row.iban + ". Pending transfers on this account block delete.",
            async () => {
              const res = await api("accounts/" + row.id, { method: "DELETE" });
              if (res.status >= 400) {
                toast((res.body && res.body.error) || "Delete failed", "err");
                return;
              }
              if (selectedAccount === row.id) selectedAccount = "";
              toast("Account deleted", "ok");
              paint();
            }
          );
        });
        act.append(del);
        tr.append(act);
        tr.addEventListener("click", () => {
          selectedAccount = row.id;
          paint();
        });
        tbody.append(tr);
      });
    }

    async function paintTransfers(body) {
      const qs =
        "status=" + encodeURIComponent(txFilters.status) +
        "&minAmount=" + encodeURIComponent(txFilters.minAmount) +
        "&maxAmount=" + encodeURIComponent(txFilters.maxAmount);
      const res = await api("transfers?" + qs);
      const items = (res.body && res.body.items) || [];
      const accs = (await api("accounts?status=All&pageSize=100")).body.items || accounts();

      const form = document.createElement("form");
      form.className = "sut-filters";
      form.dataset.testid = "transfer-form";
      const from = accountSelect("transfer-from", accs);
      const to = accountSelect("transfer-to", accs, 1);
      const amount = input("number", "transfer-amount", "Amount");
      amount.step = "0.01";
      amount.min = "0";
      const send = btn("submit", "transfer-submit", "btn btn-primary", "Create transfer");
      const err = document.createElement("p");
      err.className = "sut-error";
      err.hidden = true;
      err.dataset.testid = "transfer-error";
      bindBusy(form, send, async () => {
        err.hidden = true;
        const created = await api("transfers", {
          method: "POST",
          body: JSON.stringify({ from: from.value, to: to.value, amount: Number(amount.value) }),
        });
        if (created.status >= 400 || (created.body && created.body.ok === false)) {
          failBox(err, created, "Transfer failed");
          toast((created.body && created.body.error) || "Transfer failed", "err");
          return;
        }
        amount.value = "";
        toast("Transfer " + (created.body.ref || created.body.id) + " created", "ok");
        paint();
      });
      form.append(
        filterRow(
          labeled("From", from, "sut-filter-grow"),
          labeled("To", to, "sut-filter-grow"),
          labeled("Amount", amount),
          actions(send)
        ),
        err
      );

      const filters = document.createElement("form");
      filters.className = "sut-filters";
      filters.dataset.testid = "transfer-filters";
      const status = select("transfer-status", ["All", "Pending", "Settled", "Failed"], txFilters.status);
      const min = input("number", "transfer-min", "Min amount");
      min.value = txFilters.minAmount;
      const max = input("number", "transfer-max", "Max amount");
      max.value = txFilters.maxAmount;
      filters.addEventListener("submit", (event) => {
        event.preventDefault();
        txFilters = { status: status.value, minAmount: min.value, maxAmount: max.value };
        paint();
      });
      filters.append(
        filterRow(
          labeled("Status", status),
          labeled("Min amount", min),
          labeled("Max amount", max),
          actions(btn("submit", "transfer-apply", "btn btn-primary", "Apply filters"))
        )
      );

      const table = document.createElement("table");
      table.className = "sut-table";
      table.dataset.testid = "transfer-table";
      const tbody = document.createElement("tbody");
      const byId = {};
      accs.forEach((row) => {
        byId[row.id] = row;
      });
      items.forEach((row) => {
        const tr = document.createElement("tr");
        tr.dataset.testid = "transfer-row";
        tr.dataset.status = row.status;
        tr.append(
          td(row.createdAt),
          td(row.ref || row.id, "transfer-ref"),
          td(byId[row.from] ? byId[row.from].holder : row.from),
          td(byId[row.to] ? byId[row.to].holder : row.to),
          td(money(row.amount)),
          td(row.currency),
          statusCell(row.status, "transfer-status")
        );
        tbody.append(tr);
      });
      table.append(tableHead(["Date", "Ref", "From", "To", "Amount", "CCY", "Status"]), tbody);
      body.append(form, filters, tableWrap(table));
    }

    async function paintAccess(body) {
      const res = await api("members");
      const items = (res.body && res.body.items) || [];
      const invite = document.createElement("form");
      invite.className = "sut-filters";
      invite.dataset.testid = "invite-form";
      const name = input("text", "invite-name", "Name");
      const mail = input("email", "invite-email", "Email");
      const role = select("invite-role", MEMBER_ROLES, "Viewer");
      const err = document.createElement("p");
      err.className = "sut-error";
      err.hidden = true;
      const inviteSubmit = btn("submit", "invite-submit", "btn btn-primary", "Invite");
      bindBusy(invite, inviteSubmit, async () => {
        err.hidden = true;
        const created = await api("members", {
          method: "POST",
          body: JSON.stringify({ name: name.value.trim(), email: mail.value.trim(), role: role.value }),
        });
        if (created.status >= 400) {
          failBox(err, created, "Failed");
          return;
        }
        name.value = "";
        mail.value = "";
        toast("Invite sent to " + created.body.email, "ok");
        paint();
      });
      invite.append(
        filterRow(
          labeled("Name", name),
          labeled("Email", mail, "sut-filter-grow"),
          labeled("Role", role),
          actions(inviteSubmit)
        ),
        err
      );

      const table = document.createElement("table");
      table.className = "sut-table";
      table.dataset.testid = "member-table";
      const tbody = document.createElement("tbody");
      items.forEach((row) => {
        const tr = document.createElement("tr");
        tr.dataset.testid = "member-row";
        tr.dataset.email = row.email;
        const roleCell = td(row.role);
        roleCell.dataset.testid = "member-role";
        tr.append(td(row.name), td(row.email), roleCell, td(row.status));
        tbody.append(tr);
      });
      table.append(tableHead(["Name", "Email", "Role", "Status"]), tbody);
      body.append(invite, tableWrap(table));
    }

    function paintApi(body) {
      const lead = document.createElement("p");
      lead.className = "sut-muted";
      lead.textContent =
        "Live REST for this SUT. Chrome DevTools → Network → Fetch/XHR shows the calls (Service Worker). Playwright E2E can waitForResponse. Playwright request (Node HTTP) does not hit this API.";
      const routes = document.createElement("pre");
      routes.className = "sut-routes";
      routes.dataset.testid = "api-routes";
      routes.textContent = [
        "POST /sandbox/api/v1/auth/login",
        "POST /sandbox/api/v1/auth/logout",
        "GET  /sandbox/api/v1/me",
        "GET  /sandbox/api/v1/stats",
        "GET  /sandbox/api/v1/audit",
        "GET  /sandbox/api/v1/accounts?q&status&currency&minBalance&maxBalance&sort&page&pageSize",
        "GET  /sandbox/api/v1/accounts/:id",
        "POST /sandbox/api/v1/accounts",
        "PUT  /sandbox/api/v1/accounts/:id",
        "PATCH /sandbox/api/v1/accounts/:id",
        "DELETE /sandbox/api/v1/accounts/:id",
        "GET  /sandbox/api/v1/transfers?status&minAmount&maxAmount",
        "POST /sandbox/api/v1/transfers",
        "GET  /sandbox/api/v1/members",
        "POST /sandbox/api/v1/members",
      ].join("\n");
      const log = document.createElement("div");
      log.className = "sut-log";
      log.dataset.testid = "api-log";
      const renderLog = () => {
        log.replaceChildren();
        if (!apiLog.length) {
          log.append(Object.assign(document.createElement("p"), { className: "sut-muted", textContent: "No calls yet. Use Accounts or Transfers." }));
          return;
        }
        apiLog.forEach((entry) => {
          const item = document.createElement("article");
          item.className = "sut-log-item";
          const h = document.createElement("p");
          h.className = "sut-log-head";
          h.textContent = entry.status + " " + entry.method + " " + entry.path;
          const pre = document.createElement("pre");
          pre.textContent = JSON.stringify(entry.body, null, 2);
          item.append(h, pre);
          log.append(item);
        });
      };
      logListeners = [renderLog];
      renderLog();
      body.append(lead, routes, log);
    }

    async function paintAudit(body) {
      const res = await api("audit");
      const items = (res.body && res.body.items) || [];
      const lead = document.createElement("p");
      lead.className = "sut-muted";
      lead.textContent = "Access events for this TEST workspace. Login, freeze, create, update, delete, transfer, invite.";
      const table = document.createElement("table");
      table.className = "sut-table";
      table.dataset.testid = "audit-table";
      const tbody = document.createElement("tbody");
      items.forEach((row) => {
        const tr = document.createElement("tr");
        tr.dataset.testid = "audit-row";
        tr.append(td(row.at), td(row.actor), td(row.action), td(row.target), statusCell(row.result, "audit-result"));
        tbody.append(tr);
      });
      table.append(tableHead(["Time", "Actor", "Action", "Target", "Result"]), tbody);
      body.append(lead, tableWrap(table));
    }

    async function paintAccountDrawer(body, id) {
      const detail = await api("accounts/" + id);
      const row = detail.body;
      if (!row || !row.id) return;
      if (row.id === "acc-3" && Number(row.balance) !== Math.floor(Number(row.balance))) note("ui-api-drift");
      const txs = await api("transfers?status=All");
      const related = ((txs.body && txs.body.items) || []).filter((item) => item.from === id || item.to === id);
      const panel = document.createElement("aside");
      panel.className = "sut-drawer";
      panel.dataset.testid = "account-drawer";
      const head = document.createElement("div");
      head.className = "sut-drawer-head";
      const title = document.createElement("h3");
      title.textContent = row.holder;
      const close = btn("button", "drawer-close", "sut-row-btn", "Close");
      close.addEventListener("click", () => {
        selectedAccount = "";
        paint();
      });
      head.append(title, close);
      const copy = btn("button", "copy-iban", "btn btn-ghost", "Copy IBAN");
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(row.iban);
        } catch {
          /* ignore */
        }
        toast("IBAN copied", "ok");
      });
      const drawerEdit = btn("button", "account-drawer-edit", "btn btn-ghost", "Edit account");
      drawerEdit.addEventListener("click", () => openAccountEditor(row));
      const dl = document.createElement("dl");
      dl.className = "sut-dl";
      [
        ["IBAN", row.iban],
        ["Type", row.type],
        ["Currency", row.currency],
        ["Balance (API)", money(row.balance)],
        ["Status", row.status],
        ["Account ID", row.id],
      ].forEach(([k, v]) => {
        const dt = document.createElement("dt");
        dt.textContent = k;
        const dd = document.createElement("dd");
        dd.textContent = v;
        dl.append(dt, dd);
      });
      const txTitle = document.createElement("h4");
      txTitle.textContent = "Related transfers";
      const list = document.createElement("ul");
      list.className = "sut-related";
      if (!related.length) {
        const li = document.createElement("li");
        li.textContent = "None in this workspace.";
        list.append(li);
      }
      related.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = (item.ref || item.id) + " · " + money(item.amount) + " " + item.currency + " · " + item.status;
        list.append(li);
      });
      const drawerActs = document.createElement("div");
      drawerActs.className = "sut-filter-actions";
      drawerActs.append(copy, drawerEdit);
      panel.append(head, drawerActs, dl, txTitle, list);
      body.append(panel);
    }

    function statusCell(status, testid) {
      const cell = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = "sut-pill sut-pill-" + String(status || "").toLowerCase();
      if (testid) pill.dataset.testid = testid;
      pill.textContent = status;
      cell.append(pill);
      return cell;
    }

    function toast(text, kind) {
      let node = root.querySelector("[data-testid='sut-toast']");
      if (!node) {
        node = document.createElement("div");
        node.className = "sut-toast";
        node.dataset.testid = "sut-toast";
        root.append(node);
      }
      node.textContent = text;
      node.className = "sut-toast is-on" + (kind === "err" ? " is-err" : "");
      clearTimeout(node._timer);
      node._timer = setTimeout(() => node.classList.remove("is-on"), 2400);
    }

    function openAccountEditor(row) {
      const modal = openOverlay("account-edit-modal", "is-form");
      const form = document.createElement("form");
      form.className = "sut-filters";
      form.dataset.testid = "account-edit-form";
      const h = document.createElement("h3");
      h.id = "account-edit-title";
      h.textContent = "Edit account";
      modal.overlay.setAttribute("aria-labelledby", "account-edit-title");
      const fields = accountFields(
        {
          holder: "account-edit-holder",
          iban: "account-edit-iban",
          type: "account-edit-type",
          ccy: "account-edit-ccy",
          balance: "account-edit-balance",
          status: "account-edit-status",
        },
        row
      );
      const err = document.createElement("p");
      err.className = "sut-error";
      err.hidden = true;
      err.dataset.testid = "account-edit-error";
      const cancel = btn("button", "account-edit-cancel", "btn btn-ghost", "Cancel");
      const saveBtn = btn("submit", "account-edit-submit", "btn btn-primary", "Save");
      cancel.addEventListener("click", modal.close);
      bindBusy(form, saveBtn, async () => {
        err.hidden = true;
        const res = await api("accounts/" + row.id, {
          method: "PUT",
          body: JSON.stringify(fields.body()),
        });
        if (res.status >= 400) {
          failBox(err, res, "Update failed");
          toast((res.body && res.body.error) || "Update failed", "err");
          return;
        }
        modal.close();
        toast("Account " + row.id + " updated", "ok");
        paint();
      });
      form.append(
        h,
        filterRow(
          labeled("Client", fields.holder, "sut-filter-grow"),
          labeled("IBAN", fields.iban, "sut-filter-grow")
        ),
        filterRow(
          labeled("Type", fields.type),
          labeled("CCY", fields.ccy),
          labeled("Balance", fields.bal),
          labeled("Status", fields.status)
        ),
        err,
        actions(cancel, saveBtn)
      );
      modal.card.append(form);
      fields.holder.focus();
    }

    function confirmAction(title, text, onOk) {
      const modal = openOverlay("confirm-modal");
      const h = document.createElement("h3");
      h.id = "confirm-title";
      h.textContent = title;
      modal.overlay.setAttribute("aria-labelledby", "confirm-title");
      const p = document.createElement("p");
      p.textContent = text;
      const row = document.createElement("div");
      row.className = "sut-filter-actions";
      const cancel = btn("button", "confirm-cancel", "btn btn-ghost", "Cancel");
      const ok = btn("button", "confirm-ok", "btn btn-primary", "Confirm");
      cancel.addEventListener("click", modal.close);
      ok.addEventListener("click", async () => {
        modal.close();
        await onOk();
      });
      row.append(cancel, ok);
      modal.card.append(h, p, row);
      ok.focus();
    }

    function openOverlay(testid, extraClass) {
      if (modalClose) modalClose();
      const overlay = document.createElement("div");
      overlay.className = "sut-modal";
      overlay.dataset.testid = testid;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      const card = document.createElement("div");
      card.className = "sut-modal-card" + (extraClass ? " " + extraClass : "");
      overlay.append(card);
      const prev = document.activeElement;
      const onKey = (event) => {
        if (event.key === "Escape") close();
      };
      const close = () => {
        document.removeEventListener("keydown", onKey);
        overlay.remove();
        if (modalClose === close) modalClose = null;
        if (prev && typeof prev.focus === "function") prev.focus();
      };
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) close();
      });
      document.addEventListener("keydown", onKey);
      root.append(overlay);
      modalClose = close;
      return { overlay: overlay, card: card, close: close };
    }

    function accountFields(ids, row) {
      const holder = input("text", ids.holder, "Client name");
      holder.value = row.holder || "";
      const iban = input("text", ids.iban, "IBAN");
      iban.value = row.iban || "";
      const type = select(ids.type, ACCOUNT_TYPES, row.type || "Current");
      const ccy = select(ids.ccy, CURRENCIES, row.currency || "EUR");
      const bal = input("number", ids.balance, "0.00");
      bal.step = "0.01";
      bal.min = "0";
      bal.value = row.balance == null || row.balance === "" ? "0" : String(row.balance);
      const status = select(ids.status, ACCOUNT_STATUSES, row.status || "Active");
      return {
        holder: holder,
        iban: iban,
        type: type,
        ccy: ccy,
        bal: bal,
        status: status,
        body: function () {
          return {
            holder: holder.value.trim(),
            iban: iban.value.trim(),
            type: type.value,
            currency: ccy.value,
            balance: Number(bal.value),
            status: status.value,
          };
        },
      };
    }

    function bindBusy(form, submitBtn, handler) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (form.dataset.busy === "1") return;
        form.dataset.busy = "1";
        if (submitBtn) submitBtn.disabled = true;
        try {
          await handler();
        } finally {
          form.dataset.busy = "";
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    function failBox(node, res, fallback) {
      node.hidden = false;
      node.textContent =
        (res && res.status ? res.status + " · " : "") +
        ((res && res.body && (res.body.error || res.body.message)) || fallback || "Failed");
    }

    function toQuery(map) {
      return Object.keys(map)
        .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(map[key] == null ? "" : map[key]))
        .join("&");
    }

    function tableHead(labels) {
      const head = document.createElement("thead");
      const hr = document.createElement("tr");
      labels.forEach((label) => {
        const th = document.createElement("th");
        if (typeof label === "string") {
          th.textContent = label;
        } else {
          th.textContent = label.text;
          if (label.testid) th.dataset.testid = label.testid;
          if (label.onClick) {
            th.style.cursor = "pointer";
            th.tabIndex = 0;
            th.addEventListener("click", label.onClick);
            th.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                label.onClick();
              }
            });
          }
        }
        hr.append(th);
      });
      head.append(hr);
      return head;
    }

    function downloadCsv(rows) {
      const header = "id,holder,iban,type,currency,balance,status";
      const lines = (rows || []).map((row) =>
        [row.id, row.holder, row.iban, row.type, row.currency, row.balance, row.status]
          .map((value) => '"' + String(value).replace(/"/g, '""') + '"')
          .join(",")
      );
      const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "northgate-accounts.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    }

    function labelWrap(text, node) {
      const lab = document.createElement("label");
      lab.className = "field";
      const span = document.createElement("span");
      span.textContent = text;
      lab.append(span, node);
      return lab;
    }

    function labeled(text, node, extraClass) {
      const wrap = document.createElement("label");
      wrap.className = "sut-filter-label" + (extraClass ? " " + extraClass : "");
      const span = document.createElement("span");
      span.textContent = text;
      wrap.append(span, node);
      return wrap;
    }

    function filterRow() {
      const wrap = document.createElement("div");
      wrap.className = "sut-filter-row";
      Array.prototype.forEach.call(arguments, (node) => wrap.append(node));
      return wrap;
    }

    function actions() {
      const wrap = document.createElement("div");
      wrap.className = "sut-filter-actions";
      Array.prototype.forEach.call(arguments, (node) => wrap.append(node));
      return wrap;
    }

    function tableWrap(table) {
      const wrap = document.createElement("div");
      wrap.className = "sut-table-wrap";
      wrap.append(table);
      return wrap;
    }

    function input(type, testid, placeholder) {
      const node = document.createElement("input");
      node.type = type;
      node.placeholder = placeholder;
      node.dataset.testid = testid;
      return node;
    }

    function select(testid, values, current) {
      const node = document.createElement("select");
      node.dataset.testid = testid;
      values.forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        if (value === current) opt.selected = true;
        node.append(opt);
      });
      return node;
    }

    function accountSelect(testid, accs, index) {
      const node = document.createElement("select");
      node.dataset.testid = testid;
      accs.filter((row) => row.status === "Active").forEach((row, i) => {
        const opt = document.createElement("option");
        opt.value = row.id;
        opt.textContent = row.holder + " · " + row.currency + " · " + money(row.balance);
        if (i === (index || 0)) opt.selected = true;
        node.append(opt);
      });
      return node;
    }

    function btn(type, testid, className, text) {
      const node = document.createElement("button");
      node.type = type;
      node.className = className;
      node.dataset.testid = testid;
      node.textContent = text;
      return node;
    }

    function td(text, testid) {
      const node = document.createElement("td");
      node.textContent = text;
      if (testid) node.dataset.testid = testid;
      return node;
    }

    function money(value) {
      return Number(value).toFixed(2);
    }

    if (!localStorage.getItem(K_ACCOUNTS)) save(K_ACCOUNTS, cloneSeed(SEED_ACCOUNTS));
    if (!localStorage.getItem(K_TRANSFERS)) save(K_TRANSFERS, cloneSeed(SEED_TRANSFERS));
    if (!localStorage.getItem(K_MEMBERS)) save(K_MEMBERS, cloneSeed(SEED_MEMBERS));
    if (!localStorage.getItem(K_AUDIT)) save(K_AUDIT, cloneSeed(SEED_AUDIT));
    const loading = document.createElement("p");
    loading.className = "sut-muted sut-loading";
    loading.textContent = "Loading console…";
    root.replaceChildren(loading);
    Promise.resolve(apiReady).then(() => {
      if (alive()) paint();
    });
  };
})();
