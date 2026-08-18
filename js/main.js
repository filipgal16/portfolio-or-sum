(function () {
  const nav = document.getElementById("site-nav");
  const toggle = document.querySelector(".nav-toggle");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setNavOpen(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    const label = toggle.querySelector(".visually-hidden");
    if (label) label.textContent = open ? "Close menu" : "Menu";
  }

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      setNavOpen(!nav.classList.contains("is-open"));
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setNavOpen(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setNavOpen(false);
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 800) setNavOpen(false);
    });
  }

  if (reduceMotion) {
    document.querySelectorAll("[data-reveal]").forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  const reveals = document.querySelectorAll("[data-reveal]");
  if (!("IntersectionObserver" in window) || reveals.length === 0) {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
  );

  reveals.forEach(function (el) {
    observer.observe(el);
  });
})();
