import "./ledit-bundle.css";
import { Bookmark, Settings, applySettings, bookmarkToHash, getSettings, resetSettings, saveSettings } from "./sources/settings";
import { Page } from "./sources/data";
import "./sources/guards";
// @ts-ignore
import { assertNever, elements, makeChildrenDraggable, navigate, onVisibleOnce, setLinkTargetsToBlank } from "./utils";
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
   makeOverlayModal,
   numOverlays,
   renderContentLoader,
   renderErrorMessage,
   renderHeaderButton,
   renderInfoMessage,
   renderOverlay,
   route,
   sourcePrefixToFeedLabel,
   sourcePrefixToLabel,
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
// @ts-ignore
import rssIcon from "remixicon/icons/Device/rss-line.svg";
// @ts-ignore
import youtubeIcon from "remixicon/icons/Logos/youtube-line.svg";
// @ts-ignore
import redditIcon from "remixicon/icons/Logos/reddit-line.svg";
// @ts-ignore
import mastodonIcon from "remixicon/icons/Logos/mastodon-fill.svg";
// @ts-ignore
import bookmarkIcon from "remixicon/icons/Business/bookmark-line.svg";
// @ts-ignore
import hackernewsIcon from "./svg/hackernews.svg";
// @ts-ignore
import closeIcon from "remixicon/icons/System/close-circle-line.svg";
// @ts-ignore
import editIcon from "remixicon/icons/Design/edit-line.svg";
// @ts-ignore
import addIcon from "remixicon/icons/System/add-circle-line.svg";

const sources = [
   { prefix: "r", label: "Reddit" },
   { prefix: "rss", label: "Rss" },
   { prefix: "yt", label: "YouTube" },
   { prefix: "m", label: "Mastodon" },
];

const appPages = [
   route("#settings", renderSettings),
   route("#bookmarks", renderBookmarks),
   route("#bookmarks-select-source", renderSourceSelector),
   route("#bookmarks-new/:source", renderBookmarkEditor),
   route("#bookmarks-new/:source/:feed", renderBookmarkEditor),
   route("#bookmarks-edit/:id", renderBookmarkEditor),
];

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

export function renderPosts<T>(
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
            renderPosts(container, newPage, renderPost, getNextPage);
         }
      });
   } else {
      container.append(...renderInfoMessage("No more posts"));
   }
}

export function renderSettings() {
   const template = (settings: Settings) =>
      html`
         <div class="settings flex flex-col text-lg gap-4 mt-4 px-2">
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
                     <a href="#${bookmarkToHash(bookmark)}" class="overflow-hidden inline-block text-ellipsis flex-1 h-[3em] flex items-center">${bookmark.label}</a>
                     ${bookmark.source != "hn/"
                        ? html`<a href="#bookmarks-edit/${bookmark.label}" class="ml-auto block"><i class="icon min-w-[1.5em] min-h-[1.5em]">${unsafeHTML(editIcon)}</i></a>
                             <i data-bookmark-label="${bookmark.label}" class="icon block min-w-[1.5em] min-h-[1.5em]">${unsafeHTML(closeIcon)}</i>`
                        : html`<i data-bookmark-label="${bookmark.label}" class="icon ml-auto block min-w-[1.5em] min-h-[1.5em]"
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
   overlay.dom.querySelectorAll("[data-bookmark-label]").forEach((deleteButton) => {
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
            saveSettings();
         }
      });
   });
   makeOverlayModal(appPages, overlay);

   makeChildrenDraggable(bookmarksContainer, () => {
      getSettings().bookmarks = rearrangeBookmarks();
      saveSettings();
   });
}

export function renderSourceSelector() {
   const content = dom(html`<div class="bookmarks">
      ${map(
         sources,
         (source) =>
            html`<a href="#bookmarks-new/${source.prefix}" class="flex items-center gap-4 px-4 h-[3em] border-b border-border/50">${source.label}</a>`
      )}
   </div>`);
   const overlay = renderOverlay("Select source", content);
   makeOverlayModal(appPages, overlay);
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
      ? { source: (params["source"] + "/") as SourcePrefix, label: params["feed"] ?? "", ids: params["feed"] ? params["feed"].split("+") : [], isDefault: false }
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
   makeOverlayModal(appPages, overlay);

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

export function renderHeader(hash: string, sortingOptions: SortingOption[]) {
   const tokens = hash.split("/");
   const hashSource = tokens[0] + "/";
   const hashFeed = tokens[1];
   const bookmark = getSettings().bookmarks.find((bookmark) => bookmark.source == hashSource && bookmark.ids.join("+") == hashFeed)

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
         ${bookmark ? "" : renderHeaderButton(addIcon, "", undefined, "addBookmark")}
         ${renderHeaderButton(bookmarkIcon, "", "#bookmarks")}
      </header>
   `)[0];

   const { feed, sort, addBookmark } = elements<{ feed: HTMLInputElement; sort?: HTMLSelectElement, addBookmark?: HTMLElement }>(header);

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
         const tokens = feed.value.split("/");
         const hashSource = tokens[0] + "/";
         const hashFeed = tokens[1];
         location.hash = `#bookmarks-new/${hashSource}${hashFeed}`;
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
   const header = renderHeader(hash, source.getSortingOptions());
   const loader = renderContentLoader();
   document.body.append(header);
   document.body.append(main);
   main.append(loader);

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
      const postsPage = await source.getPosts(null);
      loader.remove();
      renderPosts(main, postsPage, renderPost, (after: PageIdentifier) => {
         return source!.getPosts(after);
      });
   } catch (e) {
      loader.remove();
      main.append(...renderErrorMessage(`Could not load '${hash}'`, e instanceof Error ? e : undefined));
   }
}

main();
