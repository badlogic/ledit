import Sortable from "sortablejs";
import { SourcePrefix } from "./data";

export function dateToText(utcTimestamp: number): string {
   const now = Date.now();
   const timeDifference = now - utcTimestamp;

   const seconds = Math.floor(timeDifference / 1000);
   if (seconds < 60) {
      return seconds + "s";
   }

   const minutes = Math.floor(timeDifference / (1000 * 60));
   if (minutes < 60) {
      return minutes + "m";
   }

   const hours = Math.floor(timeDifference / (1000 * 60 * 60));
   if (hours < 24) {
      return hours + "h";
   }

   const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
   if (days < 30) {
      return days + "d";
   }

   const months = Math.floor(timeDifference / (1000 * 60 * 60 * 24 * 30));
   if (months < 12) {
      return months + "mo";
   }

   const years = Math.floor(timeDifference / (1000 * 60 * 60 * 24 * 365));
   return years + "y";
}

export function onVisibleOnce(target: Element, callback: () => void) {
   let callbackTriggered = false;

   const observer = new IntersectionObserver(
      (entries) => {
         entries.forEach((entry) => {
            if (entry.isIntersecting) {
               callbackTriggered = true;
               callback();
               observer.unobserve(entry.target);
            }
         });
      },
      {
         root: null,
         rootMargin: "200px",
         threshold: 0.01,
      }
   );
   observer.observe(target);
}

export function onAddedToDOM(element: Element, callback: () => void) {
   const checkForInsertion = () => {
      if (element.isConnected) {
         callback();
      } else {
         requestAnimationFrame(checkForInsertion);
      }
   };
   checkForInsertion();
}

export function htmlDecode(input: string) {
   var doc = new DOMParser().parseFromString(input, "text/html");
   return doc.documentElement.textContent;
}

export function intersectsViewport(element: Element | null) {
   if (element == null) return false;
   var rect = element.getBoundingClientRect();
   var windowHeight = window.innerHeight || document.documentElement.clientHeight;
   var windowWidth = window.innerWidth || document.documentElement.clientWidth;
   var verticalVisible = rect.top <= windowHeight && rect.bottom >= 0;
   var horizontalVisible = rect.left <= windowWidth && rect.right >= 0;
   return verticalVisible && horizontalVisible;
}

export function navigate(hash: string) {
   console.log("navigating to " + hash);
   window.location.hash = hash;
   window.location.reload();
}

export function replaceLastHashFragment(newFragment: string) {
   const fragmentIndex = window.location.hash.lastIndexOf("/");
   if (fragmentIndex == -1) return "#" + newFragment;
   return window.location.hash.substring(fragmentIndex + 1) + newFragment;
}

export function addCommasToNumber(number: number) {
   return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function onTapped(element: HTMLElement, callback: () => void) {
   let touchStartY = 0;

   element.addEventListener("touchstart", (event) => {
      touchStartY = event.touches[0].clientY;
   });

   element.addEventListener("touchend", (event) => {
      if (Math.abs(event.changedTouches[0].clientY - touchStartY) < 16) {
         callback();
      }
   });
}

export function assertNever(x: never) {
   throw new Error("Unexpected object: " + x);
}

export function proxyFetch(url: string) {
   const baseUrl = window.location.host.includes("localhost") ? "http://localhost:3000/proxy/?url=" : "https://ledit.lol/proxy/?url=";
   return fetch(baseUrl + encodeURI(url));
}

export function scrollToAndCenter(element: Element) {
   requestAnimationFrame(() => {
      element.scrollIntoView({
         behavior: "smooth",
         block: "center",
      });
   });
}

export function makeChildrenDraggable(container: HTMLElement, complete: () => void) {
   const preventContextMenu = (event: any) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();
   };
   new Sortable(container, {
      chosenClass: "overlay-row-dragged",
      ghostClass: "overlay-row-dragged",
      delay: 300,
      delayOnTouchOnly: true,
      onStart: () => {
         Array.from(container.children).forEach((el) => {
            el.classList.add("no-hover");
            el.addEventListener("contextmenu", preventContextMenu);
            Array.from(el.querySelectorAll("a")).forEach((el) => el.addEventListener("contextmenu", preventContextMenu));
         });
      },
      onEnd: () => {
         Array.from(container.children).forEach((el) => {
            el.classList.remove("no-hover");
            el.removeEventListener("contextmenu", preventContextMenu);
            el.addEventListener("contextmenu", preventContextMenu);
            Array.from(el.querySelectorAll("a")).forEach((el) => el.removeEventListener("contextmenu", preventContextMenu));
         });
         complete();
      },
   });
}

export function setLinkTargetsToBlank(element: HTMLElement) {
   if (element instanceof HTMLAnchorElement) {
      element.setAttribute("target", "_blank");
   }
   let links = element.querySelectorAll("a")!;
   for (let i = 0; i < links.length; i++) {
      let link = links[i];
      if (link.hash.trim().length > 0 && new URL(link.href).host == location.host) continue;
      link.setAttribute("target", "_blank");
   }
}

export function elements<T>(view: HTMLElement): T {
   let elements: HTMLElement[] = [];
   view.querySelectorAll("[x-id]").forEach((el) => elements.push(el as HTMLElement));
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

// https://nucleoapp.com/tool/icon-transition
export function animateSvgIcon(i: HTMLElement) {
   if (i.classList.contains("js-nc-int-icon-loaded")) return i;
   i.classList.add("js-nc-int-icon-loaded");
   i.querySelector("svg")?.addEventListener("click", function (n) {
      (i.querySelector("svg")?.children[0] as any).classList.toggle("nc-int-icon-state-b");
   });
   return i;
}

export function firstTextChild(divElement: HTMLElement): HTMLElement | null {
   const firstNonWhitespaceSequence = divElement.innerText.trim().match(/\S+/);

   if (firstNonWhitespaceSequence) {
      const sequence = firstNonWhitespaceSequence[0];

      for (const child of Array.from(divElement.children) as HTMLElement[]) {
         if (child.innerText.includes(sequence)) {
            const childChild = firstTextChild(child);
            return childChild ? childChild : child;
         }

         const foundInChildren = firstTextChild(child);
         if (foundInChildren) {
            return foundInChildren;
         }
      }
   }

   return null;
}

export function waitForMediaLoaded(element: HTMLElement | ShadowRoot, callback: () => void): void {
   const mediaElements: HTMLMediaElement[] = Array.from(element.querySelectorAll("img, video"));
   let mediaLoaded = 0;
   let callbackCalled = false;
   const checkAllLoaded = () => {
      if (mediaLoaded == mediaElements.length) {
         if (!callbackCalled) {
            callbackCalled = true;
            callback();
         }
      }
   };

   mediaElements.forEach((el) => {
      const handleImageLoad = () => {
         mediaLoaded++;
         checkAllLoaded();
      };
      if ((el as any).complete || el.readyState === 4) {
         // Already loaded or errored
         handleImageLoad();
      } else {
         el.addEventListener("load", handleImageLoad);
         el.addEventListener("error", handleImageLoad);
      }
   });

   checkAllLoaded();
}

export function isLink(element: HTMLElement | Element | null) {
   if (element == null) return false;
   element = element as HTMLElement;
   if (element.tagName == "A") return true;
   let parent = element.parentElement;
   while (parent) {
      if (parent.tagName == "A") return true;
      parent = parent.parentElement;
   }
   return false;
}

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

export function getSourcePrefixFromHash(): string | null {
   let hash = location.hash;
   if (hash.length == 0) {
      return null;
   }
   let slashIndex = hash.indexOf("/");
   if (slashIndex == -1) return null;
   return decodeURIComponent(hash.substring(1, slashIndex + 1));
}

export function getFeedFromHash(hash?: string): string {
   if (!hash) hash = location.hash;
   if (hash.length == 0) {
      return "";
   }
   const prefix = getSourcePrefixFromHash();
   if (!prefix) return "";
   const afterPrefix = hash.substring(prefix.length + 1);
   if (afterPrefix.includes("+")) return afterPrefix;

   // if (prefix == "m/") return afterPrefix;
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

export function removeTrailingEmptyParagraphs(htmlString: string | null): string | null {
   if (htmlString == null) return null;
   const parser = new DOMParser();
   const parsedDoc = parser.parseFromString(htmlString, "text/html");

   const paragraphs = parsedDoc.querySelectorAll("p");
   let lastNonEmptyParagraphIndex = -1;

   // Find the index of the last non-empty paragraph
   for (let i = paragraphs.length - 1; i >= 0; i--) {
      const paragraphText = paragraphs[i].textContent?.trim() || "";
      if (paragraphText !== "") {
         lastNonEmptyParagraphIndex = i;
         break;
      }
   }

   if (lastNonEmptyParagraphIndex >= 0) {
      // Remove the empty paragraphs after the last non-empty paragraph
      for (let i = paragraphs.length - 1; i > lastNonEmptyParagraphIndex; i--) {
         paragraphs[i].parentNode?.removeChild(paragraphs[i]);
      }
   }

   return parsedDoc.body.innerHTML;
}
