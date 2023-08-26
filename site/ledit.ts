import { Page, SortingOption, Source, SourcePrefix } from "./sources/data";
import "./guards";
import "./ledit-bundle.css";
import { applySettings, bookmarkToHash, getSettings } from "./settings";
import { RssSource, renderRssPost } from "./sources/rss";
// @ts-ignore
import sunAndMoonSvg from "./svg/sun-moon.svg";
import { animateSvgIcon, elements, navigate, onVisibleOnce, replaceLastHashFragment, setLinkTargetsToBlank } from "./utils";
// @ts-ignore
import { html } from "lit-html";
// @ts-ignore
import { map } from "lit-html/directives/map.js";
// @ts-ignore
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
// @ts-ignore
import { when } from "lit-html/directives/when.js";
import { HackerNewsSource, renderHnPost } from "./sources/hackernews";
import { MastodonSource } from "./sources/mastodon";
import { RedditSource } from "./sources/reddit";
import { YoutubeSource } from "./sources/youtube";
import { contentLoader, dom, getFeedFromHash, getSourcePrefixFromHash } from "./sources/utils";
import { PageIdentifier } from "./data";

export function renderPostPage<T>(container: HTMLElement, page: Page<T> | Error, renderPost: (post: T) => HTMLElement[], getNextPage: (nextPage: PageIdentifier) => Promise<Page<T> | Error>) {
   if (page instanceof Error) {
      container.append(...dom(html`<div>Could not load feed: ${page.message}</div>`));
      return;
   }

   const posts: HTMLElement[] = [];
   for (const post of page.items) {
      posts.push(...renderPost(post));
   }
   container.append(...posts);
   setLinkTargetsToBlank(container);

   if (page.nextPage != "end") {
      const loader = dom(contentLoader)[0];
      container.append(loader);
      onVisibleOnce(loader, async () => {
         const newPage = await getNextPage(page.nextPage);
         loader.remove();
         if (newPage instanceof Error) {
            container.append(dom(html`<div>Could not load posts: ${newPage.message}</div>`)[0]);
         } else {
            renderPostPage(container, newPage, renderPost, getNextPage);
         }
      });
   } else {
      container.append(dom(html`<div>No more posts<div>`)[0]);
   }
}

export function list<T>(strings: string[]) {}

export function renderHeader(hash: string, sortingOptions: SortingOption[], sorting: string) {
   const header = dom(html`
      <header class="header">
         <input x-id="feed" class="outline-none font-bold text-primary text-ellipsis overflow-hidden bg-transparent flex-1" value="${hash}" />
         ${when(
            sortingOptions.length > 0,
            () =>
               html`<select x-id="sort" class="mx-2">
                  ${map(
                     sortingOptions,
                     (item) => html`<option value=${item.value}>${item.label}</option>`
                  )}
               </select>`,
            () => html``
         )}
         <i x-id="themeToggle" class="w-6 h-6 icon">${unsafeHTML(sunAndMoonSvg)}</i>
      </header>
   `)[0];

   const { feed, themeToggle, sort } = elements<{ feed: HTMLInputElement; themeToggle: HTMLElement; sort?: HTMLSelectElement }>(header);

   feed.addEventListener("focus", () => {
      feed.selectionStart = hash.indexOf("/") == -1 ? 0 : hash.indexOf("/") + 1;
      feed.selectionEnd = hash.length;
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
            location.hash = tokens.join("") + "/" + sort.value;
            location.reload();
            return;
         }
      });
   }

   animateSvgIcon(themeToggle);
   themeToggle.addEventListener("click", () => {
      document.body.setAttribute("data-theme", document.body.getAttribute("data-theme") == "dark" ? "light" : "dark");
   });

   return header;
}

function loadDefaultBookmark() {
   const defaultBookmark = getSettings().bookmarks.find((bookmark) => bookmark.isDefault == true);
   navigate(defaultBookmark ? bookmarkToHash(defaultBookmark) : "r/all");
}

async function main() {
   applySettings();
   const hash = location.hash.substring(1);

   if (location.hash.length == 0) {
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
   let source: Source<any, any> | null = null;
   let renderPost: (post: any) => HTMLElement[] = (post) => {
      return [];
   };
   switch (sourcePrefix) {
      case "r/":
         source = new RedditSource(hash);
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
         break;
      case "m/":
         source = new MastodonSource(hash);
         break;
      default:
         source = new RedditSource(hash);
   }

   const main = dom(html`<main class="flex flex-col gap-4"></main>`)[0];
   const header = renderHeader(hash, source.getSortingOptions(), source.getSorting());
   const loader = dom(contentLoader)[0];
   document.body.append(header);
   document.body.append(main);
   main.append(loader);

   window.addEventListener("hashchange", () => {
      if (getSourcePrefixFromHash() != sourcePrefix) location.reload();
      if (sourcePrefix != "hn/" && feed != getFeedFromHash()) location.reload();
   });
   dispatchEvent(new HashChangeEvent("hashchange"));

   try {
      const postsPage = await source.getPosts(null);
      loader.remove();
      renderPostPage(main, postsPage, renderPost, (after: PageIdentifier) => { return source!.getPosts(after)});
   } catch (e) {
      let message = e instanceof Error ? ": " + e.message : "";
      dom(html`<div>Could not load '${hash}'${message}</div>`, main);
   }
}

main();
