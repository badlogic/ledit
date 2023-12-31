import { LitElement, html } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { escapeGuard, navigationGuard } from "./guards";
import { closeIcon } from "./icons";
import { globalStyles } from "./styles";
import { appPages } from "./apppages";

export let numOverlays = 0;

@customElement("ledit-overlay")
export class Overlay extends LitElement {
   static styles = globalStyles;

   @property()
   headerTitle?: string;

   @query("#overlay")
   overlay?: HTMLElement;

   @query("#container")
   container!: HTMLElement;

   @property()
   closeCallback = () => {};

   @property()
   modal = false;

   @property()
   closeOnClick = true;

   readonly navCallback;
   readonly escapeCallback;
   closed = false;

   constructor() {
      super();
      this.navCallback = navigationGuard.register(() => this.close());
      this.escapeCallback = escapeGuard.register(() => this.close());
      this.style.zIndex = (100 + numOverlays++).toString();
      this.style.position = "relative";
      console.log("Opening overlay " + (numOverlays - 1));
   }

   connectedCallback(): void {
      super.connectedCallback();
      window.dispatchEvent(new Event("overlay-opened"));
   }

   disconnectedCallback(): void {
      super.disconnectedCallback();
      window.dispatchEvent(new Event("overlay-closed"));
   }

   render() {
      window.document.body.style.overflow = "hidden";
      return html`
         <div id="overlay" class="fixed top-0 w-full h-full overflow-auto m-auto bg-background" @mousedown=${this.overlayClicked}>
            <div class="${this.headerTitle ? "sticky" : ""} top-0 w-full max-w-[640px] mx-auto z-[10]">
               <div class="cursor-pointer py-2 pl-2 pr-1 flex items-center text-lg bg-background border-b border-border/50" @click=${this.close.bind(this)}>
                  <span class="font-bold text-primary text-ellipsis overflow-hidden flex-1">${this.headerTitle ?? ""}</span>
                  <header-button>${closeIcon}</header-button>
               </div>
            </div>
            <div id="container" class="w-full flex flex-col max-w-[640px] mx-auto pb-4 overflow-auto">
               <slot name="content" @slotchange=${this.slotChanged.bind(this)}></slot>
            </div>
         </div>
      `;
   }

   slotChanged(event: Event) {
      if (!this.modal) return;
      const slot = event.target as HTMLSlotElement;
      for (const slotElement of Array.from(slot.assignedElements())) {
         for (const link of Array.from((slotElement as HTMLElement).querySelectorAll("a") ?? [])) {
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
               this.close();
            });
         }
      }
   }

   close() {
      if (this.closed) return;
      this.closed = true;
      --numOverlays;
      console.log("Closing overlay " + numOverlays);
      window.document.body.style.overflow = "";
      navigationGuard.remove(this.navCallback);
      escapeGuard.remove(this.escapeCallback);
      this.closeCallback();
   }

   overlayClicked(event: Event) {
      if (!this.closeOnClick) return;
      if (document.activeElement && (document.activeElement.tagName == "INPUT" || document.activeElement.tagName == "TEXTAREA")) {
         return;
      }
      if (event.target != this.overlay) return;
      console.log("Clicked on overlay");
      event.preventDefault();
      event.stopPropagation();
      this.close();
   }
}
