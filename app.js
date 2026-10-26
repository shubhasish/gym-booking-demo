(() => {
  const $ = (id) => document.getElementById(id);
  const STORE = "gym-booking";

  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } };
  const save = (b) => { try { b ? localStorage.setItem(STORE, JSON.stringify(b)) : localStorage.removeItem(STORE); } catch {} };

  let booking = load();
  let stream = null;
  let scanning = false;

  function show(name) {
    document.querySelectorAll(".view").forEach((v) => (v.hidden = v.dataset.view !== name));
    window.scrollTo(0, 0);
  }

  function route() {
    const hash = location.hash.replace("#", "") || "home";
    if (hash !== "scan") stopCamera();
    if (hash !== "home" && !booking) return go("home");
    if (hash === "booking") renderBooking();
    if (hash === "success") $("success-id").textContent = "#" + booking.id;
    show(["home", "booking", "scan", "success"].includes(hash) ? hash : "home");
    if (hash === "scan") startCamera();
  }
  const go = (name) => { location.hash = name; };

  function newBooking() {
    const t = new Date();
    t.setMinutes(Math.ceil((t.getMinutes() + 30) / 30) * 30, 0, 0);
    booking = { id: String(Math.floor(1e7 + Math.random() * 9e7)), start: t.toISOString(), scanned: false };
    save(booking);
  }

  function renderBooking() {
    $("booking-title").textContent = "Booking #" + booking.id;
    const t = new Date(booking.start);
    const sameDay = t.toDateString() === new Date().toDateString();
    const time = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }).toUpperCase();
    const day = sameDay ? "Today" : t.toLocaleDateString([], { day: "numeric", month: "short" });
    $("booking-time").textContent = `${day}, ${time}`;
    $("status").textContent = booking.scanned ? "Checked in" : "Scheduled";
  }

  /* ---------- camera / QR ---------- */
  async function startCamera() {
    const err = $("scan-error");
    err.hidden = true;
    $("btn-demo").hidden = true;
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      return fail("Camera isn't available here. Use HTTPS or upload a QR image.");
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      const v = $("video");
      v.srcObject = stream;
      await v.play();
      scanning = true;
      requestAnimationFrame(tick);
    } catch (e) {
      fail(e.name === "NotAllowedError"
        ? "Camera permission denied. Allow it in browser settings, or upload a QR image."
        : "Couldn't open the camera. You can upload a QR image instead.");
    }
  }

  function fail(msg) {
    const err = $("scan-error");
    err.textContent = msg;
    err.hidden = false;
    $("btn-demo").hidden = false;
  }

  function stopCamera() {
    scanning = false;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    $("video").srcObject = null;
  }

  function tick() {
    if (!scanning) return;
    const v = $("video");
    if (v.readyState === v.HAVE_ENOUGH_DATA && v.videoWidth) {
      const c = $("canvas");
      const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * w);
      c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      if (window.jsQR && jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })) return onScanned();
    }
    requestAnimationFrame(tick);
  }

  function onScanned() {
    stopCamera();
    if (navigator.vibrate) navigator.vibrate(80);
    booking.scanned = true;
    save(booking);
    go("success");
  }

  function decodeFile(file) {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const s = Math.min(1, 1000 / Math.max(img.width, img.height));
      c.width = img.width * s; c.height = img.height * s;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      jsQR(d.data, c.width, c.height) ? onScanned() : fail("No QR code found in that image.");
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  /* ---------- wiring ---------- */
  $("btn-book").onclick = () => { newBooking(); go("booking"); };
  $("btn-close").onclick = () => go("home");
  $("btn-scan-now").onclick = () => go("scan");
  $("btn-scan-back").onclick = () => go("booking");
  $("btn-restart").onclick = startCamera;
  $("btn-demo").onclick = onScanned;
  $("btn-done").onclick = () => { booking = null; save(null); go("home"); };
  $("file").onchange = (e) => { if (e.target.files[0]) decodeFile(e.target.files[0]); e.target.value = ""; };

  window.addEventListener("hashchange", route);
  route();
})();
