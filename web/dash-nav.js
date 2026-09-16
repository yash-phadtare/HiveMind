// Shared dashboard UX helpers:
// - keyboard shortcut (Alt + number / plain number outside form fields) to jump between nav sections
// - floating "back to top" button for long lists

(function () {
  function isEditable(target) {
    return (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable)
    );
  }

  const links = Array.from(document.querySelectorAll(".admin-nav a"));

  document.addEventListener("keydown", (event) => {
    if (event.repeat || !links.length) return;
    const alt = event.altKey && !event.ctrlKey && !event.metaKey;
    const plain =
      !event.altKey && !event.ctrlKey && !event.metaKey && !isEditable(event.target);
    if (!alt && !plain) return;
    const key = event.key;
    if (!/^[1-9]$/.test(key)) return;
    const link = links[Number(key) - 1];
    if (!link) return;
    event.preventDefault();
    link.click();
  });

  const toTop = document.createElement("button");
  toTop.id = "back-to-top";
  toTop.type = "button";
  toTop.setAttribute("aria-label", "Back to top");
  toTop.innerHTML = "&#8593;";
  document.body.appendChild(toTop);

  const onScroll = () => {
    const visible = (window.pageYOffset || document.documentElement.scrollTop) > 480;
    toTop.classList.toggle("is-visible", visible);
  };
  let ticking = false;
  window.addEventListener(
    "scroll",
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        onScroll();
        ticking = false;
      });
    },
    { passive: true },
  );
  onScroll();

  toTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();