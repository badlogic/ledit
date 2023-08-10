import "./settings.css";
import { svgCheck, svgClose, svgGithub, svgHeart, svgMinus } from "./svg/index";
import { dom, navigate } from "./utils";
import { View } from "./view";

interface Settings {
   subreddits: string[];
   hideSeen: boolean,
   seenIds: string[];
   theme: string;
   defaultSubreddit: string
}

let settings: Settings | null = null;
export const defaultMix = "AdviceAnimals+AskReddit+askscience+assholedesign+aww+battlestations+bestof+BetterEveryLoop+blackmagicfuckery+boardgames+BuyItForLife+Damnthatsinteresting+dataisbeautiful+DesignDesign+DIY+diyelectronics+DrugNerds+europe+explainlikeimfive+facepalm+fatFIRE+fightporn+Fitness+funny+Futurology+gadgets+gaming+GifRecipes+gifs+GiftIdeas+history+homeautomation+Hue+IAmA+IllegalLifeProTips+INEEEEDIT+instant_regret+interestingasfuck+InternetIsBeautiful+Jokes+JusticeServed+kitchens+LifeProTips+maybemaybemaybe+mildlyinfuriating+mildlyinteresting+mildlyvagina+movies+news+NintendoSwitch+nottheonion+oddlysatisfying+OldSchoolCool+pcmasterrace+photoshopbattles+pics+PoliticalHumor+ProgrammerHumor+PublicFreakout+rarepuppers+recipes+rickandmorty+RoomPorn+running+science+Showerthoughts+slatestarcodex+space+spicy+technology+technologyconnections+television+therewasanattempt+todayilearned+UnethicalLifeProTips+Unexpected+UpliftingNews+videos+watchpeoplealmostdie+Wellthatsucks+Whatcouldgowrong+whitepeoplegifs+woahdude+worldnews+WTF"
export const defaultSettings = {
   subreddits: [defaultMix, "all", "pics", "videos", "worldnews", "science", "todayilearned"],
   hideSeen: false,
   seenIds: [],
   theme: "light",
   defaultSubreddit: defaultMix
};

export function getSettings(): Settings {
   if (settings) return settings;
   settings = JSON.parse(JSON.stringify(defaultSettings));

   if (localStorage.getItem("ledit")) {
      const stored = JSON.parse(localStorage.getItem("ledit")!);
      for (const key of Object.keys(stored)) {
         (settings as any)[key] = stored[key];
      }
   }
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

export function resetSettings() {
   settings = JSON.parse(JSON.stringify(defaultSettings));
   saveSettings();
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
                    <div x-id="close" class="settings-row-close"><span class="svg-icon color-fill">${svgClose}</span></div>
                    <div class="settings-row-header">Subreddits</div>
                    <div x-id="subreddits"></div>
                    <div x-id="hideSeen" class="settings-row">
                     <span style="flex: 1">Hide seen posts</span>
                    </div>
                    <div class="settings-row-header">Theme</div>
                    <div x-id="themes"></div>
                    <div class="settings-row-header">About</div>
                    <div class="settings-row"><a href="https://github.com/badlogic/ledit" class="svg-icon color-fill">${svgGithub} GitHub</a></div>
                    <div class="settings-row"><a href="https://github.com/sponsors/badlogic" class="svg-icon color-fill">${svgHeart} Buy me a coffee</a></div>
                    <div x-id="reset" class="settings-row">Reset to defaults</div>
                </div>
            </div>
        `;

      const elements = this.elements<{
         container: Element;
         close: Element;
         subreddits: Element;
         hideSeen: Element;
         themes: Element;
         reset: Element;
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
         const isDefault = settings.defaultSubreddit == subreddit;
         const subredditDiv = dom(/*html*/`
         <div class="settings-row">
             <a x-id="subreddit" href="#${subreddit}" style="flex: 1">${subreddit == defaultMix ? "Ledit Mix" : subreddit}</a>
             <div x-id="makeDefaultSubreddit" class="box">
               <span class="svg-icon ${isDefault ? "color-fill" : "color-dim-fill"}">${svgCheck}</span>
            </div>
            <div x-id="deleteSubreddit" class="box">
               <span class="svg-icon color-fill">${svgMinus}</span>
            </div>
         </div>
         `)[0];
         const subElements = View.elements<{
            subreddit: Element,
            makeDefaultSubreddit: Element,
            deleteSubreddit: Element
         }>(subredditDiv)
         subElements.subreddit.addEventListener("click", () => {
            navigate(subreddit);
         });
         subElements.makeDefaultSubreddit.addEventListener("click", (event) => {
            event.stopPropagation();
            if (subreddit == settings.defaultSubreddit) return;
            settings.defaultSubreddit = subreddit;
            saveSettings();
            this.render();
         });
         subElements.deleteSubreddit.addEventListener("click", (event) => {
            event.stopPropagation();
            settings.subreddits = settings.subreddits.filter((sub) => sub != subreddit);
            saveSettings();
            this.render();
         });
         elements.subreddits.append(subredditDiv);
      }

      // Setup show seen toggle
      elements.hideSeen.addEventListener("click", (event) => {
         event.stopPropagation();
         settings.hideSeen = true;
         saveSettings();
         window.location.reload();
      });

      // Populate themes
      for (const theme of ["Dark", "Light"]) {
         const themeDiv = dom(`
         <div class="settings-row">
           <span style="flex: 1">${theme}</span><span class="svg-icon color-fill hidden">${svgCheck}</span>
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

      // Reset to defaults
      elements.reset.addEventListener("click", (event) => {
         if (confirm("Are you sure you want to reset your subreddit list and settings?")) {
            event.stopPropagation();
            resetSettings();
            this.render();
         }
      })
   }

   close() {
      this.remove();
   }
}
customElements.define("ledit-settings", SettingsView);
