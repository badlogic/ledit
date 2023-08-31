import { LitElement, css, html } from "lit";
import { ifDefined } from "lit-html/directives/if-defined.js";
import { map } from "lit-html/directives/map.js";
import { when } from "lit-html/directives/when.js";
import { customElement, property, query } from "lit/decorators.js";
import { SortingOption } from "./data";
import { addIcon, bookmarkIcon, settingsIcon } from "./icons";
import { getSettings } from "./settings";
import { globalStyles } from "./styles";
import { navigate } from "./utils";

@customElement("header-button")
export class HeaderButton extends LitElement {
   static styles = globalStyles;

   @property()
   icon: string = "";

   @property()
   classes?: string;

   @property()
   href?: string;

   render() {
      if (this.href) {
         return html`<a href="${ifDefined(this.href)}" class="flex items-center justify-center min-w-8 max-w-8 w-8 min-h-8 max-h-8 h-8 ${this.classes ? this.classes : ""}"
            ><i class="icon w-[1.2em] h-[1.2em]"><slot></slot></i
         ></a>`;
      } else {
         return html`<div class="flex items-center justify-center min-w-8 max-w-8 w-8 min-h-8 max-h-8 h-8 ${this.classes ? this.classes : ""}">
            <i class="icon w-[1.2em] h-[1.2em]"><slot></slot></i>
         </div>`;
      }
   }
}

@customElement("ledit-header")
export class Header extends LitElement {
   static styles = [
      globalStyles,
      css`
         select {
            background: none;
            color: rgb(var(--primary));
            border: none;
            appearance: none;
            padding: 0;
            text-align: right;
            cursor: pointer;
            outline-style: none;
         }
      `,
   ];

   @property()
   hash: string = "";

   @property()
   sortingOptions: SortingOption[] = [];

   @query("#feed")
   feed?: HTMLInputElement;

   @query("#sort")
   sort?: HTMLInputElement;

   hashChangeListener = () => {
      this.hash = location.hash.substring(1);
   };

   constructor() {
      super();
      this.classList.add("sticky", "top-0", "z-[50]");
   }

   connectedCallback(): void {
      super.connectedCallback();
      window.addEventListener("hashchange", this.hashChangeListener);
   }

   disconnectedCallback(): void {
      super.disconnectedCallback();
      window.removeEventListener("hashchange", this.hashChangeListener);
   }

   render() {
      console.log("Rendering header");
      const bookmark = this.getBookmark();
      const tokens = this.hash.split("/");
      const lastFragment = tokens[tokens.length - 1];

      return html`<div class="w-full sm:max-w-[640px] mx-auto text-lg flex items-center gap-2 p-2 bg-background backdrop-blur-[8px] border-b border-border/50">
         <header-button href="#settings">${settingsIcon}</header-button>
         <input
            id="feed"
            class="border-none outline-none text-ellipsis overflow-hidden font-bold text-primary focus:outline-none hover:bg-transparent hover:text-primary flex-1 p-0"
            .value="${bookmark ? bookmark.source + bookmark.label : this.hash}"
            @focus="${this.feedFocused}"
            @blur="${this.feedBlurred}"
            @keyup="${this.feedKeydown}"
            enterkeyhint="enter"
         />
         ${when(
            this.sortingOptions.length > 0,
            () =>
               html`<select id="sort" @change="${this.sortChanged}">
                  ${map(this.sortingOptions, (item) => html`<option value=${item.value} ?selected=${item.value == lastFragment}>${item.label}</option>`)}
               </select>`,
            () => html``
         )}
         ${!bookmark ? html`<header-button @click=${this.addBookmark}>${addIcon}</header-button>` : ""}
         <header-button href="#bookmarks">${bookmarkIcon}</header-button>
      </div>`;
   }

   private getSource() {
      return this.hash.substring(0, this.hash.indexOf("/") + 1);
   }

   private getFeed() {
      return decodeURIComponent(this.hash.substring(this.hash.indexOf("/") + 1));
   }

   private getBookmark() {
      const hashSource = this.getSource();
      const hashFeed = this.getFeed();
      return getSettings().bookmarks.find((bookmark) => bookmark.source == hashSource && bookmark.ids.join("+") == hashFeed);
   }

   private feedFocused(event: Event) {
      const feed = this.feed;
      if (!feed) return;
      requestAnimationFrame(() => {
         feed.value = this.hash;
         feed.selectionStart = this.hash.indexOf("/") == -1 ? 0 : this.hash.indexOf("/") + 1;
         feed.selectionEnd = this.hash.length;
      });
   }

   private feedBlurred(event: Event) {
      const feed = this.feed;
      if (!feed) return;
      const bookmark = this.getBookmark();
      feed.value = bookmark ? bookmark.source + bookmark.label : this.hash;
   }

   private feedKeydown(event: KeyboardEvent) {
      const feed = this.feed;
      if (!feed) return;
      if (event.key === "Enter" || event.key === "Go" || event.keyCode === 13) {
         const tokens = feed.value.split("/");
         const hashSource = tokens[0] + "/";
         const hashFeed = tokens[1];
         const bookmark = getSettings().bookmarks.find((bookmark) => bookmark.source == hashSource && bookmark.ids.join("+") == hashFeed);
         navigate(bookmark ? bookmark.source + bookmark.ids.join("+") : feed.value);
      }
   }

   private addBookmark() {
      const feed = this.feed;
      if (!feed) return;
      const hashSource = feed.value.substring(0, feed.value.indexOf("/") + 1);
      const hashFeed = decodeURIComponent(feed.value.substring(feed.value.indexOf("/") + 1));
      location.hash = `#bookmarks-new/${hashSource}${encodeURIComponent(hashFeed)}`;
   }

   private sortChanged(event: Event) {
      const sort = this.sort;
      if (!sort) return;
      const tokens = location.hash.split("/");
      if (tokens.length == 0) return;
      if (tokens.length == 1 || !this.sortingOptions.some((option) => option.value == tokens[tokens.length - 1])) {
         console.log("Reloading due to sort change.");
         location.hash = location.hash + (location.hash.endsWith("/") ? "" : "/") + sort.value;
         location.reload();
         return;
      } else {
         tokens.pop();
         console.log("Reloading due to sort change.");
         location.hash = tokens.join("/") + "/" + sort.value;
         location.reload();
         return;
      }
   }
}
