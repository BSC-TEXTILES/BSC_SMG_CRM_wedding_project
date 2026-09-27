(function () {
  var main = document.getElementById("main");

  function deny() {
    window.location.replace("/login");
  }

  function gate() {
    document.body.classList.add("desk-pending");
    document.body.classList.remove("desk-ready");
    return fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("no-session");
        return res.json();
      })
      .then(function (user) {
        paint(user);
        document.body.classList.remove("desk-pending");
        document.body.classList.add("desk-ready");
        return loadBook(user);
      })
      .catch(deny);
  }

  function paint(user) {
    var name = document.getElementById("desk-name");
    var role = document.getElementById("desk-role");
    var title = document.getElementById("desk-title");
    var intro = document.getElementById("desk-intro");
    if (name) name.textContent = user.name || "Desk";
    var label = user.role === "admin" ? "House desk" : user.role === "staff" ? "Floor staff" : "Customer";
    if (role) role.textContent = label;
    var hour = new Date().getHours();
    var hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    if (title) {
      title.textContent = user.role === "staff"
        ? "Floor book"
        : user.role === "admin"
          ? "House desk"
          : hello + ", " + (user.name || "").split(" ")[0] + ".";
    }
    if (intro) {
      intro.textContent = user.role === "customer"
        ? "Notes sent with your email appear here. A reference is not a confirmed hour until the floor says so."
        : user.role === "staff"
          ? "Wedding registers, consultations and messages written on this site."
          : "The same book the floor sees, plus the house sign-in. Nothing here is a sales figure.";
    }
    document.querySelectorAll("[data-for]").forEach(function (el) {
      var allow = el.getAttribute("data-for").split(/\s+/);
      el.hidden = allow.indexOf(user.role) === -1;
    });
  }

  function line(text) {
    var p = document.createElement("p");
    p.textContent = text;
    return p;
  }

  function render(items, canNote) {
    var list = document.getElementById("book");
    if (!list) return;
    list.replaceChildren();
    if (!items.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Nothing on the book yet.";
      list.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var row = document.createElement("article");
      row.className = "request";
      var meta = document.createElement("div");
      meta.appendChild(line(item.ref));
      meta.firstChild.className = "ref-sm";
      meta.appendChild(line(item.status === "noted" ? "Noted" : "New"));
      var body = document.createElement("div");
      var h = document.createElement("h3");
      h.textContent = item.name + " · " + kindLabel(item.kind);
      body.appendChild(h);
      body.appendChild(line(detailText(item)));
      if (item.note) body.appendChild(line(item.note));
      row.appendChild(meta);
      row.appendChild(body);
      if (canNote && item.status !== "noted") {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "text-btn";
        btn.textContent = "Mark noted";
        btn.addEventListener("click", function () {
          btn.disabled = true;
          fetch("/api/requests/" + encodeURIComponent(item.id) + "/noted", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Accept": "application/json" }
          }).then(function (res) {
            if (!res.ok) throw new Error("no");
            return gate();
          }).catch(function () {
            btn.disabled = false;
            btn.textContent = "Try again";
          });
        });
        row.appendChild(btn);
      }
      var advBtn = document.createElement("button");
      advBtn.type = "button";
      advBtn.className = "text-btn";
      advBtn.style.marginLeft = "0.75rem";
      advBtn.textContent = "Advocacy letter";
      advBtn.title = "Generate & copy advocacy letter";
      advBtn.addEventListener("click", function () {
        try {
          if (window.buildAutoAdvocationData && window.generateAdvocacyLetter) {
            var data = window.buildAutoAdvocationData(item);
            var letter = window.generateAdvocacyLetter(data);
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(letter).then(function () {
                advBtn.textContent = "Copied letter!";
                setTimeout(function () { advBtn.textContent = "Advocacy letter"; }, 2500);
              });
            } else {
              prompt("Advocacy Letter:", letter);
            }
          }
        } catch (e) {
          console.warn("[Advocacy Error]", e);
        }
      });
      row.appendChild(advBtn);
      list.appendChild(row);
    });
  }

  function kindLabel(kind) {
    if (kind === "wedding") return "Wedding";
    if (kind === "consult") return "Consultation";
    return "Message";
  }

  function detailText(item) {
    var bits = [];
    if (item.phone) bits.push(item.phone);
    if (item.email) bits.push(item.email);
    if (item.floor) bits.push(item.floor);
    if (item.side) bits.push(item.side);
    if (item.date) bits.push(item.date);
    if (item.day) bits.push(item.day);
    if (item.needs && item.needs.length) bits.push(item.needs.join(", "));
    return bits.join(" · ");
  }

  function loadBook(user) {
    return fetch("/api/requests", { credentials: "same-origin", cache: "no-store" })
      .then(function (res) {
        if (res.status === 401) throw new Error("no-session");
        if (!res.ok) throw new Error("book");
        return res.json();
      })
      .then(function (body) {
        render(body.items || [], user.role === "staff" || user.role === "admin");
      })
      .catch(function (err) {
        if (err.message === "no-session") deny();
      });
  }

  window.addEventListener("pageshow", function () { gate(); });
  gate();
})();
