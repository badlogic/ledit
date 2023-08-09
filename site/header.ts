import "./header.css";
import { getSorting, getSubreddit } from "./reddit";
import { SettingsView, getSettings, saveSettings } from "./settings";
import { svgBurger, svgPlus } from "./svg/index";
import { navigate } from "./utils";
import { View } from "./view";

export class HeaderView extends View {
   constructor() {
      super();
      this.render();
   }
   render() {
      this.innerHTML = /*html*/ `
      <div class="header-container">
         <div class="header">
            <div x-id="showMenu" class="header-menu svg-icon no-user-select" style="padding-left: var(--ledit-padding);">${svgBurger}</div>
            <div x-id="subreddit" class="header-subreddit">r/${getSubreddit()}</div>
            <input x-id="subredditInput" class="header-subreddit-input hidden" value="${getSubreddit()}"/>
            <select x-id="sorting" class="header-sorting" tabindex="-1" style="padding-right: var(--ledit-margin);">
               <option value="hot">Hot</option>
               <option value="new">New</option>
               <option value="rising">Rising</option>
               <option value="top-today">Top today</option>
               <option value="top-week">Top week</option>
               <option value="top-month">Top month</option>
               <option value="top-year">Top year</option>
               <option value="top-alltime">Top all time</option>
            </select>
            <span x-id="addSubreddit" class="header-subreddit-add svg-icon" style="padding-right: var(--ledit-padding);">${svgPlus}</span>
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
      elements.subreddit.addEventListener("click", () => {
         elements.subreddit.classList.add("hidden");
         elements.subredditInput.classList.remove("hidden");
         elements.subredditInput.value = getSubreddit();
         elements.subredditInput.select();
         elements.subredditInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "Go" || event.keyCode === 13) {
               navigate(elements.subredditInput.value);
            }
         });

         // Switch back to label if the user aborted by unfocusing the input field.
         elements.subredditInput.addEventListener("blur", () => {
            elements.subreddit.classList.remove("hidden");
            elements.subredditInput.classList.add("hidden");
         });
      });

      // Setup sorting
      elements.sorting.value = getSorting();
      elements.sorting.addEventListener("change", () => {
        navigate(getSubreddit() + "/" + elements.sorting.value);
      });

      // Add subreddit button. Either hide it if the subreddit is already in the
      // settings, or add click listener to add the subreddit to the settings.
      const settings = getSettings();
      if (settings.subreddits.some((subreddit) => subreddit == getSubreddit())) {
         elements.addSubreddit.classList.add("hidden");
      } else {
         elements.addSubreddit.addEventListener("click", () => {
            settings.subreddits.push(getSubreddit());
            saveSettings();
            this.render();
         });
      }
   }
}
customElements.define("ledit-header", HeaderView);
