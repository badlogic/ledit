import { SourcePrefix } from "./data";
import { MastodonUserInfo } from "./mastodon";
import { svgCheck, svgGithub, svgHeart } from "./svg/index";
import { dom } from "./utils";
import { OverlayView, View } from "./view";

export interface Bookmark {
   source: SourcePrefix;
   label: string;
   ids: string[];
   isDefault: boolean;
   supplemental?: MastodonUserInfo;
}

export interface Settings {
   bookmarks: Bookmark[];
   hideSeen: boolean;
   seenIds: string[];
   theme: string;
   collapseSeenPosts: boolean;
   showOnlyMastodonRoots: boolean;
}

let settings: Settings | null = null;

export function bookmarkToHash(bookmark: Bookmark) {
   return bookmark.source + bookmark.ids.join("+");
}

let defaultSettings: Settings;
export function getSettings(): Settings {
   if (settings) return settings;
   defaultSettings = {
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
         {
            source: "rss/",
            label: "Tech News",
            ids: [
               "https://techcrunch.com/feed/",
               "https://www.theverge.com/rss/frontpage",
               "https://www.wired.com/feed/rss",
               "https://gizmodo.com/rss",
               "https://feeds.arstechnica.com/arstechnica/index",
            ],
            isDefault: false,
         },
      ],
      hideSeen: false,
      seenIds: [],
      theme: "light",
      collapseSeenPosts: false,
      showOnlyMastodonRoots: false,
   } as Settings;
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

export class SettingsView extends OverlayView {
   constructor() {
      super("Settings", true);
      this.renderContent();
   }

   renderContent() {
      const settings = getSettings();
      const settingsDom = dom(/*html*/`
         <div>
            <div class="overlay-header">Theme</div>
            <div x-id="themes"></div>
            <div class="overlay-header">View options</div>
            <div x-id="collapseSeen" class="overlay-row overlay-row-inset">
               <div>Collapse seen posts</div>
               <div class="box ${getSettings().collapseSeenPosts ? "fill-color" : "fill-color-dim"}">${svgCheck}</div>
            </div>
            <div x-id="showOnlyMastodonRoots" class="overlay-row overlay-row-inset">
               <div>Show Mastodon top-level posts only</div>
               <div class="box ${getSettings().showOnlyMastodonRoots ? "fill-color" : "fill-color-dim"}">${svgCheck}</div>
            </div>
            <div x-id="hideSeen" class="overlay-row overlay-row-inset">
               <span>Hide seen posts (experimental)</span>
            </div>
            <div class="overlay-header">About</div>

            <div class="overlay-row overlay-row-inset"><a href="https://github.com/badlogic/ledit#usage">How does this work?</a></div>
            <div class="overlay-row overlay-row-inset"><a href="https://github.com/badlogic/ledit" class="fill-color">${svgGithub} GitHub</a></div>
            <div class="overlay-row overlay-row-inset"><a href="https://github.com/sponsors/badlogic" class="fill-color">${svgHeart} Buy me a coffee</a></div>
            <div x-id="reset" class="overlay-row">Reset to defaults</div>
         </div>
        `)[0];

      this.content.innerHTML = "";
      this.content.append(settingsDom);

      const elements = View.elements<{
         container: Element;
         close: Element;
         bookmarks: Element;
         hideSeen: Element;
         themes: Element;
         collapseSeen: Element;
         showOnlyMastodonRoots: Element;
         reset: Element;
      }>(settingsDom);

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
         <div class="overlay-row overlay-row-inset">
           <div>${theme}</div><div class="checkmark box fill-color hidden">${svgCheck}</div>
         </div>`)[0];
         if (settings.theme.toLowerCase() == theme.toLowerCase()) {
            themeDiv.querySelector(".checkmark")?.classList.remove("hidden");
         }
         themeDiv.addEventListener("click", (event) => {
            event.stopPropagation();
            document.body.classList.remove("dark-theme");
            document.body.classList.remove("light-theme");
            document.body.classList.add(theme.toLowerCase() + "-theme");
            settings.theme = theme;
            saveSettings();
            this.renderContent();
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
         this.renderContent();
      });

      // Show Mastodon roots only toggle
      elements.showOnlyMastodonRoots.addEventListener("click", (event) => {
         event.stopPropagation();
         getSettings().showOnlyMastodonRoots = !getSettings().showOnlyMastodonRoots;
         saveSettings();
         this.renderContent();
         window.location.reload();
      });

      // Reset to defaults
      elements.reset.addEventListener("click", (event) => {
         if (confirm("Are you sure you want to reset your bookmark list and settings?")) {
            event.stopPropagation();
            resetSettings();
            this.renderContent();
         }
      });
   }
}
customElements.define("ledit-settings", SettingsView);