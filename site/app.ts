import { html } from "lit-html";
import { Source, SourcePrefix } from "./data";
import { HackerNewsSource } from "./hackernews";
import { Header } from "./header";
import { renderMastodonAccountEditor } from "./mastodon";
import { MastodonSource } from "./mastodon";
import { numOverlays } from "./overlay";
import { dom, renderErrorMessage } from "./partials";
import { RedditSource } from "./reddit";
import { RssSource } from "./rss";
import { applySettings, bookmarkToHash, getSettings, renderBookmarkEditor, renderBookmarks, renderSettings, renderSourceSelector } from "./settings";
import { getFeedFromHash, navigate, route } from "./utils";
import { YoutubeSource } from "./youtube";
import { LitElement } from "lit";

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

function loadDefaultBookmark() {
   const defaultBookmark = getSettings().bookmarks.find((bookmark) => bookmark.isDefault == true);
   navigate(defaultBookmark ? bookmarkToHash(defaultBookmark) : "r/all");
}

async function main() {
   applySettings();
   const hash = location.hash.substring(1).trim();

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
   const header = new Header();
   header.hash = hash;
   header.sortingOptions = source.getSortingOptions();
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

   const bookmark = getSettings().bookmarks.find((bookmark) => bookmark.source == sourcePrefix && bookmark.label == feed);
   if (bookmark) {
      location.hash = bookmark.source + bookmark.ids.join("+");
   }

   try {
      source.renderMain(main);
   } catch (e) {
      main.append(...renderErrorMessage(`Could not load '${hash}'`, e instanceof Error ? e : undefined));
   }
}

main();
