import { getSource } from "./data";
import "./header.css";
import { SettingsView, bookmarkToHash, getSettings, saveSettings } from "./settings";
import { svgBurger, svgPlus } from "./svg/index";
import { dom, navigate } from "./utils";
import { View } from "./view";

export class HeaderView extends View {
   constructor() {
      super();
      this.render();
   }

   render() {
      const source = getSource();
      const hash = source.getSourcePrefix() + source.getFeed();
      const bookmark = getSettings().bookmarks.find((bookmark) => bookmarkToHash(bookmark) == hash);
      this.innerHTML = /*html*/ `
      <div class="header-container">
         <div class="header">
            <div x-id="showMenu" class="header-menu color-fill no-user-select" style="padding-left: var(--ledit-padding);">${svgBurger}</div>
            <div x-id="feed" class="header-feed">${bookmark ? bookmark.source + bookmark.label : hash}</div>
            <input x-id="feedInput" class="header-feed-input hidden" value="${source.getSourcePrefix()} + ${source.getFeed()}"/>
            <select x-id="sorting" class="header-sorting" tabindex="-1" style="padding-right: var(--ledit-margin);">
            </select>
            <span x-id="addBookmark" class="header-bookmark-add color-fill" style="padding-right: var(--ledit-padding);">${svgPlus}</span>
         </div>
      </div>
        `;

      const elements = this.elements<{
         showMenu: Element;
         feed: Element;
         feedInput: HTMLInputElement;
         sorting: HTMLSelectElement;
         addBookmark: Element;
      }>();

      // Show settings if menu button is clicked.
      elements.showMenu.addEventListener("click", () => {
         document.body.append(new SettingsView());
      });

      // Feed input. If label is clicked, hide it and unhide input.
      elements.feed.addEventListener("click", () => {
         elements.feed.classList.add("hidden");
         elements.feedInput.classList.remove("hidden");
         elements.feedInput.value = source.getSourcePrefix() + source.getFeed();
         elements.feedInput.select();
         elements.feedInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "Go" || event.keyCode === 13) {
               navigate(elements.feedInput.value);
            }
         });

         // Switch back to label if the user aborted by unfocusing the input field.
         elements.feedInput.addEventListener("blur", () => {
            elements.feed.classList.remove("hidden");
            elements.feedInput.classList.add("hidden");
         });
      });

      // Setup sorting
      for (const sortingOption of source.getSortingOptions()) {
         elements.sorting.append(dom(`<option value="${sortingOption.value}">${sortingOption.label}</option>`)[0]);
      }
      elements.sorting.value = source.getSorting();
      elements.sorting.addEventListener("change", () => {
         const hash = source.getSourcePrefix() + source.getFeed();
        navigate(hash + (hash.endsWith("/") ? "" : "/") + elements.sorting.value);
      });

      // Add bookmark button. Either hide it if the feed is already in the
      // settings, or add click listener to add the feed to the settings as a bookmark.
      const settings = getSettings();
      if (settings.bookmarks.some((bookmark) => bookmarkToHash(bookmark) == source.getSourcePrefix() + source.getFeed())) {
         elements.addBookmark.classList.add("hidden");
      } else {
         elements.addBookmark.addEventListener("click", (event) => {
            event.stopPropagation();
            settings.bookmarks.push({
               source: source.getSourcePrefix(),
               label: source.getFeed(),
               ids: source.getFeed().split("+"),
               isDefault: false
            });
            saveSettings();
            this.render();
         });
      }
   }
}
customElements.define("ledit-header", HeaderView);
