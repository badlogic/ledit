import { html, nothing } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { assertNever, makeChildrenDraggable } from "../utils";
import { SourcePrefix } from "./data";
import { sourcePrefixToFeedLabel, sourcePrefixToLabel } from "./utils";

import { LitElement, PropertyValueMap } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { checkmarkIcon, closeIcon, editIcon, getIconForSource, githubIcon, heartIcon, moonIcon, sunIcon } from "./icons";
import { Overlay } from "./overlay";

export interface Bookmark {
   source: SourcePrefix;
   label: string;
   ids: string[];
   isDefault: boolean;
   supplemental?: any;
}

export interface Settings {
   bookmarks: Bookmark[];
   seenIds: string[];
   theme: string;
   collapseSeenPosts: boolean;
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
         { source: "hn/", label: "news", ids: [""], isDefault: false },
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
      seenIds: [],
      theme: "light",
      collapseSeenPosts: false,
   } as Settings;
   settings = JSON.parse(JSON.stringify(defaultSettings));

   if (localStorage.getItem("ledit")) {
      const stored = JSON.parse(localStorage.getItem("ledit")!);
      for (const key of Object.keys(stored)) {
         (settings as any)[key] = stored[key];
      }
   }
   return settings! as Settings;
}

export function applySettings() {
   document.body.classList.remove("dark-theme");
   document.body.classList.remove("light-theme");
   document.body.classList.add(getSettings().theme.toLowerCase() + "-theme");
   document.documentElement.setAttribute("data-theme", getSettings().theme.toLowerCase());
}

export function saveSettings() {
   localStorage.setItem("ledit", JSON.stringify(getSettings()));
}

export function resetSettings() {
   settings = JSON.parse(JSON.stringify(defaultSettings));
   saveSettings();
}

@customElement("ledit-settings")
export class SettingsView extends LitElement {
   static styles = Overlay.styles;

   @query("#overlay")
   overlay?: Overlay;

   @property({ attribute: false })
   settings = getSettings();

   render() {
      const self = this;
      return html`
         <ledit-overlay id="overlay" headerTitle="Settings" .closeCallback=${() => this.remove()}>
            <div slot="content" class="flex flex-col text-lg gap-4 px-4">
               <div class="text-lg font-bold border-b border-border">View options</div>
               <div class="cursor-pointer flex items-center" @click=${this.themeClicked}>
                  <span>Theme</span>
                  <i class="icon ml-auto mr-2 w-[1.2em] h-[1.2em]">${this.settings.theme == "dark" ? moonIcon : sunIcon}</i>
               </div>
               <div class="cursor-pointer flex items-center" @click=${this.collapseClicked}>
                  <span>Collapse seen posts</span>
                  <i class="icon ml-auto mr-2 w-[1.2em] h-[1.2em] ${this.settings.collapseSeenPosts ? "fill-primary" : "fill-primary/50"}">${checkmarkIcon}</i>
               </div>
               <div class="text-lg font-bold border-b border-border">About</div>
               <a href="https://github.com/badlogic/ledit#usage">How does this work?</a>
               <a href="https://github.com/badlogic/ledit" class="flex items-center gap-2"><i class="icon w-[1.2em] h-[1.2em]">${githubIcon}</i> GitHub</a>
               <a href="https://github.com/sponsors/badlogic" class="flex items-center gap-2"><i class="icon w-[1.2em] h-[1.2em]">${heartIcon}</i> Buy me a coffee</a>
               <div class="cursor-pointer" @click=${this.resetClicked}>Reset to defaults</div>
            </div>
         </ledit-overlay>
      `;
   }

   themeClicked() {
      this.settings = { ...this.settings, theme: (getSettings().theme = this.settings.theme == "dark" ? "light" : "dark") };
      document.documentElement.setAttribute("data-theme", this.settings.theme);
      saveSettings();
   }

   collapseClicked() {
      this.settings = { ...this.settings, collapseSeenPosts: (getSettings().collapseSeenPosts = !this.settings.collapseSeenPosts) };
      saveSettings();
   }

   resetClicked() {
      if (!confirm("Are you sure you want to reset your settings and delete all bookmarks?")) {
         return;
      }
      this.settings = { ...this.settings };
      resetSettings();
      this.overlay?.close();
   }
}

export function renderSettings() {
   document.body.append(new SettingsView());
}

@customElement("ledit-source-selector")
export class SourceSelector extends LitElement {
   static styles = Overlay.styles;

   render() {
      const sources = [
         { prefix: "r", label: "Reddit" },
         { prefix: "rss", label: "Rss" },
         { prefix: "yt", label: "YouTube" },
         { prefix: "m", label: "Mastodon" },
         { prefix: "hn", label: "Hackernews" },
      ];

      return html`<ledit-overlay headerTitle="Select source" .closeCallback=${() => this.remove()} .modal=${true}>
         <div slot="content" class="flex flex-col">
            ${map(sources, (source) => html`<a href="#bookmarks-new/${source.prefix}" class="flex items-center gap-4 px-4 h-[3em] border-b border-border/50">${source.label}</a>`)}
         </div>
      </ledit-overlay>`;
   }
}

export function renderSourceSelector() {
   document.body.append(new SourceSelector());
}

@customElement("ledit-bookmarks")
export class BookmarksView extends LitElement {
   static styles = Overlay.styles;

   @property()
   bookmarks: Bookmark[];

   @query("#bookmarks")
   bookmarksContainer?: HTMLElement;

   constructor() {
      super();
      this.bookmarks = getSettings().bookmarks;
   }

   render() {
      const bookmarks = this.bookmarks;
      return html`
         <ledit-overlay headerTitle="Bookmarks" .closeCallback=${() => this.remove()} .modal=${true}>
            <div slot="content">
               <a href="#bookmarks-select-source" class="flex items-center gap-4 px-4 h-[3em] border-b border-border/50">Add bookmark</a>
               <a href="#bookmarks-add-mastodon-account" class="flex items-center gap-4 px-4 h-[3em] border-b border-border/50">Add Mastodon account</a>
               <div id="bookmarks">
                  ${map(
                     bookmarks,
                     (bookmark, index) => html`
                        <div class="flex items-center gap-4 px-4 border-b border-border/50 h-[3em]" data-index="${index.toString()}">
                           <i class="icon min-w-[1.5em] min-h-[1.5em]">${getIconForSource(bookmark.source)}</i>
                           <a href="#${bookmarkToHash(bookmark)}" class="overflow-hidden inline-block text-ellipsis flex-1 h-[3em] flex items-center">${bookmark.label}</a>
                           <i class="icon ml-auto block min-w-[1.5em] min-h-[1.5em] ${bookmark.isDefault ? "fill-primary" : "fill-primary/30"}" @click=${() => this.defaultClicked(bookmark)}
                              >${checkmarkIcon}</i
                           >
                           ${bookmark.source == "m/" && bookmark.supplemental
                              ? html`<a href="#mastodon-edit-account/${bookmark.label}" class="ml-auto block"><i class="icon min-w-[1.5em] min-h-[1.5em]">${editIcon}</i></a>
                                   <i class="icon block min-w-[1.5em] min-h-[1.5em]" @click=${() => this.deleteClicked(bookmark)}>${closeIcon}</i>`
                              : html`<a href="#bookmarks-edit/${bookmark.label}" class="ml-auto block"><i class="icon min-w-[1.5em] min-h-[1.5em]">${editIcon}</i></a>
                                   <i class="icon block min-w-[1.5em] min-h-[1.5em]" @click=${() => this.deleteClicked(bookmark)}>${closeIcon}</i>`}
                        </div>
                     `
                  )}
               </div>
            </div>
         </ledit-overlay>
      `;
   }

   protected updated(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
      const bookmarksContainer = this.bookmarksContainer;
      if (!bookmarksContainer) return;
      makeChildrenDraggable(bookmarksContainer, () => {
         getSettings().bookmarks = this.rearrangeBookmarks() ?? getSettings().bookmarks;
         saveSettings();
         this.bookmarks = [...getSettings().bookmarks];
      });
   }

   rearrangeBookmarks() {
      const bookmarksContainer = this.bookmarksContainer;
      if (!bookmarksContainer) return;
      const original = getSettings().bookmarks;
      const rearranged: Bookmark[] = [];
      Array.from(bookmarksContainer.children).forEach((bookmarkDiv) => {
         const oldIndex = Number.parseInt(bookmarkDiv.getAttribute("data-index")!);
         rearranged.push(original[oldIndex]);
         bookmarkDiv.setAttribute("data-index", (rearranged.length - 1).toString());
      });
      return rearranged;
   }

   deleteClicked(bookmark: Bookmark) {
      if (!confirm(`Are you sure you want to delete bookmark '${bookmark.label}'`)) {
         return;
      }
      getSettings().bookmarks = getSettings().bookmarks.filter((other) => other.label != bookmark.label);
      if (this.bookmarks.length > 0 && !getSettings().bookmarks.some((bookmark) => bookmark.isDefault)) {
         getSettings().bookmarks[0].isDefault = true;
      }
      saveSettings();
      this.bookmarks = [...getSettings().bookmarks];
   }

   defaultClicked(bookmark: Bookmark) {
      getSettings().bookmarks.forEach((other) => (other.isDefault = other.label == bookmark.label));
      saveSettings();
      this.bookmarks = [...getSettings().bookmarks];
   }
}

export function renderBookmarks() {
   document.body.append(new BookmarksView());
}

@customElement("ledit-bookmark-editor")
export class BookmarkEditor extends LitElement {
   static styles = Overlay.styles;

   _bookmark?: Bookmark;

   set bookmark(value: Bookmark) {
      this._bookmark = value;
      this.label = value.label;
      this.ids = value.ids.join("\n");
   }

   get bookmark(): Bookmark | undefined {
      return this._bookmark;
   }

   @state()
   errorLabel = "";

   @state()
   errorIds = "";

   @state()
   label: string = "";

   @state()
   ids: string = "";

   @query("#overlay")
   overlay?: Overlay;

   render() {
      console.log("Rendering editor");
      const bookmark = this.bookmark;
      if (!bookmark) return nothing;

      const placeholderForSource = (source: SourcePrefix) => {
         switch (source) {
            case "r/":
               return "Comma or new line separated list of subreddit names, e.g.\n\npics\nvideos\nexplainlikeimfive";
            case "yt/":
               return "Comma or new line separated list of subreddit names, e.g.\n\nredlettermedia\nveritasium";
            case "rss/":
               return "Comma or new line separated list of RSS feed URLs, e.g.\n\nhttps://feeds.arstechnica.com/arstechnica/index\nhttps://www.wired.com/feed/rss";
            case "m/":
               return "Comma or new line separated list of instances and/or fully qualified Mastodon user names, e.g. \n\nmastodon.gamedev.place\nbadlogic@mastodon.gamedev.place";
            case "hn/":
               return "Comma or new line separated list of things.";
            default:
               assertNever(source);
               return "Comma or new line separated list of things.";
         }
      };

      const sourcePrefix = sourcePrefixToLabel(bookmark.source);
      const placeholder = placeholderForSource(bookmark.source);
      const isNew = bookmark.label.length == 0;

      return html`<ledit-overlay id="overlay" headerTitle="${isNew ? `New ${sourcePrefix} bookmark` : `Edit ${sourcePrefix} bookmark`}" .closeCallback=${() => this.remove()} .modal=${true}>
         <div slot="content" class="w-full flex flex-col gap-4 px-4 pt-4">
            <label class="font-bold">Label</label>
            <input @input=${this.labelChanged.bind(this)} placeholder="E.g. 'puppies', 'Tech news', ..." .value="${this.label}" />
            ${this.errorLabel.length > 0 ? html`<div class="text-xs text-red-600">${this.errorLabel}</div>` : ""}
            <label class="font-bold">Feed</label>
            <textarea @input=${this.idsChanged.bind(this)} class="h-[10em]" placeholder="${placeholder}" .value="${this.ids}"></textarea>
            ${this.errorIds.length > 0 ? html`<div class="text-xs text-red-600">${this.errorIds}</div>` : ""}
            <button @click=${this.saveClicked.bind(this)} class="self-end" ?disabled=${this.label.length == 0 || this.ids.length == 0}>Save</button>
         </div>
      </ledit-overlay>`;
   }

   labelChanged(event: InputEvent) {
      this.label = (event.target as HTMLInputElement).value.trim();
      if (this.label.length == 0) {
         this.errorLabel = "Please specify a label";
         return;
      }
      if (getSettings().bookmarks.find((bookmark) => bookmark.label == this.label)) {
         this.errorLabel = `A bookmark with label '${this.label}' already exists`;
         return;
      }
      this.errorLabel = "";
   }

   idsChanged(event: InputEvent) {
      this.ids = (event.target as HTMLTextAreaElement).value.trim();
      if (this.ids.length == 0) {
         this.errorIds = `Please specify one or more ${sourcePrefixToFeedLabel(this.bookmark?.source ?? "r/")}, separated by commas or line breaks.`;
         return;
      }

      const feedIds = this.ids
         .split(/[,\n]+/)
         .filter((feedId) => feedId != undefined && feedId != null && feedId.trim().length != 0)
         .map((feedId) => feedId.trim());
      if (feedIds.length == 0) {
         this.errorIds = `Please specify one or more ${sourcePrefixToFeedLabel(this.bookmark?.source ?? "r/")}, separated by commas or line breaks.`;
         return;
      }

      this.errorIds = "";
   }

   saveClicked() {
      if (!this.bookmark) return;
      if (this.bookmark.label.length == 0) {
         getSettings().bookmarks.push(this.bookmark);
      }
      this.bookmark.label = this.label;
      this.bookmark.ids = this.ids
         .split(/[,\n]+/)
         .filter((feedId) => feedId != undefined && feedId != null && feedId.trim().length != 0)
         .map((feedId) => feedId.trim());
      saveSettings();
      this.overlay?.close();
   }
}

export function renderBookmarkEditor(params: Record<string, string>) {
   const bookmark: Bookmark | undefined = params["source"]
      ? {
           source: (params["source"] + "/") as SourcePrefix,
           label: params["feed"] ?? "",
           ids: params["feed"] ? params["feed"].split("+") : [],
           isDefault: false,
        }
      : getSettings().bookmarks.find((bookmark) => bookmark.label == params["id"]);
   if (!bookmark) {
      alert(`Bookmark '${params["id"]}' doesn't exist`);
      return;
   }
   const editor = new BookmarkEditor();
   editor.bookmark = bookmark;
   document.body.append(editor);
   return;
}
