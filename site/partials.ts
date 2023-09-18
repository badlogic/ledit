import DOMPurify from "dompurify";
import { TemplateResult, html, nothing, render } from "lit-html";
import { ifDefined } from "lit-html/directives/if-defined.js";
import { map } from "lit-html/directives/map.js";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import videojs from "video.js";
import { Page, PageIdentifier } from "./data";
import { firstTextChild, htmlDecode, intersectsViewport, isLink, onAddedToDom, onTapped, onVisibleOnce, setLinkTargetsToBlank, waitForMediaLoaded } from "./utils";
import { customElement, property, query } from "lit/decorators.js";
import { LitElement, PropertyValueMap } from "lit";
import { globalStyles } from "./styles";

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

export function safeHTML(uHtml: string | null): TemplateResult {
   if (!uHtml) uHtml = "";
   uHtml = DOMPurify.sanitize(uHtml, { ADD_ATTR: ["x-id"], ADD_TAGS: ["video-js", "iframe"] });
   const stringArray: any = [uHtml];
   stringArray.raw = [uHtml];
   return html(stringArray as TemplateStringsArray);
}

export function renderErrorMessage(message: string | TemplateResult, error?: Error) {
   let stack = error ? error.message + "\n" + error.stack : "";
   return dom(
      html`<div class="error m-auto p-4 w-full flex flex-col gap-4">
         <span class="m-auto">${message}</span>${error ? safeHTML(`<pre class="w-full overflow-auto rounded bg-surface-dim p-4"><code>${stack}</code></pre>`) : ""}
      </div>`
   );
}

export function renderInfoMessage(message: string | TemplateResult) {
   return dom(html`<div class="info w-full m-auto py-4 text-center">${message}</div>`);
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

export function renderHeaderButton(icon: string, classes?: string, href?: string, xId?: string): TemplateResult {
   if (href) {
      return html`<a x-id="${ifDefined(xId)}" href="${ifDefined(href)}" class="flex items-center justify-center min-w-8 max-w-8 w-8 min-h-8 max-h-8 h-8 ${classes ? classes : ""}"
         ><i class="icon w-[1.2em] h-[1.2em]">${unsafeHTML(icon)}</i></a
      >`;
   } else {
      return html`<div x-id="${ifDefined(xId)}" class="flex items-center justify-center min-w-8 max-w-8 w-8 min-h-8 max-h-8 h-8 ${classes ? classes : ""}">
         <i class="icon w-[1.2em] h-[1.2em]">${unsafeHTML(icon)}</i>
      </div>`;
   }
}

/*export function makeOverlayModal(overlay: { dom: HTMLElement; close: () => void }) {
   for (const link of Array.from(overlay.dom.querySelectorAll("a"))) {
      link.addEventListener("click", (event) => {
         event.preventDefault();
         event.stopPropagation();
         const callback = () => {
            window.removeEventListener("hashchange", callback);
            location.href = link.href;
            if (!appPages.some((page) => page.test(link.hash))) {
               console.log("Reloading due to modal.");
               location.reload();
            }
         };
         window.addEventListener("hashchange", callback);
         overlay.close();
      });
   }
}*/

@customElement("ledit-popup")
export class Popup extends LitElement {
   static styles = globalStyles;

   @property()
   buttonText = "Click me";

   @property()
   show = false;

   protected render(): TemplateResult {
      return html`<div class="relative">
         <div @click=${() => (this.show = !this.show)} class="rounded bg-background p-1 text-xs">${this.buttonText}</div>
         ${this.show ? html`<div @click=${() => (this.show = !this.show)} class="absolute bg-background p-4 rounded border border-border/50"><slot></slot></div>` : nothing}
      </div> `;
   }
}

export function renderGallery(imageUrls: string[], imageAlts?: string[], expandGallery = false): HTMLElement {
   const galleryDom = dom(html`
      <div class="flex flex-col gap-2">
         ${imageUrls.map(
            (img, index) => html`
               <div class="relative ${index && !expandGallery ? "hidden" : ""}">
                  <img src="${htmlDecode(img)}" ${imageAlts ? `alt="${imageAlts[index]}"` : ""}) />
                  ${imageAlts && imageAlts[index].length > 0
                     ? html`<ledit-popup buttonText="ALT" text="${imageAlts[index]}" class="absolute left-1 bottom-1 cursor-pointer">
                          <div class="w-[350px]">${imageAlts[index]}</div>
                       </ledit-popup>`
                     : nothing}
               </div>
            `
         )}
      </div>
   `)[0];
   if (imageAlts) {
      let i = 0;
      for (const child of Array.from(galleryDom.querySelectorAll("img"))) {
         const el = child as HTMLImageElement;
         if (el) el.alt = imageAlts[i++];
      }
   }
   const imageDoms = galleryDom.querySelectorAll("img");
   const imageClickListener = () => {
      imageDoms.forEach((img, index) => {
         if (index == 0) return;
         img.parentElement!.classList.toggle("hidden");
      });
      if (imageDoms[1].classList.contains("hidden")) {
         imageDoms[0].scrollIntoView({
            behavior: "auto",
            block: "nearest",
         });
      }
   };

   if (!expandGallery) {
      for (let i = 0; i < imageDoms.length; i++) {
         imageDoms[i].addEventListener("click", imageClickListener);
      }
   }
   return galleryDom;
}

export function renderVideo(videoDesc: { width: number; height: number; urls: string[] }, loop: boolean): HTMLElement {
   let videoDom = dom(html` <div class="flex justify-center w-full cursor-pointer bg-black">
      <video-js controls class="video-js" width=${videoDesc.width} ${loop ? "loop" : ""} data-setup="{}">
         ${map(videoDesc.urls, (url) => html`<source src="${htmlDecode(url)}" />`)}
      </video-js>
   </div>`)[0];
   onAddedToDom(videoDom, () => {
      const videoDiv = videoDom.querySelector("video-js")! as HTMLElement;
      let width = videoDesc.width;
      let height = videoDesc.height;
      let maxHeight = window.innerHeight * 0.7;
      const computed = getComputedStyle(videoDom.parentElement!);
      const containerWidth = Number.parseInt(computed.width) - Number.parseFloat(computed.paddingLeft) - Number.parseFloat(computed.paddingRight);
      if (width > containerWidth || width < containerWidth) {
         let aspect = height / width;
         width = containerWidth;
         height = aspect * width;
      }
      if (height > maxHeight) {
         let scale = maxHeight / height;
         height = maxHeight;
         width = width * scale;
      }
      videoDiv.style.width = width + "px";
      videoDiv.style.height = height + "px";

      const video = videojs(videoDiv);
      var videoElement = video.el().querySelector("video")!;
      (videoDiv as any).player = video;

      // Reset video element width/height so fullscreen works
      videoElement.style.width = "";
      videoElement.style.height = "";

      // Toggle pause/play on click
      const togglePlay = function () {
         if (video.paused()) {
            video.play();
         } else {
            video.pause();
         }
      };
      videoElement.addEventListener("clicked", togglePlay);
      onTapped(videoElement, togglePlay);

      // Pause when out of view
      document.addEventListener("scroll", () => {
         if (videoElement && videoElement === document.pictureInPictureElement) {
            return;
         }
         if (!video.paused() && !intersectsViewport(videoElement)) {
            /*if (videoDom.parentElement != document.body) {
               document.body.append(videoDom);
               videoDom.style.position = "absolute";
               videoDom.style.top = "0";
            }*/
            video.pause();
         }
      });

      // Pause when overlay is opened
      window.addEventListener("overlay-opened", () => {
         if (videoElement && videoElement === document.pictureInPictureElement) {
            return;
         }
         if (!video.paused()) {
            video.pause();
         }
      });
   });
   return videoDom;
}

export function renderList<T, D>(
   container: HTMLElement,
   page: Page<T> | Error,
   renderItem: (item: T, data?: D) => HTMLElement[],
   getNextPage: (nextPage: PageIdentifier) => Promise<Page<T> | Error>,
   data?: D
) {
   if (page instanceof Error) {
      container.append(...renderErrorMessage(`Could not load items`, page));
      return;
   }

   const items: HTMLElement[] = [];
   for (const item of page.items) {
      items.push(...renderItem(item, data));
   }
   container.append(...items);
   setLinkTargetsToBlank(container);

   if (page.nextPage != "end") {
      const loader = renderContentLoader();
      container.append(loader);
      onVisibleOnce(loader, async () => {
         const newPage = await getNextPage(page.nextPage);
         loader.remove();
         if (newPage instanceof Error) {
            container.append(...renderErrorMessage("Could not load next page", newPage));
         } else {
            renderList(container, newPage, renderItem, getNextPage, data);
         }
      });
   } else {
      container.append(...renderInfoMessage("No more items"));
   }
}

@customElement("ledit-item-list")
export class ItemList extends LitElement {
   static styles = globalStyles;

   @query("#list")
   items?: HTMLElement;

   _load?: () => void;

   load<T, D>(page: Page<T> | Error, renderItem: (item: T, data?: D) => HTMLElement[], getNextPage: (nextPage: PageIdentifier) => Promise<Page<T> | Error>, data?: D) {
      this._load = () => {
         this.items!.innerHTML = "";
         renderList(this.items!, page, renderItem, getNextPage, data);
      };
      this.requestUpdate();
   }

   protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
      if (this._load) {
         this._load();
         this._load = undefined;
      }
   }

   render() {
      return html`<div id="list" class="item-list">${renderContentLoader()}</div>`;
   }
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
