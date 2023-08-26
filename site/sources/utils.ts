// @ts-ignore
import { TemplateResult, html, render } from "lit-html";
import { elements, firstTextChild, intersectsViewport, isLink, scrollToAndCenter, waitForMediaLoaded } from "../utils";
import DOMPurify from "dompurify";
import { escapeGuard, navigationGuard } from "./guards";
import { Source, SourcePrefix } from "../data";

export function dom(template: TemplateResult, container?: HTMLElement | DocumentFragment): HTMLElement[] {
   if (container) {
      render(template, container);
      return [];
   }

   const div = document.createElement(`div`);
   render(template, div);
   const children: Element[] = [];
   for (let i = 0; i < div.children.length; i++) {
      children.push(div.children[i]);
   }
   return children as HTMLElement[];
}

export function safeHTML(unsafeHtml: string) {
   unsafeHtml = DOMPurify.sanitize(unsafeHtml, { ADD_ATTR: ["x-id"], ADD_TAGS: ["video-js", "iframe"] });
   const stringArray: any = [unsafeHtml];
   stringArray.raw = [unsafeHtml];
   return html(stringArray as TemplateStringsArray);
}

export function renderErrorMessage(message: string | TemplateResult, error?: Error) {
   let stack = error ? error.message + "\n" + error.stack : "";
   return dom(
      html`<div class="error m-auto p-4 w-full flex flex-col gap-4">
         <span class="m-auto">${message}</span>${error
            ? safeHTML(`<pre class="w-full overflow-auto rounded bg-surface-dim p-4"><code>${stack}</code></pre>`)
            : ""}
      </div>`
   );
}

export function renderInfoMessage(message: string | TemplateResult) {
   return dom(html`<div class="info w-full m-auto py-4">${message}</div>`);
}

export function renderContentLoader() {
   return dom(html`<div class="flex space-x-4 animate-pulse w-[80%] max-w-[300px] m-auto py-4">
      <div class="rounded-full bg-surface-dim h-10 w-10"></div>
      <div class="flex-1 space-y-6 py-1">
         <div class="h-2 bg-surface-dim rounded"></div>
         <div class="space-y-3">
            <div class="grid grid-cols-3 gap-4">
               <div class="h-2 bg-surface-dim rounded col-span-2"></div>
               <div class="h-2 bg-surface-dim rounded col-span-1"></div>
            </div>
            <div class="h-2 bg-surface-dim rounded"></div>
         </div>
      </div>
   </div>`)[0];
}

let overlayZIndex = 10;
export function renderOverlay(header: HTMLElement[], content: HTMLElement[], closeCallback = () => {}) {
   const overlay = dom(html` <div class="fixed top-0 w-full h-full overflow-auto bg-background">
      <div class="overlay m-auto backdrop-blur-[8px] flex flex-col" x-id="container"></div>
   </div>`)[0];
   overlay.style.zIndex = (++overlayZIndex).toString();

   const { container } = elements<{ container: HTMLElement }>(overlay);
   container.append(...header);
   container.append(...content);

   const navCallback = navigationGuard.register({
      hash: null,
      callback: () => {
         close();
         return true;
      },
   });

   const escapeCallback = escapeGuard.register(() => {
      close();
   });

   const close = () => {
      overlay.remove();
      document.body.style.overflow = "";
      navigationGuard.remove(navCallback);
      escapeGuard.remove(escapeCallback);
      closeCallback();
   };

   header.forEach((el) =>
      el.addEventListener("click", () => {
         close();
      })
   );

   document.body.append(overlay);
   document.body.style.overflow = "hidden";

   return overlay;
}

export function makeCollapsible(div: HTMLElement, maxHeightInLines: number) {
   maxHeightInLines = Math.max(4, maxHeightInLines);
   div.classList.add("force-hidden");
   const loader = renderContentLoader();
   div.parentElement?.append(loader);
   waitForMediaLoaded(div, () => {
      loader.remove();
      div.classList.remove("force-hidden");
      const computedStyles = getComputedStyle(document.documentElement);
      const fontSize = parseInt(computedStyles.getPropertyValue("--font-size"), 10);
      let maxHeight = fontSize * maxHeightInLines;
      if (div.querySelectorAll("img, video").length > 0) {
         const media = div.querySelector("img, video") as HTMLElement;
         let siblingHeight = 0;
         const textSibling = firstTextChild(div);
         if (textSibling) {
            if (textSibling.getBoundingClientRect().top < media.getBoundingClientRect().top) {
               maxHeight = fontSize * maxHeightInLines;
            } else {
               siblingHeight = textSibling.clientHeight;
            }
         }
         maxHeight = media.clientHeight + siblingHeight + fontSize * 2;
      }

      if (div.clientHeight < maxHeight) return;

      div.style.height = `${maxHeight}px`;
      div.style.overflow = "hidden";
      div.style.position = "relative";

      const more = dom(
         // prettier-ignore
         html`<div
            class="absolute w-full h-10 left-0 bottom-[-0.5em] flex items-center justify-center bg-surface font-bold text-primary cursor-pointer"
         >Show more</div>`
      )[0];
      div.append(more);
      more.addEventListener("click", (event) => {
         event.stopPropagation();
         event.preventDefault();
         div.style.height = "";
         more.remove();
      });
      div.addEventListener("click", (event) => {
         if (isLink(event.target as HTMLElement)) return;
         if (more.isConnected) {
            div.style.height = "";
            more.remove();
         } else {
            div.style.height = `${maxHeight}px`;
            div.append(more);
            requestAnimationFrame(() => {
               if (!intersectsViewport(more)) {
                  div.scrollIntoView({
                     behavior: "smooth",
                     block: "nearest",
                  });
               }
            });
         }
      });
   });
}

export function getSourcePrefixFromHash(): string | null {
   let hash = location.hash;
   if (hash.length == 0) {
      return null;
   }
   let slashIndex = hash.indexOf("/");
   if (slashIndex == -1) return null;
   return decodeURIComponent(hash.substring(1, slashIndex + 1));
}

export function getFeedFromHash(): string | null {
   const hash = location.hash;
   if (hash.length == 0) {
      return null;
   }
   const prefix = getSourcePrefixFromHash();
   if (!prefix) return null;
   const afterPrefix = hash.substring(prefix.length + 2);
   if (afterPrefix.includes("+")) return afterPrefix;

   const tokens = afterPrefix.split("/");
   if (tokens.length == 0) return null;
   return tokens[0];
}
