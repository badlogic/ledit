import { TemplateResult, html, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { map } from "lit-html/directives/map.js";
import { ifDefined } from "lit-html/directives/if-defined.js";
import {
   assertNever,
   elements,
   firstTextChild,
   htmlDecode,
   intersectsViewport,
   isLink,
   onAddedToDOM,
   onTapped,
   onVisibleOnce,
   setLinkTargetsToBlank,
   waitForMediaLoaded,
} from "../utils";
import DOMPurify from "dompurify";
import videojs from "video.js";
import { Page, PageIdentifier, SourcePrefix } from "./data";
import { escapeGuard, navigationGuard } from "./guards";
// @ts-ignore
import closeIcon from "remixicon/icons/System/close-circle-line.svg";
import { appPages } from "../ledit";

export type Route = { test: (hash: string) => Record<string, string> | null; render: (params: Record<string, string>) => void };

export function route(pattern: string, render: (params: Record<string, string>) => void): Route {
   return {
      test: (hash: string) => matchHashPattern(hash, pattern),
      render,
   };
}

function matchHashPattern(urlHash: string, pattern: string): Record<string, string> | null {
   const patternParts = pattern.split("/");
   const urlHashParts = urlHash.split("/");

   if (patternParts.length !== urlHashParts.length) {
      return null; // Number of path elements doesn't match
   }

   const params: Record<string, string> = {};

   for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const hashPart = urlHashParts[i];

      if (patternPart.startsWith(":")) {
         const paramName = patternPart.slice(1);
         params[paramName] = decodeURIComponent(hashPart);
      } else if (patternPart !== hashPart) {
         return null; // Path element doesn't match
      }
   }

   return params;
}

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

export let numOverlays = 0;
export function renderOverlay(header: HTMLElement[] | string, content: HTMLElement[] = [], closeCallback = () => {}): { dom: HTMLElement; close: () => void } {
   const overlay = dom(html` <div class="fixed top-0 w-full h-full overflow-auto bg-background">
      <div class="overlay m-auto backdrop-blur-[8px] flex flex-col" x-id="container"></div>
   </div>`)[0];
   overlay.style.zIndex = 1000 + (++numOverlays).toString();
   console.log("Opening overlay " + numOverlays);

   const { container } = elements<{ container: HTMLElement }>(overlay);
   if (typeof header === "string") {
      header = dom(html` <div class="header cursor-pointer">
         <span class="font-bold text-primary text-ellipsis overflow-hidden ml-2 flex-1">${header}</span>
         ${renderHeaderButton(closeIcon, "ml-auto")}
      </header>`);
   }
   container.append(...header);
   container.append(...content);

   const navCallback = navigationGuard.register(() => close());
   const escapeCallback = escapeGuard.register(() => close());

   container.addEventListener("click", (event) => {
      if (document.activeElement && (document.activeElement.tagName == "INPUT" || document.activeElement.tagName == "TEXTAREA")) {
         return;
      }
      if (event.target != container) return;
      event.preventDefault();
      event.stopPropagation();
      close();
   });

   overlay.addEventListener("click", (event) => {
      if (document.activeElement && (document.activeElement.tagName == "INPUT" || document.activeElement.tagName == "TEXTAREA")) {
         return;
      }
      if (event.target != overlay) return;
      event.preventDefault();
      event.stopPropagation();
      close();
   });

   let closed = false;
   const close = () => {
      if (closed) return;
      closed = true;
      --numOverlays;
      console.log("Closing overlay " + numOverlays);
      overlay.remove();
      document.body.style.overflow = "";
      navigationGuard.remove(navCallback);
      escapeGuard.remove(escapeCallback);
      closeCallback();
   };

   header.forEach((el) =>
      el.addEventListener("click", (event) => {
         event.preventDefault();
         event.stopPropagation();
         close();
      })
   );

   document.body.append(overlay);
   document.body.style.overflow = "hidden";

   return { dom: container, close };
}

export function makeOverlayModal(overlay: { dom: HTMLElement; close: () => void }) {
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
}

export function renderGallery(imageUrls: string[]): HTMLElement {
   const galleryDom = dom(html`
      <div class="flex flex-col gap-2">${imageUrls.map((img, index) => html`<img src="${htmlDecode(img)}" ${index > 0 ? 'class="hidden"' : ""}) />`)}</div>
   `)[0];
   const imageDoms = galleryDom.querySelectorAll("img");
   imageDoms.forEach((img, index) => {
      if (index == 0) return;
      img.classList.toggle("hidden");
   });
   const imageClickListener = () => {
      imageDoms.forEach((img, index) => {
         if (index == 0) return;
         img.classList.toggle("hidden");
      });
      if (imageDoms[1].classList.contains("hidden")) {
         imageDoms[0].scrollIntoView({
            behavior: "auto",
            block: "nearest",
         });
      }
   };

   for (let i = 0; i < imageDoms.length; i++) {
      imageDoms[i].addEventListener("click", imageClickListener);
   }
   return galleryDom;
}

export function renderVideo(videoDesc: { width: number; height: number; urls: string[] }, loop: boolean): HTMLElement {
   let videoDom = dom(html` <div class="flex justify-center w-full cursor-pointer bg-black">
      <video-js controls class="video-js" width=${videoDesc.width} ${loop ? "loop" : ""} data-setup="{}">
         ${map(videoDesc.urls, (url) => html`<source src="${htmlDecode(url)}" />`)}
      </video-js>
   </div>`)[0];
   onAddedToDOM(videoDom, () => {
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
            video.pause();
         }
      });
   });
   return videoDom;
}

export function renderPosts<T, D>(
   container: HTMLElement,
   page: Page<T> | Error,
   renderPost: (post: T, data?: D) => HTMLElement[],
   getNextPage: (nextPage: PageIdentifier) => Promise<Page<T> | Error>,
   data?: D
) {
   if (page instanceof Error) {
      container.append(...renderErrorMessage(`Could not load feed`, page));
      return;
   }

   const posts: HTMLElement[] = [];
   for (const post of page.items) {
      posts.push(...renderPost(post, data));
   }
   container.append(...posts);
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
            renderPosts(container, newPage, renderPost, getNextPage);
         }
      });
   } else {
      container.append(...renderInfoMessage("No more posts"));
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

export function getSourcePrefixFromHash(): string | null {
   let hash = location.hash;
   if (hash.length == 0) {
      return null;
   }
   let slashIndex = hash.indexOf("/");
   if (slashIndex == -1) return null;
   return decodeURIComponent(hash.substring(1, slashIndex + 1));
}

export function getFeedFromHash(): string {
   const hash = location.hash;
   if (hash.length == 0) {
      return "";
   }
   const prefix = getSourcePrefixFromHash();
   if (!prefix) return "";
   const afterPrefix = hash.substring(prefix.length + 1);
   if (afterPrefix.includes("+")) return afterPrefix;

   const tokens = afterPrefix.split("/");
   if (tokens.length == 0) return "";
   return decodeURIComponent(tokens[0]);
}

export function sourcePrefixToLabel(source: SourcePrefix | string) {
   if (typeof source == "string" && !source.endsWith("/")) source = source + "/";
   const src: SourcePrefix = source as SourcePrefix;
   switch (src) {
      case "r/":
         return "Reddit";
      case "hn/":
         return "Hackernews";
      case "rss/":
         return "RSS";
      case "yt/":
         return "YouTube";
      case "m/":
         return "Mastodon";
      default:
         assertNever(src);
   }
}

export function sourcePrefixToFeedLabel(source: SourcePrefix | string) {
   if (typeof source == "string" && !source.endsWith("/")) source = source + "/";
   const src: SourcePrefix = source as SourcePrefix;
   switch (src) {
      case "r/":
         return "Subreddits";
      case "hn/":
         return "Hackernews";
      case "rss/":
         return "RSS feeds";
      case "yt/":
         return "YouTube channels";
      case "m/":
         return "Mastodon accounts";
      default:
         assertNever(src);
   }
}
