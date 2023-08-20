import { BookmarksView } from "./bookmarks";
import "./comments";
import { SourcePrefix, setSource } from "./data";
import { HackerNewsSource } from "./hackernews";
import "./header";
import { MastodonSource } from "./mastodon";
import "./posts";
import { RedditSource } from "./reddit";
import { RssSource } from "./rss";
import "./settings";
import { applySettings, bookmarkToHash, getSettings } from "./settings";
import "./styles.css";
import { navigate } from "./utils";
import { YoutubeSource } from "./youtube";

function loadDefaultBookmark() {
   const defaultBookmark = getSettings().bookmarks.find((bookmark) => bookmark.isDefault == true);
   navigate(defaultBookmark ? bookmarkToHash(defaultBookmark) : "r/all");
}

applySettings();
if (window.location.hash.length == 0) {
   loadDefaultBookmark();
} else {
   const hash = window.location.hash.substring(1);
   const tokens = hash.split("/");
   if (tokens.length == 1) {
      loadDefaultBookmark();
   } else {
      const source = (tokens[0] + "/") as SourcePrefix;
      switch (source) {
         case "r/":
            setSource(new RedditSource());
            break;
         case "hn/":
            setSource(new HackerNewsSource());
            break;
         case "rss/":
            setSource(new RssSource());
            break;;
         case "yt/":
            setSource(new YoutubeSource());
            break;
         case "m/":
            setSource(new MastodonSource());
            break;
         default:
            setSource(new RedditSource());
      }
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

  BookmarksView.showActionButton();
}
