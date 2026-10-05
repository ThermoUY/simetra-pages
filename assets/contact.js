(() => {
  const form = document.getElementById("contact-form");
  if (!form) return;
  const fields = document.getElementById("contact-fields");
  const status = document.getElementById("form-status");
  const fallback = document.getElementById("contact-fallback");
  const submit = form.querySelector('button[type="submit"]');
  const config = window.SIMETRA_CONTACT;
  let token = "", widget, busy = false, configured = false, previous = "", requestId, notice = "";
  const unavailable = "Por el momento, podés contactarnos por teléfono al 091 694 978.";
  const uncertain = "No pudimos confirmar el envío. Evitá reenviarlo de inmediato; podés llamarnos al 091 694 978.";
  const invalidate = () => { token = ""; submit.disabled = true; };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!configured || busy || !token || !form.reportValidity()) return;
    const data = new FormData(form);
    const payload = Object.fromEntries(["name", "email", "club", "message", "website"].map(key => [key, String(data.get(key) || "").trim()]));
    const fingerprint = JSON.stringify(payload);
    if (fingerprint !== previous) { requestId = crypto.randomUUID(); previous = fingerprint; }
    notice = "";
    busy = true;
    fields.disabled = true;
    form.setAttribute("aria-busy", "true");
    status.textContent = "Enviando tu consulta…";
    try {
      const response = await fetch(config.endpoint, {
        method: "POST", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, token, requestId }),
        signal: AbortSignal.timeout(20000)
      });
      const result = await response.json();
      if (response.ok && result.ok === true) {
        window.location.assign(new URL("gracias.html", window.location.href).href);
        return;
      }
      notice = response.status === 429
        ? "Se alcanzó el límite de consultas. Intentá más tarde o llamanos al 091 694 978."
        : response.status === 400 || response.status === 403
          ? "Revisá los datos y completá nuevamente la verificación de seguridad."
          : uncertain;
      status.textContent = notice;
    } catch {
      notice = uncertain;
      status.textContent = notice;
    } finally {
      busy = false;
      fields.disabled = false;
      form.removeAttribute("aria-busy");
      invalidate();
      window.turnstile.reset(widget);
    }
  });

  // Sin configuración o JavaScript no se habilita el formulario ni se carga Turnstile.
  try {
    const endpoint = new URL(config?.endpoint);
    if (endpoint.protocol !== "https:" || endpoint.pathname !== "/contact" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !config.sitekey) return;
  } catch { return; }
  if (!crypto.randomUUID || !AbortSignal.timeout) return;

  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.onerror = () => {
    configured = false;
    invalidate();
    fields.disabled = true;
    status.textContent = unavailable;
    status.hidden = Boolean(fallback);
    if (fallback) fallback.hidden = false;
  };
  script.onload = () => {
    try {
      widget = window.turnstile.render("#contact-challenge", {
        sitekey: config.sitekey, action: "contact", theme: "light", size: "compact", language: "es",
        "response-field": false,
        callback: value => { token = value; submit.disabled = busy; if (!busy) status.textContent = notice || "Verificación completa. Podés enviar tu consulta."; },
        "expired-callback": () => { invalidate(); if (!busy) status.textContent = notice || "Completá nuevamente la verificación de seguridad."; },
        "error-callback": () => { invalidate(); if (!busy) status.textContent = notice || unavailable; }
      });
      configured = true;
      fields.disabled = false;
      if (fallback) fallback.hidden = true;
      status.hidden = false;
      submit.disabled = !token;
      status.textContent = "Completá tus datos y la verificación de seguridad para enviar.";
    } catch { script.onerror(); }
  };
  document.head.append(script);
})();
