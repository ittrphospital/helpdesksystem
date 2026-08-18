function setupNavigation() {
  const hamburger = document.querySelector("[data-hamburger]");
  const navLinks = document.querySelector("[data-nav-links]");
  if (hamburger && navLinks) {
    hamburger.addEventListener("click", () => {
      const open = navLinks.classList.toggle("open");
      hamburger.classList.toggle("open", open);
      hamburger.setAttribute("aria-expanded", String(open));
    });
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        hamburger.classList.remove("open");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });
  }

  const scrollTop = document.querySelector("[data-scroll-top]");
  if (scrollTop) {
    window.addEventListener("scroll", () => {
      scrollTop.classList.toggle("show", window.scrollY > 420);
    }, { passive: true });
    scrollTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusClass(status) {
  if (status === "กำลังดำเนินการ") return "work";
  if (status === "เสร็จสิ้น") return "done";
  if (status === "ยกเลิก") return "cancel";
  return "wait";
}

function setFooterMetrics(ticketCount) {
  const now = new Date();
  const refresh = document.querySelector("[data-refresh-time]");
  const records = document.querySelector("[data-record-count]");
  const source = document.querySelector("[data-source-name]");
  if (refresh) refresh.textContent = formatDateTime(now);
  if (records) records.textContent = `${ticketCount} รายการ`;
  if (source) source.textContent = "PostgreSQL/Neon Ready";
}

setupNavigation();
