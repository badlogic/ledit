// @ts-ignore
import { Page, PageIdentifier } from "./data";
import { EscapeCallback, NavigationCallback, escapeGuard, navigationGuard } from "./guards";
import { svgClose, svgLoader } from "./svg";
import { dom, onVisibleOnce } from "./utils";
import "./view.css";

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
   static stackZIndex = 100;

   static nextStackZIndex() {
      const next = this.stackZIndex;
      this.stackZIndex += 100;
      return next;
   }

   constructor(title?: string | HTMLElement, public readonly zIndex = OverlayView.nextStackZIndex()) {
      super();
      this.classList.add("overlay-container");
      this.innerHTML = /*html*/ `
            <div class="overlay">
                <div x-id="close" class="overlay-close">
                  ${title && typeof title === "string" ? `<span class="overlay-header">${title}</span>` : ""}
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
      this.escapeCallback = escapeGuard.register(zIndex, () => {
         this.close();
      });

      // Close on back navigation
      this.navigationCallback = navigationGuard.register(zIndex, () => {
         this.close();
         return false;
      });

      // Prevent underlying posts from scrolling
      document.body.style.overflow = "hidden";
   }

   close() {
      this.remove();
      navigationGuard.remove(this.navigationCallback!);
      escapeGuard.remove(this.escapeCallback!);
      document.body.style.overflow = "";
      OverlayView.stackZIndex -= 100;
   }
}

export abstract class PagedListView<T> extends View {
   private nextPage: string | null = null;

   constructor(public readonly fetchPage: (nextPage: PageIdentifier) => Promise<Page<T> | Error>) {
      super();
      this.classList.add("paged-list-view");
      const outerLoadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.append(outerLoadingDiv);
      const fetchNextPage = async () => {
         const result = await fetchPage(this.nextPage);
         outerLoadingDiv.remove();
         if (result instanceof Error) {
            this.append(...dom(`<div class="post-loading">${result.message}</div>`));
            return;
         } else {
            await this.renderItems(result.items);
            requestAnimationFrame(() => {
               const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
               if (result.nextPage != "end") {
                  this.append(loadingDiv);
                  onVisibleOnce(loadingDiv, async () => {
                     await fetchNextPage();
                     loadingDiv.remove();
                  });
               } else {
                  this.append(...dom(`<div class="post-loading">Reached end of list.</div>`));
               }
            });
            this.nextPage = result.nextPage;
         }
      };
      fetchNextPage();
   }

   abstract renderItems(items: T[]): Promise<void>;
}
