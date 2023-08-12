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
      this.innerHTML = /*html*/ `
      <div class="header-container">
         <div class="header">
            <div x-id="showMenu" class="header-menu svg-icon color-fill no-user-select" style="padding-left: var(--ledit-padding);">${svgBurger}</div>
            <div x-id="sub" class="header-sub">${source.getSubPrefix() + source.getSub()}</div>
            <input x-id="subInput" class="header-sub-input hidden" value="${source.getSubPrefix()} + ${source.getSub()}"/>
            <select x-id="sorting" class="header-sorting" tabindex="-1" style="padding-right: var(--ledit-margin);">
            </select>
            <span x-id="addBookmark" class="header-bookmark-add svg-icon color-fill" style="padding-right: var(--ledit-padding);">${svgPlus}</span>
         </div>
      </div>
        `;

      const elements = this.elements<{
         showMenu: Element;
         sub: Element;
         subInput: HTMLInputElement;
         sorting: HTMLSelectElement;
         addBookmark: Element;
      }>();

      // Show settings if menu button is clicked.
      elements.showMenu.addEventListener("click", () => {
         document.body.append(new SettingsView());
      });

      // Sub input. If label is clicked, hide it and unhide input.
      elements.sub.addEventListener("click", () => {
         elements.sub.classList.add("hidden");
         elements.subInput.classList.remove("hidden");
         elements.subInput.value = source.getSubPrefix() + source.getSub();
         elements.subInput.select();
         elements.subInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "Go" || event.keyCode === 13) {
               navigate(elements.subInput.value);
            }
         });

         // Switch back to label if the user aborted by unfocusing the input field.
         elements.subInput.addEventListener("blur", () => {
            elements.sub.classList.remove("hidden");
            elements.subInput.classList.add("hidden");
         });
      });

      // Setup sorting
      for (const sortingOption of source.getSortingOptions()) {
         elements.sorting.append(dom(`<option value="${sortingOption.value}">${sortingOption.label}</option>`)[0]);
      }
      elements.sorting.value = source.getSorting();
      elements.sorting.addEventListener("change", () => {
         const hash = source.getSubPrefix() + source.getSub();
        navigate(hash + (hash.endsWith("/") ? "" : "/") + elements.sorting.value);
      });

      // Add bookmark button. Either hide it if the sub is already in the
      // settings, or add click listener to add the sub to the settings as a bookmark.
      const settings = getSettings();
      if (settings.bookmarks.some((bookmark) => bookmarkToHash(bookmark) == source.getSubPrefix() + source.getSub())) {
         elements.addBookmark.classList.add("hidden");
      } else {
         elements.addBookmark.addEventListener("click", (event) => {
            event.stopPropagation();
            settings.bookmarks.push({
               source: source.getSubPrefix(),
               label: source.getSub(),
               ids: [source.getSub()],
               isDefault: false
            });
            saveSettings();
            this.render();
         });
      }
   }
}
customElements.define("ledit-header", HeaderView);
