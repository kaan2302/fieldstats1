// Tooltips für Elemente mit data-tip: Maus drüber oder antippen.

export function initTooltip(): void {
  const tip = document.createElement("div");
  tip.className = "tip";
  tip.hidden = true;
  let cur: HTMLElement | null = null;

  const show = (el: HTMLElement, x: number, y: number) => {
    cur = el;
    (el.closest("dialog") || document.body).appendChild(tip);
    tip.textContent = el.getAttribute("data-tip");
    tip.hidden = false;
    const w = tip.offsetWidth,
      h = tip.offsetHeight;
    tip.style.left = Math.max(6, Math.min(innerWidth - w - 6, x - w / 2)) + "px";
    tip.style.top = (y - h - 12 < 6 ? y + 18 : y - h - 12) + "px";
  };
  const hide = () => {
    tip.hidden = true;
    cur = null;
  };
  const target = (e: Event) => (e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tip]") : null);

  document.addEventListener("pointermove", e => {
    if (e.pointerType !== "mouse") return;
    const el = target(e);
    if (el) show(el, e.clientX, e.clientY);
    else if (cur) hide();
  });
  document.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse") return;
    const el = target(e);
    if (el && el !== cur) show(el, e.clientX, e.clientY);
    else hide();
  });
  document.addEventListener("scroll", hide, true);
}
