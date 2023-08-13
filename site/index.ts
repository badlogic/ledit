import "./styles.css";
import "./header";
import "./settings";
import "./posts";
import "./comments";
import { applySettings, bookmarkToHash, getSettings } from "./settings";
import { navigate } from "./utils";
import { RedditSource } from "./reddit";
import { HackerNewsSource } from "./hackernews";
import { RssSource } from "./rss";
import { setSource } from "./data";

applySettings();
if (window.location.hash.length == 0) {
   const defaultBookmark = getSettings().bookmarks.find((bookmark) => bookmark.isDefault == true);
   navigate(defaultBookmark ? bookmarkToHash(defaultBookmark) : "r/all");
} else {
  const hash = window.location.hash;
   if (hash.startsWith("#r/")) {
      setSource(new RedditSource());
   } else if (hash.startsWith("#hackernews/") || hash.startsWith("#hn")) {
      setSource(new HackerNewsSource());
   } else if (hash.startsWith("#rss/")) {
      setSource(new RssSource());
   } else {
      setSource(new RedditSource());
   }

   window.addEventListener("hashchange", () => {
      if (window.location.hash != hash) {
         window.location.reload();
      }
   });

   document.body.innerHTML = `
  <ledit-header></ledit-header>
  <ledit-posts></ledit-posts>
  `;
}
