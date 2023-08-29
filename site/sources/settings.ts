import { SourcePrefix } from "./data";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { html, render } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { dom, makeOverlayModal, renderOverlay, sourcePrefixToFeedLabel, sourcePrefixToLabel } from "./utils";
import { assertNever, elements, makeChildrenDraggable, navigate } from "../utils";

// @ts-ignore
import checkmarkIcon from "remixicon/icons/System/check-line.svg";
// @ts-ignore
import githubIcon from "remixicon/icons/Logos/github-line.svg";
// @ts-ignore
import heartIcon from "remixicon/icons/Health & Medical/heart-line.svg";
// @ts-ignore
import sunIcon from "remixicon/icons/Weather/sun-line.svg";
// @ts-ignore
import moonIcon from "remixicon/icons/Weather/moon-line.svg";
// @ts-ignore
import rssIcon from "remixicon/icons/Device/rss-line.svg";
// @ts-ignore
import youtubeIcon from "remixicon/icons/Logos/youtube-line.svg";
// @ts-ignore
import redditIcon from "remixicon/icons/Logos/reddit-line.svg";
// @ts-ignore
import mastodonIcon from "remixicon/icons/Logos/mastodon-fill.svg";
// @ts-ignore
import hackernewsIcon from "../svg/hackernews.svg";
// @ts-ignore
import closeIcon from "remixicon/icons/System/close-circle-line.svg";
// @ts-ignore
import editIcon from "remixicon/icons/Design/edit-line.svg";

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
   return settings!;
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

function getIconForSource(source: SourcePrefix) {
   switch (source) {
      case "r/":
         return redditIcon;
      case "hn/":
         return hackernewsIcon;
      case "rss/":
         return rssIcon;
      case "yt/":
         return youtubeIcon;
      case "m/":
         return mastodonIcon;
      default:
         assertNever(source);
   }
}

export function renderSettings() {
   const template = (settings: Settings) =>
      html`
         <div class="settings flex flex-col text-lg gap-4 mt-4 px-4">
            <div class="text-xl font-bold border-b border-border">View options</div>
            <div x-id="theme" class="cursor-pointer flex items-center">
               <span>Theme</span>
               <i class="icon ml-auto w-[1.2em] h-[1.2em]">${settings.theme == "dark" ? unsafeHTML(moonIcon) : unsafeHTML(sunIcon)}</i>
            </div>
            <div x-id="collapseSeen" class="cursor-pointer flex items-center">
               <span>Collapse seen posts</span>
               <i class="icon ml-auto w-[1.2em] h-[1.2em] ${settings.collapseSeenPosts ? "fill-primary" : "fill-primary/50"}"
                  >${unsafeHTML(checkmarkIcon)}</i
               >
            </div>
            <div class="text-xl font-bold border-b border-border">About</div>
            <a href="https://github.com/badlogic/ledit#usage">How does this work?</a>
            <a href="https://github.com/badlogic/ledit" class="flex items-center gap-2"
               ><i class="icon w-[1.2em] h-[1.2em]">${unsafeHTML(githubIcon)}</i> GitHub</a
            >
            <a href="https://github.com/sponsors/badlogic" class="flex items-center gap-2"
               ><i class="icon w-[1.2em] h-[1.2em]">${unsafeHTML(heartIcon)}</i> Buy me a coffee</a
            >
            <div x-id="reset" class="cursor-pointer">Reset to defaults</div>
         </div>
      `;

   const settings = getSettings();
   const overlay = renderOverlay("Settings");
   render(template(settings), overlay.dom);

   const { theme, collapseSeen, reset } = elements<{ theme: HTMLElement; collapseSeen: HTMLElement; reset: HTMLElement }>(overlay.dom);
   theme.addEventListener("click", () => {
      settings.theme = settings.theme == "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", settings.theme);
      saveSettings();
      render(template(settings), overlay.dom);
   });

   collapseSeen.addEventListener("click", () => {
      settings.collapseSeenPosts = !settings.collapseSeenPosts;
      saveSettings();
      render(template(settings), overlay.dom);
   });

   reset.addEventListener("click", () => {
      resetSettings();
      render(template(settings), overlay.dom);
   });
}

export function renderBookmarks() {
   const template = (bookmarks: Bookmark[]) => html`
      <div>
         <a href="#bookmarks-select-source" class="flex items-center gap-4 px-4 h-[3em] border-b border-border/50">Add bookmark</a>
         <a href="#bookmarks-add-mastodon-account" class="flex items-center gap-4 px-4 h-[3em] border-b border-border/50">Add Mastodon account</a>
         <div class="bookmarks">
            ${map(
               bookmarks,
               (bookmark, index) => html`
                  <div class="bookmark flex items-center gap-4 px-4 border-b border-border/50 h-[3em]" data-index="${index.toString()}">
                     <i class="icon min-w-[1.5em] min-h-[1.5em]">${unsafeHTML(getIconForSource(bookmark.source))}</i>
                     <a href="#${bookmarkToHash(bookmark)}" class="overflow-hidden inline-block text-ellipsis flex-1 h-[3em] flex items-center"
                        >${bookmark.label}</a
                     >
                     <i
                        data-bookmark-label="${bookmark.label}"
                        class="default-button icon ml-auto block min-w-[1.5em] min-h-[1.5em] ${bookmark.isDefault
                           ? "fill-primary"
                           : "fill-primary/30"}"
                        >${unsafeHTML(checkmarkIcon)}</i
                     >
                     ${bookmark.source != "hn/"
                        ? bookmark.source == "m/" && bookmark.supplemental
                           ? html`<a href="#mastodon-edit-account/${bookmark.label}" class="ml-auto block"
                                   ><i class="icon min-w-[1.5em] min-h-[1.5em]">${unsafeHTML(editIcon)}</i></a
                                >
                                <i data-bookmark-label="${bookmark.label}" class="delete-button icon block min-w-[1.5em] min-h-[1.5em]"
                                   >${unsafeHTML(closeIcon)}</i
                                >`
                           : html`<a href="#bookmarks-edit/${bookmark.label}" class="ml-auto block"
                                   ><i class="icon min-w-[1.5em] min-h-[1.5em]">${unsafeHTML(editIcon)}</i></a
                                >
                                <i data-bookmark-label="${bookmark.label}" class="delete-button icon block min-w-[1.5em] min-h-[1.5em]"
                                   >${unsafeHTML(closeIcon)}</i
                                >`
                        : html`<i data-bookmark-label="${bookmark.label}" class="delete-button icon ml-auto block min-w-[1.5em] min-h-[1.5em]"
                             >${unsafeHTML(closeIcon)}</i
                          >`}
                  </div>
               `
            )}
         </div>
      </div>
   `;

   const bookmarks = getSettings().bookmarks;
   const overlay = renderOverlay("Bookmarks", []);
   render(template(bookmarks), overlay.dom);

   const bookmarksContainer = overlay.dom.querySelector(".bookmarks")! as HTMLElement;
   const rearrangeBookmarks = () => {
      const original = getSettings().bookmarks;
      const rearranged: Bookmark[] = [];
      bookmarksContainer.querySelectorAll(".bookmark").forEach((bookmarkDiv) => {
         const oldIndex = Number.parseInt(bookmarkDiv.getAttribute("data-index")!);
         rearranged.push(original[oldIndex]);
         bookmarkDiv.setAttribute("data-index", (rearranged.length - 1).toString());
      });
      return rearranged;
   };
   overlay.dom.querySelectorAll(".delete-button[data-bookmark-label]").forEach((deleteButton) => {
      const label = deleteButton.getAttribute("data-bookmark-label");
      if (!label) {
         alert("This should never happen");
         return;
      }
      const bookmark = getSettings().bookmarks.find((other) => other.label == label);
      if (!bookmark) {
         alert("This should never happen");
         return;
      }
      deleteButton.addEventListener("click", () => {
         if (confirm(`Do you really want to delete bookmark '${bookmark.label}'?`)) {
            deleteButton.parentElement?.remove();
            getSettings().bookmarks = rearrangeBookmarks();
            if (!getSettings().bookmarks.some((bookmark) => bookmark.isDefault) && getSettings().bookmarks.length > 0) {
               getSettings().bookmarks[0].isDefault = true;
            }
            saveSettings();
            overlay.dom.querySelectorAll(".default-button[data-bookmark-label]").forEach((other) => {
               other.classList.remove("fill-primary");
               other.classList.remove("fill-primary/30");
               other.classList.add(bookmark.isDefault ? "fill-primary" : "fill-primary/30");
            });
         }
      });
   });
   overlay.dom.querySelectorAll(".default-button[data-bookmark-label]").forEach((defaultButton) => {
      const label = defaultButton.getAttribute("data-bookmark-label");
      if (!label) {
         alert("This should never happen");
         return;
      }
      const bookmark = getSettings().bookmarks.find((other) => other.label == label);
      if (!bookmark) {
         alert("This should never happen");
         return;
      }
      defaultButton.addEventListener("click", () => {
         getSettings().bookmarks.forEach((bookmark) => (bookmark.isDefault = false));
         bookmark.isDefault = true;
         saveSettings();
         overlay.dom.querySelectorAll(".default-button[data-bookmark-label]").forEach((other) => {
            other.classList.remove("fill-primary");
            other.classList.remove("fill-primary/30");
            if (label == other.getAttribute("data-bookmark-label")) other.classList.add("fill-primary");
            else other.classList.add("fill-primary/30");
         });
      });
   });
   makeOverlayModal(overlay);

   makeChildrenDraggable(bookmarksContainer, () => {
      getSettings().bookmarks = rearrangeBookmarks();
      saveSettings();
   });
}

export function renderSourceSelector() {
   const sources = [
      { prefix: "r", label: "Reddit" },
      { prefix: "rss", label: "Rss" },
      { prefix: "yt", label: "YouTube" },
      { prefix: "m", label: "Mastodon" },
   ];

   const content = dom(html`<div class="bookmarks">
      ${map(
         sources,
         (source) =>
            html`<a href="#bookmarks-new/${source.prefix}" class="flex items-center gap-4 px-4 h-[3em] border-b border-border/50">${source.label}</a>`
      )}
   </div>`);
   const overlay = renderOverlay("Select source", content);
   makeOverlayModal(overlay);
}

export function renderBookmarkEditor(params: Record<string, string>) {
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
   const sourceLabel = sourcePrefixToLabel(bookmark.source);
   const placeholder = placeholderForSource(bookmark.source);

   const bookmarkEditorTemplate = (bookmark: Bookmark, errorLabel: string, errorIds: string, placeholder: string) => html`
      <div class="w-full flex flex-col gap-4 px-4 pt-4">
         <label class="font-bold">Label</label>
         <input x-id="label" placeholder="E.g. 'puppies', 'Tech news', ..." .value="${bookmark.label}" />
         ${errorLabel.length > 0 ? html`<div class="text-xs text-red-600">${errorLabel}</div>` : ""}
         <label class="font-bold">Feed</label>
         <textarea x-id="feed" class="h-[10em]" placeholder="${placeholder}" .value="${bookmark.ids.join("\n")}"></textarea>
         ${errorIds.length > 0 ? html`<div class="text-xs text-red-600">${errorIds}</div>` : ""}
         <button x-id="save" class="self-end">Save</button>
      </div>
   `;
   const overlay = renderOverlay(`New ${sourceLabel} bookmark`);
   render(bookmarkEditorTemplate(bookmark, "", "", placeholder), overlay.dom);
   makeOverlayModal(overlay);

   const { label, feed, save } = elements<{ label: HTMLInputElement; errorLabel: HTMLElement; feed: HTMLTextAreaElement; save: HTMLElement }>(
      overlay.dom
   );
   save.addEventListener("click", () => {
      const settings = getSettings();
      const labelValue = label.value.trim();
      if (labelValue.length == 0) {
         render(bookmarkEditorTemplate(bookmark, "Please specify a label", "", placeholder), overlay.dom);
         label.focus();
         return;
      }
      if (settings.bookmarks.find((bookmark) => bookmark.label == labelValue)) {
         render(bookmarkEditorTemplate(bookmark, `Bookmark with label '${labelValue}' already exists.`, "", placeholder), overlay.dom);
         label.focus();
         return;
      }

      const feedIdsValue = feed.value.trim();
      if (feedIdsValue.length == 0) {
         render(
            bookmarkEditorTemplate(
               bookmark,
               "",
               `Please specify one or more ${sourcePrefixToFeedLabel(bookmark.source)}, separated by commas or line breaks.`,
               placeholder
            ),
            overlay.dom
         );
         feed.focus();
         return;
      }
      const feedIds = feedIdsValue
         .split(/[,\n]+/)
         .filter((feedId) => feedId != undefined && feedId != null && feedId.trim().length != 0)
         .map((feedId) => feedId.trim());
      if (feedIds.length == 0) {
         render(
            bookmarkEditorTemplate(
               bookmark,
               "",
               `Please specify one or more ${sourcePrefixToFeedLabel(bookmark.source)}, separated by commas or line breaks.`,
               placeholder
            ),
            overlay.dom
         );
         feed.focus();
         return;
      }

      bookmark.label = labelValue;
      bookmark.ids = feedIds;

      // All good, save the bookmark and close.
      if (!settings.bookmarks.find((other) => other.label == bookmark.label)) {
         settings.bookmarks.push(bookmark);
      }
      saveSettings();
      const callback = () => {
         window.removeEventListener("hashchange", callback);
         navigate(bookmarkToHash(bookmark));
      };
      window.addEventListener("hashchange", callback);
      overlay.close();
   });
}