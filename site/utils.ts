import videojs from "video.js";
import { getSource } from "./data";
import { svgImages } from "./svg";

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

/**
 * Converts the HTML string to DOM nodes.
 */
export function dom(html: string): HTMLElement[] {
   const div = document.createElement("div");
   div.innerHTML = html;
   const children: Element[] = [];
   for (let i = 0; i < div.children.length; i++) {
      children.push(div.children[i]);
   }
   return children as HTMLElement[];
}

/** Navigate to the given feed. */
export function navigate(feed: string) {
   window.location.hash = feed;
   window.location.reload();
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

export function insertAfter(newNode: HTMLElement, referenceNode: HTMLElement) {
   referenceNode.parentNode?.insertBefore(newNode, referenceNode.nextSibling);
}

export function computedCssSizePx(variableName: string) {
   const computedStyles = getComputedStyle(document.documentElement);
   const variableValue = computedStyles.getPropertyValue(variableName);
   return parseInt(variableValue, 10);
}

export function makeCollapsible(div: HTMLElement, maxHeightInLines: number) {
   requestAnimationFrame(() => {
      const computedStyles = getComputedStyle(document.documentElement);
      const fontSize = parseInt(computedStyles.getPropertyValue("--ledit-font-size"), 10);

      const maxHeight = fontSize * maxHeightInLines;
      const clickableAreaHeight = fontSize * 2;

      if (div.clientHeight > maxHeight * 1.3) {
         div.style.height = `${maxHeight}px`;
         div.style.overflow = "hidden";
         div.style.marginBottom = "0";

         const showMoreDiv = dom(/*html*/ `
            <div class="show-more">Show more</div>
         `)[0];

         let collapsed = true;
         const loadMore = (event: MouseEvent) => {
            if ((event.target as HTMLElement).tagName != "A") {
               event.preventDefault();
               event.stopPropagation();

               if (collapsed) {
                  div.style.height = "auto";
                  showMoreDiv.style.display = "none";
               } else {
                  div.style.height = `${maxHeight}px`;
                  showMoreDiv.style.display = "";
                  if (div.getBoundingClientRect().top < 16 * 4) {
                     window.scrollTo({ top: div.getBoundingClientRect().top + window.pageYOffset - 16 * 3 });
                  }
               }
               collapsed = !collapsed;
            }
         };
         div.addEventListener("click", loadMore);
         showMoreDiv.addEventListener("click", loadMore);

         div.insertAdjacentElement("afterend", showMoreDiv);
      }
   });
}

export function removeTrailingEmptyParagraphs(htmlString: string): string {
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

export function assertNever(x: never) {
   throw new Error("Unexpected object: " + x);
}

export function proxyFetch(url: string) {
   const baseUrl = window.location.host.includes("localhost") ? "http://localhost:3000/proxy/?url=" : "https://marioslab.io/proxy/?url=";
   return fetch(baseUrl + encodeURI(url));
}

export function renderVideo(
   embed: { width: number; height: number; dash_url: string | null; hls_url: string | null; fallback_url: string },
   loop: boolean
): Element {
   let videoDom = dom(/*html*/ `<div style="display: flex; justify-content: center; background: #000; width: 100%">
     <video-js controls class="video-js" style="width: ${embed.width}px;" ${loop ? "loop" : ""} data-setup="{}">
         <source src="${embed.dash_url}">
         <source src="${embed.hls_url}">
         <source src="${embed.fallback_url}">
     </video-js>
   </div>`)[0];
   onAddedToDOM(videoDom, () => {
      const videoDiv = videoDom.querySelector("video-js")! as HTMLElement;
      let width = embed.width;
      let height = embed.height;
      let maxHeight = window.innerHeight * 0.7;
      const containerWidth = videoDom.parentElement!.clientWidth;
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

export function renderGallery(imageUrls: string[]): { gallery: Element; toggle: Element } {
   const galleryDom = dom(/*html*/ `
                           <div class="content-image-gallery">
                              ${imageUrls.map((img, index) => `<img src="${img}" ${index > 0 ? 'class="hidden"' : ""}>`).join("")}
                           </div>
                        `)[0];
   const imageDoms = galleryDom.querySelectorAll("img");
   const imageClickListener = () => {
      let scrolled = false;
      imageDoms.forEach((img, index) => {
         if (index == 0) return;
         if (img.classList.contains("hidden")) {
            img.classList.remove("hidden");
         } else {
            img.classList.add("hidden");
            if (scrolled) return;
            scrolled = true;
            if (imageDoms[0].getBoundingClientRect().top < 16 * 4) {
               window.scrollTo({ top: imageDoms[0].getBoundingClientRect().top + window.pageYOffset - 16 * 3 });
            }
         }
      });
   };

   for (let i = 0; i < imageDoms.length; i++) {
      imageDoms[i].addEventListener("click", imageClickListener);
   }

   const toggle = dom(/*html*/ `
      <div class="post-button">
         <span class="color-fill">${svgImages}</span>
         <span>${imageUrls.length}</span>
      </div>
   `)[0];
   toggle.addEventListener("click", () => {
      imageClickListener();
   });
   return { gallery: galleryDom, toggle: toggle };
}

export function scrollToAndCenter(element: Element) {
   requestAnimationFrame(() => {
      const windowHeight = window.innerHeight;
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const elementHeight = rect.bottom - rect.top;
      const scrollToPosition = elementTop + elementHeight / 2 - windowHeight / 2;

      window.scrollTo({
         top: scrollToPosition,
         behavior: "smooth",
      });
   });
}

import Sortable from "sortablejs"

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
      onStart: () => {
         Array.from(container.children).forEach((el) => {
            el.classList.add("no-hover")
            el.addEventListener("contextmenu", preventContextMenu);
            Array.from(el.querySelectorAll("a")).forEach((el) => el.addEventListener("contextmenu", preventContextMenu));
         });
      },
      onEnd: () => {
         Array.from(container.children).forEach((el) => {
            el.classList.remove("no-hover")
            el.removeEventListener("contextmenu", preventContextMenu);
            el.addEventListener("contextmenu", preventContextMenu);
            Array.from(el.querySelectorAll("a")).forEach((el) => el.removeEventListener("contextmenu", preventContextMenu));
         });
         complete()
      }
   });
}