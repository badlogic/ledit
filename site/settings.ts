import { SourcePrefix } from "./data";
import "./settings.css";
import { svgCheck, svgClose, svgGithub, svgHeart, svgMinus } from "./svg/index";
import { dom, navigate } from "./utils";
import { View } from "./view";

interface Bookmark {
   source: SourcePrefix;
   label: string;
   ids: string[];
   isDefault: boolean;
}

interface Settings {
   bookmarks: Bookmark[];
   hideSeen: boolean;
   seenIds: string[];
   theme: string;
   collapseSeenPosts: boolean;
}

let settings: Settings | null = null;
export const defaultSettings = {
   bookmarks: [
      // prettier-ignore
      { source: "r/", label: "ledit_mix", ids: ["AdviceAnimals","AskReddit","askscience","assholedesign","aww","battlestations","bestof","BetterEveryLoop","blackmagicfuckery","boardgames","BuyItForLife","Damnthatsinteresting","dataisbeautiful","DesignDesign","DIY","diyelectronics","DrugNerds","europe","explainlikeimfive","facepalm","fatFIRE","fightporn","Fitness","funny","Futurology","gadgets","gaming","GifRecipes","gifs","GiftIdeas","history","homeautomation","Hue","IAmA","IllegalLifeProTips","INEEEEDIT","instant_regret","interestingasfuck","InternetIsBeautiful","Jokes","JusticeServed","kitchens","LifeProTips","maybemaybemaybe","mildlyinfuriating","mildlyinteresting","mildlyvagina","movies","news","NintendoSwitch","nottheonion","oddlysatisfying","OldSchoolCool","pcmasterrace","photoshopbattles","pics","PoliticalHumor","ProgrammerHumor","PublicFreakout","rarepuppers","recipes","rickandmorty","RoomPorn","running","science","Showerthoughts","slatestarcodex","space","spicy","technology","technologyconnections","television","therewasanattempt","todayilearned","UnethicalLifeProTips","Unexpected","UpliftingNews","videos","watchpeoplealmostdie","Wellthatsucks","Whatcouldgowrong","whitepeoplegifs","woahdude","worldnews","WTF"], isDefault: true},
      { source: "r/", label: "all", ids: ["all"], isDefault: false },
      { source: "r/", label: "pics", ids: ["pics"], isDefault: false },
      { source: "r/", label: "videos", ids: ["videos"], isDefault: false },
      { source: "r/", label: "worldnews", ids: ["worldnews"], isDefault: false },
      { source: "r/", label: "science", ids: ["science"], isDefault: false },
      { source: "r/", label: "todayilearned", ids: ["todayilearned"], isDefault: false },
      { source: "hn/", label: "hackernews", ids: [""], isDefault: false },
      { source: "rss/", label: "International News", ids: ["http://rss.cnn.com/rss/edition.rss", "http://feeds.bbci.co.uk/news/rss.xml", "https://www.lemonde.fr/en/rss/une.xml", "http://rss.dw.com/rdf/rss-en-all"], isDefault: false }
   ],
   hideSeen: false,
   seenIds: [],
   theme: "light",
   collapseSeenPosts: true,
} as Settings;

export function bookmarkToHash(bookmark: Bookmark) {
   return bookmark.source + bookmark.ids.join("+");
}

export function bookmarkToShortHash(bookmark: Bookmark) {
   return bookmark.ids.join("+");
}

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
                    <div class="settings-row-header">Bookmarks</div>
                    <div x-id="bookmarks"></div>
                    <div class="settings-row-header">Theme</div>
                    <div x-id="themes"></div>
                    <div x-id="collapseSeen" class="settings-row">
                     <div style="flex: 1">Collapse seen posts</div>
                     <div class="svg-icon box ${getSettings().collapseSeenPosts ? "color-fill" : "color-dim-fill"}">${svgCheck}</div>
                    </div>
                    <div x-id="hideSeen" class="settings-row">
                     <span style="flex: 1">Hide seen posts (experimental)</span>
                    </div>
                    <div class="settings-row-header">About</div>

                    <div class="settings-row"><a href="https://github.com/badlogic/ledit#usage">How does this work?</a></div>
                    <div class="settings-row"><a href="https://github.com/badlogic/ledit" class="svg-icon color-fill">${svgGithub} GitHub</a></div>
                    <div class="settings-row"><a href="https://github.com/sponsors/badlogic" class="svg-icon color-fill">${svgHeart} Buy me a coffee</a></div>
                    <div x-id="reset" class="settings-row">Reset to defaults</div>
                </div>
            </div>
        `;

      const elements = this.elements<{
         container: Element;
         close: Element;
         bookmarks: Element;
         hideSeen: Element;
         themes: Element;
         collapseSeen: Element;
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

      // Populate bookmarks
      const bySource = new Map<string, Bookmark[]>();
      for (const bookmark of settings.bookmarks) {
         let source = bySource.get(bookmark.source);
         if (!source) bySource.set(bookmark.source, (source = []));
         source.push(bookmark);
      }
      for (const source of bySource.keys()) {
         const sourceHeaderDiv = dom(`<div class="settings-row">${source}</div>`)[0];
         elements.bookmarks.append(sourceHeaderDiv);
         for (const bookmark of bySource.get(source)!) {
            const isDefault = bookmark.isDefault;
            const hash = bookmarkToHash(bookmark);
            const bookmarkDiv = dom(/*html*/ `
               <div class="settings-row" style="margin-left: var(--ledit-padding)">
                  <a x-id="feed" href="#${hash}" style="flex: 1">${bookmark.label}</a>
                  <div x-id="makeDefaultFeed" class="box">
                     <span class="svg-icon ${isDefault ? "color-fill" : "color-dim-fill"}">${svgCheck}</span>
                  </div>
                  <div x-id="deleteFeed" class="box">
                     <span class="svg-icon color-fill">${svgMinus}</span>
                  </div>
               </div>
            `)[0];
            const subElements = View.elements<{
               feed: Element;
               makeDefaultFeed: Element;
               deleteFeed: Element;
            }>(bookmarkDiv);
            subElements.feed.addEventListener("click", () => {
               navigate(hash);
            });
            subElements.makeDefaultFeed.addEventListener("click", (event) => {
               event.stopPropagation();
               if (isDefault) return;
               settings.bookmarks.forEach((bm) => { bm.isDefault = false });
               bookmark.isDefault = true;
               saveSettings();
               this.render();
            });
            subElements.deleteFeed.addEventListener("click", (event) => {
               event.stopPropagation();
               settings.bookmarks = settings.bookmarks.filter((bm) => bm != bookmark);
               saveSettings();
               this.render();
            });
            elements.bookmarks.append(bookmarkDiv);
         }
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
         const themeDiv = dom(/*html*/ `
         <div class="settings-row">
           <div style="flex: 1">${theme}</div><div class="svg-icon box color-fill hidden">${svgCheck}</div>
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

      // Collapse seen toggle
      elements.collapseSeen.addEventListener("click", (event) => {
         event.stopPropagation();
         getSettings().collapseSeenPosts = !getSettings().collapseSeenPosts;
         const collapse = getSettings().collapseSeenPosts;
         document.querySelectorAll(".post").forEach((el) => {
            if (collapse) el.classList.add("post-seen");
            else el.classList.remove("post-seen");
         });
         saveSettings();
         this.render();
      });

      // Reset to defaults
      elements.reset.addEventListener("click", (event) => {
         if (confirm("Are you sure you want to reset your bookmark list and settings?")) {
            event.stopPropagation();
            resetSettings();
            this.render();
         }
      });
   }

   close() {
      this.remove();
   }
}
customElements.define("ledit-settings", SettingsView);
