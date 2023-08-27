import "./guards";
import "./ledit-bundle.css";
import { applySettings, bookmarkToHash, getSettings, saveSettings } from "./settings";
import { Page, SortingOption, Source, SourcePrefix } from "./sources/data";
import { RssSource, renderRssPost } from "./sources/rss";
// @ts-ignore
import sunAndMoonIcon from "./svg/sun-moon.svg";
import { animateSvgIcon, elements, navigate, onVisibleOnce, setLinkTargetsToBlank } from "./utils";
// @ts-ignore
import { html } from "lit-html";
// @ts-ignore
import { map } from "lit-html/directives/map.js";
// @ts-ignore
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
// @ts-ignore
import { when } from "lit-html/directives/when.js";
import { HackerNewsSource, renderHnPost } from "./sources/hackernews";
// import { MastodonSource } from "./sources/mastodon";
import { PageIdentifier } from "./data";
import { MastodonSource } from "./sources/mastodon";
import { RedditSource, renderRedditPost } from "./sources/reddit";
import {
   dom,
   getFeedFromHash,
   getSourcePrefixFromHash,
   renderContentLoader,
   renderErrorMessage,
   renderHeaderButton,
   renderInfoMessage,
   renderOverlay,
} from "./sources/utils";
import { YoutubeSource, renderYoutubePost } from "./sources/youtube";
// @ts-ignore
import settingsIcon from "remixicon/icons/System/settings-2-line.svg";

export function renderPostPage<T>(
   container: HTMLElement,
   page: Page<T> | Error,
   renderPost: (post: T) => HTMLElement[],
   getNextPage: (nextPage: PageIdentifier) => Promise<Page<T> | Error>
) {
   if (page instanceof Error) {
      container.append(...renderErrorMessage(`Could not load feed`, page));
      return;
   }

   const posts: HTMLElement[] = [];
   for (const post of page.items) {
      posts.push(...renderPost(post));
   }
   container.append(...posts);
   setLinkTargetsToBlank(container);

   if (page.nextPage != "end") {
      const loader = renderContentLoader();
      container.append(loader);
      onVisibleOnce(loader, async () => {
         const newPage = await getNextPage(page.nextPage);
         loader.remove();
         if (newPage instanceof Error) {
            container.append(...renderErrorMessage("Could not load next page", newPage));
         } else {
            renderPostPage(container, newPage, renderPost, getNextPage);
         }
      });
   } else {
      container.append(...renderInfoMessage("No more posts"));
   }
}

export function renderSettings() {
   const settingsDom = renderOverlay("Settings", []);
}

export function renderBookmarks() {
   alert("Would render bookmarks");
}

export function renderHeader(hash: string, sortingOptions: SortingOption[], sorting: string) {
   const header = dom(html`
      <header class="header">
         <input
            x-id="feed"
            enterkeyhint="enter"
            class="outline-none font-bold text-primary text-ellipsis overflow-hidden bg-transparent flex-1"
            value="${hash}"
         />
         ${when(
            sortingOptions.length > 0,
            () =>
               html`<select x-id="sort" class="mx-2 text-right">
                  ${map(sortingOptions, (item) => html`<option value=${item.value}>${item.label}</option>`)}
               </select>`,
            () => html``
         )}
         ${renderHeaderButton(settingsIcon, "", "", "#settings")}
      </header>
   `)[0];

   const { feed, sort } = elements<{ feed: HTMLInputElement; sort?: HTMLSelectElement }>(header);

   feed.addEventListener("focus", () => {
      requestAnimationFrame(() => {
         feed.selectionStart = hash.indexOf("/") == -1 ? 0 : hash.indexOf("/") + 1;
         feed.selectionEnd = hash.length;
      });
   });

   feed.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === "Go" || event.keyCode === 13) {
         navigate(feed.value);
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
            location.hash = location.hash + (location.hash.endsWith("/") ? "" : "/") + sort.value;
            location.reload();
            return;
         } else {
            tokens.pop();
            location.hash = tokens.join("/") + "/" + sort.value;
            location.reload();
            return;
         }
      });
   }

   return header;
}

function loadDefaultBookmark() {
   const defaultBookmark = getSettings().bookmarks.find((bookmark) => bookmark.isDefault == true);
   navigate(defaultBookmark ? bookmarkToHash(defaultBookmark) : "r/all");
}

const appPages = [
   { hash: "#settings", render: renderSettings },
   { hash: "#bookmarks", render: renderBookmarks }
];

async function main() {
   applySettings();
   const hash = location.hash.substring(1);

   if (location.hash.length == 0 || appPages.some((page) => page.hash == location.hash)) {
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
   let renderPost: (post: any) => HTMLElement[] = (post) => {
      return [];
   };
   switch (sourcePrefix) {
      case "r/":
         source = new RedditSource(hash);
         renderPost = renderRedditPost;
         break;
      case "hn/":
         source = new HackerNewsSource(hash);
         renderPost = renderHnPost;
         break;
      case "rss/":
         source = new RssSource(hash);
         renderPost = renderRssPost;
         break;
      case "yt/":
         source = new YoutubeSource(hash);
         renderPost = renderYoutubePost;
         break;
      case "m/":
         source = new MastodonSource(hash);
         break;
      default:
         source = new RedditSource(hash);
         renderPost = renderRedditPost;
         break;
   }

   const main = dom(html`<main class="flex flex-col"></main>`)[0];
   const header = renderHeader(hash, source.getSortingOptions(), source.getSorting());
   const loader = renderContentLoader();
   document.body.append(header);
   document.body.append(main);
   main.append(loader);

   window.addEventListener("hashchange", () => {
      const page = appPages.find((page) => page.hash == location.hash);
      if (page) {
         page.render();
         return;
      }
      if (getSourcePrefixFromHash() != sourcePrefix) location.reload();
      if (sourcePrefix != "hn/" && feed != getFeedFromHash()) location.reload();
   });
   dispatchEvent(new HashChangeEvent("hashchange"));

   try {
      const postsPage = await source.getPosts(null);
      loader.remove();
      renderPostPage(main, postsPage, renderPost, (after: PageIdentifier) => {
         return source!.getPosts(after);
      });
   } catch (e) {
      loader.remove();
      main.append(...renderErrorMessage(`Could not load '${hash}'`, e instanceof Error ? e : undefined));
   }
}

main();
