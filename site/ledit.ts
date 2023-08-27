import "./ledit-bundle.css";
import { Settings, applySettings, bookmarkToHash, getSettings, resetSettings, saveSettings } from "./sources/settings";
import { Page } from "./sources/data";
import "./sources/guards";
// @ts-ignore
import { elements, navigate, onVisibleOnce, setLinkTargetsToBlank } from "./utils";
// @ts-ignore
import { html, render } from "lit-html";
// @ts-ignore
import { map } from "lit-html/directives/map.js";
// @ts-ignore
import { when } from "lit-html/directives/when.js";
// import { MastodonSource } from "./sources/mastodon";
import { PageIdentifier, SortingOption, Source, SourcePrefix } from "./sources/data";
import {
   dom,
   getFeedFromHash,
   getSourcePrefixFromHash,
   numOverlays,
   renderContentLoader,
   renderErrorMessage,
   renderHeaderButton,
   renderInfoMessage,
   renderOverlay
} from "./sources/utils";
// @ts-ignore
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { HackerNewsSource, renderHnPost } from "./sources/hackernews";
import { RedditSource, renderRedditPost } from "./sources/reddit";
import { RssSource, renderRssPost } from "./sources/rss";
import { YoutubeSource, renderYoutubePost } from "./sources/youtube";
// @ts-ignore
import settingsIcon from "remixicon/icons/System/settings-2-line.svg";
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
   const template = (settings: Settings) =>
      html`
      <div class="settings flex flex-col text-lg gap-4 mt-4 px-2 m-auto w-[300px]">
         <div class="text-xl font-bold">View options</div>
         <div x-id="theme" class="cursor-pointer flex items-center">
            <span>Theme</span>
            <i class="icon ml-auto">${settings.theme == "dark" ? unsafeHTML(moonIcon) : unsafeHTML(sunIcon)}</i>
         </div>
         <div x-id="collapseSeen" class="cursor-pointer flex items-center">
            <span>Collapse seen posts</span>
            <i class="icon ml-auto ${settings.collapseSeenPosts ? "fill-primary" : "fill-primary/50"}">${unsafeHTML(checkmarkIcon)}</i>
         </div>
         <div class="text-xl font-bold">About</div>
         <a href="https://github.com/badlogic/ledit#usage">How does this work?</a>
         <a href="https://github.com/badlogic/ledit" class="flex items-center gap-2"><i class="icon w-[2em] h-[2em]">${unsafeHTML(githubIcon)}</i> GitHub</a>
         <a href="https://github.com/sponsors/badlogic" class="flex items-center gap-2"><i class="icon">${unsafeHTML(heartIcon)}</i> Buy me a coffee</a>
         <div x-id="reset" class="cursor-pointer">Reset to defaults</div>
      </div>
      `;

   const settings = getSettings();
   const overlay = renderOverlay("Settings");
   render(template(settings), overlay);

   const { theme, collapseSeen, reset } = elements<{theme: HTMLElement, collapseSeen: HTMLElement, reset: HTMLElement }>(overlay);
   theme.addEventListener("click", () => {
      settings.theme = settings.theme == "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", settings.theme);
      saveSettings();
      render(template(settings), overlay);
   })

   collapseSeen.addEventListener("click", () => {
      settings.collapseSeenPosts = !settings.collapseSeenPosts;
      saveSettings();
      render(template(settings), overlay);
   })

   reset.addEventListener("click", () => {
      resetSettings();
      render(template(settings), overlay);
   })
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
         //source = new MastodonSource(hash);
         //break;
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

   window.addEventListener("hashchange", (event) => {
      if (appPages.some((page) => event.oldURL.length > 0 && page.hash == new URL(event.oldURL).hash)) return;
      const page = appPages.find((page) => page.hash == location.hash);
      if (page) {
         page.render();
         return;
      }
      if (numOverlays == 0 && feed != getFeedFromHash()) {
         console.log("Reloading due to hash change: " + feed + " -> " + getFeedFromHash());
         location.reload();
      }
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
