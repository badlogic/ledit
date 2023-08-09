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

/** Navigate to the given subreddit. */
export function navigate(subreddit: string) {
   window.location.hash = subreddit;
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