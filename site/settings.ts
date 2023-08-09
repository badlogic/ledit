import "./settings.css";
import { svgCheck, svgCircle, svgClose, svgGithub, svgMinus } from "./svg/index";
import { dom, navigate } from "./utils";
import { View } from "./view";

interface Settings {
   subreddits: string[];
   theme: string;
}

let settings: Settings | null = null;

export function getSettings(): Settings {
   if (settings) return settings;
   settings = localStorage.getItem("ledit")
      ? JSON.parse(localStorage.getItem("ledit")!)
      : {
           subreddits: ["all", "pics", "videos", "worldnews", "science", "todayilearned"],
           theme: "light",
        };
   return settings!;
}

export function applySettings() {
   document.body.classList.remove("dark-theme");
document.body.classList.remove("light-theme");
document.body.classList.add(getSettings().theme.toLowerCase() + "-theme");
}

export function saveSettings() {
   localStorage.setItem("ledit", JSON.stringify(getSettings()));
}

export class SettingsView extends View {
   constructor() {
      super();
      this.render();
   }

   render() {
      const settings = getSettings();
      this.innerHTML = /*html*/ `
            <div x-id="container" class="settings-container">
                <div class="settings">
                    <div x-id="close" class="settings-row-close"><span class="svg-icon">${svgClose}</span></div>
                    <div class="settings-row-header">Subreddits</div>
                    <div x-id="subreddits"></div>
                    <div class="settings-row-header">Theme</div>
                    <div x-id="themes"></div>
                    <div class="settings-row-header">About</div>
                    <div class="settings-row"><a href="https://github.com/badlogic/ledit" class="svg-icon">${svgGithub} GitHub</a></div>
                </div>
            </div>
        `;

      const elements = this.elements<{
         container: Element;
         close: Element;
         subreddits: Element;
         themes: Element;
      }>();

      // Dismiss when container is clicked
      elements.container.addEventListener("click", () => {
         this.close();
      });

      // Dimiss when close button is clicked
      elements.close.addEventListener("click", () => {
         this.close();
      });

      // Populate subreddits
      for (const subreddit of settings.subreddits) {
         const subredditDiv = dom(`
         <div class="settings-row">
             <a href="#${subreddit}" style="flex: 1">${subreddit}</a><span class="svg-icon">${svgMinus}</span>
         </div>
         `)[0];
         subredditDiv.querySelector("a")!.addEventListener("click", () => {
            navigate(subreddit);
         });
         subredditDiv.querySelector("span")!.addEventListener("click", (event) => {
            event.stopPropagation();
            settings.subreddits = settings.subreddits.filter((sub) => sub != subreddit);
            saveSettings();
            this.render();
         });
         elements.subreddits.append(subredditDiv);
      }

      // Populate themes
      for (const theme of ["Dark", "Light"]) {
         const themeDiv = dom(`
         <div class="settings-row">
           <span style="flex: 1">${theme}</span><span class="svg-icon hidden">${svgCheck}</span>
         </div>`)[0];
         if (settings.theme == theme) {
            themeDiv.querySelector(".svg-icon")?.classList.remove("hidden");
         }
         themeDiv.addEventListener("click", (event) => {
            event.stopPropagation();
            document.body.classList.remove("dark-theme");
            document.body.classList.remove("light-theme");
            document.body.classList.add(theme.toLowerCase() + "-theme");
            settings.theme = theme;
            saveSettings();
            this.render();
         });
         elements.themes.append(themeDiv);
      }
   }

   close() {
      this.remove();
   }
}
customElements.define("ledit-settings", SettingsView);
