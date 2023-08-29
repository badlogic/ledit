import "./ledit-bundle.css";
import { applySettings, bookmarkToHash, getSettings, renderBookmarkEditor, renderBookmarks, renderSettings, renderSourceSelector } from "./sources/settings";
import { Page } from "./sources/data";
import "./sources/guards";
import { elements, navigate, onVisibleOnce, setLinkTargetsToBlank } from "./utils";
import { html } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { when } from "lit-html/directives/when.js";
import { PageIdentifier, SortingOption, Source, SourcePrefix } from "./sources/data";
import { dom, getFeedFromHash, numOverlays, renderContentLoader, renderErrorMessage, renderHeaderButton, renderInfoMessage, route } from "./sources/utils";
import { HackerNewsSource, renderHnPost } from "./sources/hackernews";
import { RedditSource, renderRedditPost } from "./sources/reddit";
import { RssSource, renderRssPost } from "./sources/rss";
import { YoutubeSource, renderYoutubePost } from "./sources/youtube";
import { MastodonSource, renderMastodonAccountEditor, renderMastodonPost } from "./sources/mastodon";
// @ts-ignore
import settingsIcon from "remixicon/icons/System/settings-2-line.svg";
// @ts-ignore
import bookmarkIcon from "remixicon/icons/Business/bookmark-line.svg";
// @ts-ignore
import addIcon from "remixicon/icons/System/add-circle-line.svg";

export const appPages = [
   route("#settings", renderSettings),
   route("#bookmarks", renderBookmarks),
   route("#bookmarks-select-source", renderSourceSelector),
   route("#bookmarks-new/:source", renderBookmarkEditor),
   route("#bookmarks-new/:source/:feed", renderBookmarkEditor),
   route("#bookmarks-edit/:id", renderBookmarkEditor),
   route("#bookmarks-add-mastodon-account", renderMastodonAccountEditor),
   route("#mastodon-edit-account/:id", renderMastodonAccountEditor),
];

export function renderHeader(hash: string, sortingOptions: SortingOption[]) {
   const hashSource = hash.substring(0, hash.indexOf("/") + 1);
   const hashFeed = decodeURIComponent(hash.substring(hash.indexOf("/") + 1));
   const bookmark = getSettings().bookmarks.find((bookmark) => bookmark.source == hashSource && bookmark.ids.join("+") == hashFeed);

   const header = dom(html`
      <header class="header">
         ${renderHeaderButton(settingsIcon, "", "#settings")}
         <input
            x-id="feed"
            enterkeyhint="enter"
            class="border-none outline-none text-ellipsis overflow-hidden font-bold text-primary focus:outline-none hover:bg-transparent hover:text-primary flex-1 p-0"
            .value="${bookmark ? bookmark.source + bookmark.label : hash}"
         />
         ${when(
            sortingOptions.length > 0,
            () =>
               html`<select x-id="sort" class="mx-2 text-right">
                  ${map(sortingOptions, (item) => html`<option value=${item.value}>${item.label}</option>`)}
               </select>`,
            () => html``
         )}
         ${bookmark ? "" : renderHeaderButton(addIcon, "", undefined, "addBookmark")} ${renderHeaderButton(bookmarkIcon, "", "#bookmarks")}
      </header>
   `)[0];

   const { feed, sort, addBookmark } = elements<{ feed: HTMLInputElement; sort?: HTMLSelectElement; addBookmark?: HTMLElement }>(header);

   feed.addEventListener("focus", () => {
      requestAnimationFrame(() => {
         feed.value = hash;
         feed.selectionStart = hash.indexOf("/") == -1 ? 0 : hash.indexOf("/") + 1;
         feed.selectionEnd = hash.length;
      });
   });

   feed.addEventListener("blur", () => {
      feed.value = bookmark ? bookmark.source + bookmark.label : hash;
   });

   feed.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Go" || event.keyCode === 13) {
         const tokens = feed.value.split("/");
         const hashSource = tokens[0] + "/";
         const hashFeed = tokens[1];
         const bookmark = getSettings().bookmarks.find((bookmark) => bookmark.source == hashSource && bookmark.ids.join("+") == hashFeed);
         navigate(bookmark ? bookmark.source + bookmark.ids.join("+") : feed.value);
      }
   });

   if (sort) {
      const tokens = hash.split("/");
      const lastFragment = tokens[tokens.length - 1];
      for (const option of Array.from(header.querySelectorAll("option"))) {
         if (option.value == lastFragment) option.selected = true;
      }
      sort.addEventListener("change", () => {
         const tokens = location.hash.split("/");
         if (tokens.length == 0) return;
         if (tokens.length == 1 || !sortingOptions.some((option) => option.value == tokens[tokens.length - 1])) {
            console.log("Reloading due to sort change.");
            location.hash = location.hash + (location.hash.endsWith("/") ? "" : "/") + sort.value;
            location.reload();
            return;
         } else {
            tokens.pop();
            console.log("Reloading due to sort change.");
            location.hash = tokens.join("/") + "/" + sort.value;
            location.reload();
            return;
         }
      });
   }

   if (addBookmark) {
      addBookmark.addEventListener("click", () => {
         const hashSource = feed.value.substring(0, feed.value.indexOf("/") + 1);
         const hashFeed = decodeURIComponent(feed.value.substring(feed.value.indexOf("/") + 1));
         location.hash = `#bookmarks-new/${hashSource}${encodeURIComponent(hashFeed)}`;
      });
   }

   return header;
}

function loadDefaultBookmark() {
   const defaultBookmark = getSettings().bookmarks.find((bookmark) => bookmark.isDefault == true);
   navigate(defaultBookmark ? bookmarkToHash(defaultBookmark) : "r/all");
}

async function main() {
   applySettings();
   const hash = location.hash.substring(1);

   if (location.hash.length == 0 || appPages.some((page) => page.test(location.hash))) {
      loadDefaultBookmark();
      return;
   }

   const tokens = hash.split("/");
   if (tokens.length == 1) {
      loadDefaultBookmark();
      return;
   }

   const sourcePrefix = (tokens[0] + "/") as SourcePrefix;
   const feed = getFeedFromHash();
   let source: Source<any> | null = null;

   switch (sourcePrefix) {
      case "r/":
         source = new RedditSource(hash);
         break;
      case "hn/":
         source = new HackerNewsSource(hash);
         break;
      case "rss/":
         source = new RssSource(hash);
         break;
      case "yt/":
         source = new YoutubeSource(hash);
         break;
      case "m/":
         source = new MastodonSource(hash);
         break;
      default:
         source = new RedditSource(hash);
         break;
   }

   const main = dom(html`<main class="flex flex-col"></main>`)[0];
   const header = renderHeader(hash, source.getSortingOptions());
   document.body.append(header);
   document.body.append(main);

   window.addEventListener("hashchange", (event) => {
      document.title = "Ledit - " + location.hash.substring(1);
      const page = appPages.find((page) => page.test(location.hash));
      if (page) {
         page.render(page.test(location.hash)!);
         return;
      }
      if (numOverlays == 0 && feed != getFeedFromHash()) {
         console.log("Reloading due to feed change: " + feed + " -> " + getFeedFromHash());
         location.reload();
      }
   });
   dispatchEvent(new HashChangeEvent("hashchange"));

   const bookmark = getSettings().bookmarks.find((bookmark) => bookmark.source == tokens[0] + "/" && bookmark.label == feed);
   if (bookmark) {
      location.hash = bookmark.source + bookmark.ids.join("+");
   }

   document.addEventListener("keydown", (event) => {
      if (event.key == "b" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
         const bookmarksView = document.body.querySelector(".bookmarks");
         if (bookmarksView) {
            bookmarksView.parentElement!.click();
         } else {
            location.href = "#bookmarks";
         }
      }
   });

   try {
      source.renderMain(main);
   } catch (e) {
      main.append(...renderErrorMessage(`Could not load '${hash}'`, e instanceof Error ? e : undefined));
   }
}

main();
