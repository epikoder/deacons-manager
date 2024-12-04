import { Ref, useEffect, useRef } from "react";
import { IS_BROWSER } from "../utils/is_browser";

interface ClickEvent extends Event {
  offsetX: number;
  offsetY: number;
}

export const useRipple = <T extends HTMLElement>(): Ref<T> => {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.classList?.add("ripple");
    if (!IS_BROWSER || !ref.current) return;
    ref.current.addEventListener("click", (evt) => {
      const target = evt.currentTarget as HTMLElement;
      if (
        !target ||
        target.ariaDisabled ||
        (target as HTMLButtonElement).disabled
      )
        return;
      const effect = document.createElement("span");
      effect.id = "_effect";
      effect.classList.add("effect");
      const diameter = Math.max(target.clientWidth, target.clientHeight);
      const radius = diameter / 2;
      effect.style.width = effect.style.height = `${diameter}px`;
      effect.style.left = `${(evt as ClickEvent).offsetX - (target.clientLeft + radius)}px`;
      effect.style.top = `${(evt as ClickEvent).offsetY - (target.clientTop + radius)}px`;
      const e = target.getElementsByClassName("_effect")[0];
      if (e) e.remove();
      target.append(effect);
      setTimeout(() => {
        effect.remove();
      }, 1000);
    });
  }, []);
  return ref;
};
