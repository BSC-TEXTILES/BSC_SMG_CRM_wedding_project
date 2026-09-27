(function () {
  var loader = document.getElementById("loader");

  function hideLoader() {
    if (!loader || loader.classList.contains("is-done")) return;
    loader.classList.add("is-done");
    try { sessionStorage.setItem("madt_booted", "1"); } catch (e) {}
    window.setTimeout(function () {
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    }, 450);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      window.setTimeout(hideLoader, 380);
    });
  } else {
    window.setTimeout(hideLoader, 380);
  }
  window.setTimeout(hideLoader, 1600);

  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  var menuBtn = document.getElementById("menu-btn");
  var menu = document.getElementById("mobile-menu");

  function closeMenu() {
    if (!menu || !menuBtn) return;
    menu.hidden = true;
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Open menu");
    document.body.classList.remove("menu-open");
  }

  function openMenu() {
    if (!menu || !menuBtn) return;
    menu.hidden = false;
    menuBtn.setAttribute("aria-expanded", "true");
    menuBtn.setAttribute("aria-label", "Close menu");
    document.body.classList.add("menu-open");
    var first = menu.querySelector("a, button");
    if (first) first.focus();
  }

  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      if (menu.hidden) openMenu();
      else closeMenu();
    });
    menu.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menu && !menu.hidden) {
        closeMenu();
        menuBtn.focus();
      }
    });
  }

  function paintAuth(user) {
    document.querySelectorAll(".nav-login").forEach(function (el) { el.hidden = !!user; });
    document.querySelectorAll(".nav-account").forEach(function (el) {
      el.hidden = !user;
      if (user) {
        el.textContent = user.role === "admin" ? "House desk" : user.role === "staff" ? "Floor book" : "Account";
      }
    });
    document.querySelectorAll(".nav-logout").forEach(function (el) { el.hidden = !user; });
  }

  fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (user) {
      paintAuth(user);
      if (user && document.body.dataset.page === "login") {
        window.location.replace("/desk");
      }
    })
    .catch(function () { paintAuth(null); });

  document.querySelectorAll(".nav-logout").forEach(function (btn) {
    btn.addEventListener("click", function () {
      fetch("/api/logout", { method: "POST", credentials: "same-origin" })
        .finally(function () { window.location.replace("/"); });
    });
  });

  var searchBtn = document.getElementById("search-open");
  var searchDialog = document.getElementById("search-dialog");
  var searchInput = document.getElementById("search-input");
  var searchList = document.getElementById("search-results");
  var searchIndex = [
    { t: "Women", d: "Sarees, suits, everyday cloth", h: "/#women" },
    { t: "Men", d: "Shirts, trousers, occasion wear", h: "/#men" },
    { t: "Brands", d: "Labels the house stocks", h: "/#brands" },
    { t: "Home furnishing", d: "Linen and cloth for the house", h: "/#home" },
    { t: "Jewellery", d: "Gold and set pieces", h: "/#jewellery" },
    { t: "Wedding", d: "Booked wedding shopping", h: "/#wedding" },
    { t: "Suits", d: "Fittings and suit cloth", h: "/#suits" },
    { t: "Towels", d: "Bath and guest towels", h: "/#towels" },
    { t: "Other", d: "Seasonal cloth and gifts", h: "/#other" },
    { t: "Stores", d: "Koppikar Road, Vidyanagar, Coen Road", h: "/#stores" },
    { t: "Visit the store", d: "Hours and how to come", h: "/#visit" },
    { t: "Book consultation", d: "Reserve an hour", h: "/consult" },
    { t: "Register for wedding shopping", d: "Start the wedding list", h: "/wedding" },
    { t: "Contact", d: "Write to the desk", h: "/contact" },
    { t: "Login", d: "Desk sign-in", h: "/login" }
  ];

  function renderSearch(query) {
    if (!searchList) return;
    var q = (query || "").trim().toLowerCase();
    var items = searchIndex.filter(function (item) {
      return !q || (item.t + " " + item.d).toLowerCase().indexOf(q) !== -1;
    });
    searchList.replaceChildren();
    if (!items.length) {
      var empty = document.createElement("li");
      empty.textContent = "Nothing under that name. Try wedding, towels, or stores.";
      searchList.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = item.h;
      var title = document.createElement("span");
      title.textContent = item.t;
      var small = document.createElement("small");
      small.textContent = item.d;
      a.appendChild(title);
      a.appendChild(small);
      a.addEventListener("click", function () {
        if (searchDialog && searchDialog.open) searchDialog.close();
        closeMenu();
      });
      li.appendChild(a);
      searchList.appendChild(li);
    });
  }

  if (searchBtn && searchDialog && searchInput) {
    searchBtn.addEventListener("click", function () {
      renderSearch("");
      searchDialog.showModal();
      searchInput.value = "";
      searchInput.focus();
    });
    searchInput.addEventListener("input", function () { renderSearch(searchInput.value); });
    searchDialog.addEventListener("click", function (event) {
      if (event.target === searchDialog) searchDialog.close();
    });
    searchDialog.addEventListener("close", function () { searchBtn.focus(); });
    var searchClose = searchDialog.querySelector("[data-close-search]");
    if (searchClose) searchClose.addEventListener("click", function () { searchDialog.close(); });
    var searchForm = document.getElementById("search-form");
    if (searchForm) {
      searchForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var first = searchList && searchList.querySelector("a");
        if (first) first.click();
      });
    }
  }

  var locDialog = document.getElementById("location-dialog");
  if (locDialog) {
    document.querySelectorAll("[data-store]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.getAttribute("data-store");
        locDialog.querySelectorAll("[data-panel]").forEach(function (panel) {
          panel.hidden = panel.getAttribute("data-panel") !== key;
        });
        var title = locDialog.querySelector("#location-title");
        var active = locDialog.querySelector('[data-panel="' + key + '"] h3');
        if (title && active) title.textContent = active.textContent;
        locDialog.showModal();
        var close = locDialog.querySelector("[data-close-loc]");
        if (close) close.focus();
      });
    });
    locDialog.addEventListener("click", function (event) {
      if (event.target === locDialog) locDialog.close();
    });
    var locClose = locDialog.querySelector("[data-close-loc]");
    if (locClose) locClose.addEventListener("click", function () { locDialog.close(); });
  }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  }

  document.querySelectorAll("form[data-desk-form]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var error = form.querySelector(".form-error");
      if (error) error.textContent = "";
      var data = new FormData(form);
      if ((data.get("company") || "").toString().trim()) return;
      var payload = { kind: form.getAttribute("data-desk-form") };
      data.forEach(function (value, key) {
        if (key === "needs") {
          payload.needs = payload.needs || [];
          payload.needs.push(value);
        } else if (key !== "company") {
          payload[key] = value;
        }
      });
      var submit = form.querySelector("[type=submit]");
      if (submit) submit.disabled = true;
      fetch("/api/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      }).then(function (result) {
        if (!result.ok) throw new Error((result.body && result.body.error) || "The desk did not take the note.");
        form.hidden = true;
        var box = document.getElementById("confirm");
        if (box) {
          box.hidden = false;
          var ref = box.querySelector("[data-ref]");
          if (ref) ref.textContent = result.body.ref;

          // Wire Auto-Advocation flow and Copy to Clipboard
          try {
            if (typeof window !== "undefined" && window.buildAutoAdvocationData && window.generateAdvocacyLetter) {
              payload.ref = result.body.ref;
              var advocacyData = window.buildAutoAdvocationData(payload);
              var letter = window.generateAdvocacyLetter(advocacyData);
              var textEl = box.querySelector("#advocacy-text");
              if (textEl) textEl.textContent = letter;

              var copyBtn = box.querySelector("#copy-advocacy-btn");
              if (copyBtn) {
                copyBtn.onclick = function () {
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(letter).then(function () {
                      copyBtn.textContent = "Copied to clipboard!";
                      setTimeout(function () { copyBtn.textContent = "Copy to clipboard"; }, 2500);
                    }).catch(function () {
                      copyBtn.textContent = "Copied!";
                    });
                  }
                };
              }
            }
          } catch (advErr) {
            console.warn("[Auto-Advocation Error]", advErr);
          }
        }
      }).catch(function (err) {
        if (error) error.textContent = err.message || "The desk did not answer. The note is still on this page.";
        if (submit) submit.disabled = false;
      });
    });
  });

  var loginForm = document.getElementById("login-form");
  if (loginForm) {
    var params = new URLSearchParams(window.location.search);
    var loginError = document.getElementById("login-error");
    if (params.get("e") && loginError) {
      loginError.textContent = "That email and password do not match a desk account.";
    }
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (loginError) loginError.textContent = "";
      var submit = loginForm.querySelector("[type=submit]");
      if (submit) submit.disabled = true;
      fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          email: loginForm.email.value,
          password: loginForm.password.value
        })
      }).then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      }).then(function (result) {
        if (!result.ok) throw new Error((result.body && result.body.error) || "Sign-in failed.");
        window.location.replace(result.body.redirect || "/desk");
      }).catch(function (err) {
        if (loginError) loginError.textContent = err.message;
        if (submit) submit.disabled = false;
      });
    });
  }
})();
