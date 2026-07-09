// AkamaiForms microsite — load orchestration, scroll reveals, theme.

// Mark JS availability first: reveal/entrance styling is gated on this,
// so content is never hidden for no-JS readers or crawlers.
document.documentElement.classList.add("js");

// Kick the hero choreography once fonts are ready (or promptly regardless).
const start = () => document.documentElement.classList.add("loaded");
if (document.fonts && document.fonts.ready) {
  Promise.race([
    document.fonts.ready,
    new Promise((r) => setTimeout(r, 400)),
  ]).then(() => requestAnimationFrame(start));
} else {
  requestAnimationFrame(start);
}

// Scroll reveals — an rAF-throttled sweep. Unlike an IntersectionObserver,
// this can't miss elements skipped between frames on fast scrolls: anything
// whose top has entered (or passed) the viewport reveals and stays revealed.
let pending = new Set(document.querySelectorAll(".reveal"));
let ticking = false;
const sweep = () => {
  ticking = false;
  const limit = window.innerHeight * 0.92;
  for (const el of pending) {
    if (el.getBoundingClientRect().top < limit) {
      el.classList.add("in");
      pending.delete(el);
    }
  }
  if (!pending.size) {
    removeEventListener("scroll", onScroll);
    removeEventListener("resize", onScroll);
  }
};
const onScroll = () => {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(sweep);
  }
};
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll, { passive: true });
sweep();

// Theme: honor saved choice; otherwise follow the system.
const root = document.documentElement;
const saved = localStorage.getItem("af-theme");
if (saved === "light" || saved === "dark") root.dataset.theme = saved;

document.getElementById("theme-toggle").addEventListener("click", () => {
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.dataset.theme || (systemDark ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  localStorage.setItem("af-theme", next);
});

// ---------------------------------------------------------------------------
// Contact form — relayed through Web3Forms so no email address ever appears
// in this page. The access key below is PUBLIC by design; the service maps
// it to the destination inbox server-side. Get one at https://web3forms.com
// (enter the receiving address once; it is never shown to visitors).
const FORM_ACCESS_KEY = "2a7240fd-8229-44e4-bff4-635c478d46b3"; // "AkamaiForms Contact"

const form = document.getElementById("contact-form");
const submitBtn = document.getElementById("cf-submit");
const formError = document.getElementById("cf-form-error");

const fields = {
  name: {
    el: document.getElementById("cf-name"),
    error: document.getElementById("cf-name-error"),
    valid: (v) => v.trim().length > 0,
  },
  email: {
    el: document.getElementById("cf-email"),
    error: document.getElementById("cf-email-error"),
    valid: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  },
  message: {
    el: document.getElementById("cf-message"),
    error: document.getElementById("cf-message-error"),
    valid: (v) => v.trim().length > 0,
  },
};

let triedOnce = false;

const checkField = (f) => {
  const ok = f.valid(f.el.value);
  f.el.setAttribute("aria-invalid", ok ? "false" : "true");
  f.error.hidden = ok;
  return ok;
};

// After the first submit attempt, re-validate live so errors clear as typed.
for (const f of Object.values(fields)) {
  f.el.addEventListener("input", () => { if (triedOnce) checkField(f); });
  f.el.setAttribute("aria-describedby", f.error.id);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  triedOnce = true;
  formError.hidden = true;

  const results = Object.values(fields).map(checkField);
  if (results.includes(false)) {
    Object.values(fields).find((f) => f.error.hidden === false)?.el.focus();
    return;
  }

  // Honeypot: bots tick the invisible box; people can't. Quietly drop it.
  if (form.querySelector(".botcheck").checked) return;

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending…";

  const payload = {
    access_key: FORM_ACCESS_KEY,
    subject: "AkamaiForms site — new note",
    from_name: "akamaiforms.com contact form",
    name: fields.name.el.value.trim(),
    email: fields.email.el.value.trim(),
    organization: document.getElementById("cf-org").value.trim(),
    volume: document.getElementById("cf-volume").value,
    message: fields.message.el.value.trim(),
  };

  try {
    let ok;
    if (window.__DEMO_FORM__) {
      // Preview builds: simulate the round trip; nothing is sent anywhere.
      await new Promise((r) => setTimeout(r, 900));
      ok = true;
    } else {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      ok = res.ok && (await res.json()).success === true;
    }
    if (!ok) throw new Error("relay rejected");
    const sent = document.getElementById("form-sent");
    form.hidden = true;
    sent.hidden = false;
    sent.focus();
  } catch {
    formError.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "Send it over";
  }
});
