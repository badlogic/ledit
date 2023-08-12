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
      return months + "m";
   }

   const years = Math.floor(timeDifference / (1000 * 60 * 60 * 24 * 365));
   return years + "y";
}

export function onVisibleOnce(target: Element, callback: () => void) {
   let callbackTriggered = false;

   const checkVisibility = () => {
      if (!callbackTriggered && intersectsViewport(target)) {
         callback();
         callbackTriggered = true;
         window.removeEventListener("scroll", checkVisibility);
      }
   };

   window.addEventListener("scroll", checkVisibility);
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

/** Navigate to the given sub. */
export function navigate(sub: string) {
   window.location.hash = sub;
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

export function limitElementHeight(div: HTMLElement, maxHeightInLines: number) {
   const computedStyles = getComputedStyle(document.documentElement);
   const fontSize = parseInt(computedStyles.getPropertyValue("--ledit-font-size"), 10);

   const maxHeight = fontSize * maxHeightInLines;
   const clickableAreaHeight = fontSize * 2;

   if (div.clientHeight > maxHeight) {
      div.style.height = `${maxHeight}px`;
      div.style.overflow = "hidden";

      const loadMoreDiv = document.createElement("div");
      loadMoreDiv.classList.add("load-more");
      loadMoreDiv.textContent = "Show more";
      loadMoreDiv.style.height = `${clickableAreaHeight}px`;

      const loadMore = () => {
         div.style.height = "auto";
         loadMoreDiv.style.display = "none";
      }
      div.addEventListener("click", loadMore)
      loadMoreDiv.addEventListener("click", loadMore);

      div.insertAdjacentElement("afterend", loadMoreDiv);
   }
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
