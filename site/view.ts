// @ts-ignore
import "./view.css";
import { EscapeCallback, NavigationCallback, escapeGuard, navigationGuard } from "./guards";
import { svgClose } from "./svg";

export abstract class View extends HTMLElement {
   constructor() {
      super();
   }

   static elements<T>(view: HTMLElement): T {
      let elements: HTMLElement[] = [];
      view.querySelectorAll("[x-id]").forEach((el) => elements.push(el as HTMLElement));
      elements = elements.filter((el) => {
         let parent = el.parentElement;
         while (parent != view) {
            if (parent instanceof View) return false;
            parent = parent ? parent.parentElement : null;
         }
         return true;
      });
      const result = {};
      elements.forEach((element) => {
         // @ts-ignore
         if (result[element.getAttribute("x-id")]) {
            console.log(`View - Duplicate element x-id ${element.getAttribute("x-id")} in ${view.localName}`);
         }
         // @ts-ignore
         result[element.getAttribute("x-id")] = element;
      });
      return result as T;
   }

   elements<T>(): T {
      return View.elements(this);
   }
}

export abstract class OverlayView extends View {
   escapeCallback: EscapeCallback | undefined;
   navigationCallback: NavigationCallback | undefined;
   readonly content: HTMLElement;

   constructor(title: string | HTMLElement | undefined) {
      super();
      this.classList.add("overlay-container");
      this.innerHTML = /*html*/ `
            <div class="overlay">
                <div x-id="close" class="overlay-close">
                  ${title && typeof title === "string" ? `<span class="overlay-header">${title}</span>`: ""}
                  <span class="overlay-close-button color-fill">${svgClose}</span>
               </div>
                <div x-id="content" class="overlay-content"></div>
            </div>
        `;
      const elements = this.elements<{
         close: HTMLElement;
         content: HTMLElement;
      }>();
      this.content = elements.content;

      if (title instanceof HTMLElement) {
         elements.close.append(title);
      }

      // Close when container is clicked
      this.addEventListener("click", (event) => {
        if (event.target == this) {
            this.close();
        }
      });

      // Close when close button is clicked
      elements.close.addEventListener("click", () => {
         this.close();
      });

      // Close when escape is pressed
      this.escapeCallback = escapeGuard.register(1000, () => {
         this.close();
      });

      // Close on back navigation
      this.navigationCallback = navigationGuard.register(1000, () => {
         this.close();
         return false;
      });

      // Prevent underlying posts from scrolling
      document.body.style.overflow = "hidden";
   }

   abstract renderContent(): void;

   close() {
      this.remove();
      navigationGuard.remove(this.navigationCallback!);
      escapeGuard.remove(this.escapeCallback!);
      document.body.style.overflow = "";
   }
}
