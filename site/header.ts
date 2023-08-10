import { getSource } from "./data";
import "./header.css";
import { SettingsView, defaultMix, getSettings, saveSettings } from "./settings";
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
            <div x-id="subreddit" class="header-subreddit">${source.getSubPrefix()}${source.getSubPrefix() + source.getSub() == defaultMix ? "ledit_mix" : source.getSub()}</div>
            <input x-id="subredditInput" class="header-subreddit-input hidden" value="${source.getSub()}"/>
            <select x-id="sorting" class="header-sorting" tabindex="-1" style="padding-right: var(--ledit-margin);">
            </select>
            <span x-id="addSubreddit" class="header-subreddit-add svg-icon color-fill" style="padding-right: var(--ledit-padding);">${svgPlus}</span>
         </div>
      </div>
        `;

      const elements = this.elements<{
         showMenu: Element;
         subreddit: Element;
         subredditInput: HTMLInputElement;
         sorting: HTMLSelectElement;
         addSubreddit: Element;
      }>();

      // Show settings if menu button is clicked.
      elements.showMenu.addEventListener("click", () => {
         document.body.append(new SettingsView());
      });

      // Subreddit input. If label is clicked, hide it and unhide input.
      if (!source.isSingleSource()) {
         elements.subreddit.addEventListener("click", () => {
            elements.subreddit.classList.add("hidden");
            elements.subredditInput.classList.remove("hidden");
            elements.subredditInput.value = source.getSub();
            elements.subredditInput.select();
            elements.subredditInput.addEventListener("keydown", (event) => {
               if (event.key === "Enter" || event.key === "Go" || event.keyCode === 13) {
                  navigate(source.getSubPrefix() + elements.subredditInput.value);
               }
            });

            // Switch back to label if the user aborted by unfocusing the input field.
            elements.subredditInput.addEventListener("blur", () => {
               elements.subreddit.classList.remove("hidden");
               elements.subredditInput.classList.add("hidden");
            });
         });
      }

      // Setup sorting
      for (const sortingOption of source.getSortingOptions()) {
         elements.sorting.append(dom(`<option value="${sortingOption.value}">${sortingOption.label}</option>`)[0]);
      }
      elements.sorting.value = source.getSorting();
      elements.sorting.addEventListener("change", () => {
        navigate(source.getSubPrefix() + source.getSub() + "/" + elements.sorting.value);
      });

      // Add subreddit button. Either hide it if the subreddit is already in the
      // settings, or add click listener to add the subreddit to the settings.
      const settings = getSettings();
      if (settings.sub.some((subreddit) => subreddit == source.getSubPrefix() + source.getSub())) {
         elements.addSubreddit.classList.add("hidden");
      } else {
         elements.addSubreddit.addEventListener("click", () => {
            settings.sub.push(source.getSubPrefix() + source.getSub());
            saveSettings();
            this.render();
         });
      }
   }
}
customElements.define("ledit-header", HeaderView);
