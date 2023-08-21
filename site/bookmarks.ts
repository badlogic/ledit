import { Source, SourcePrefix, sourcePrefixLabel } from "./data";
import { MastodonUserEditor } from "./mastodon";
import { Bookmark, bookmarkToHash, getSettings, saveSettings } from "./settings";
import { svgBookmark, svgCheck, svgHackernews, svgMastodon, svgMinus, svgPencil, svgPlus, svgReddit, svgRss, svgYoutube } from "./svg";
import { assertNever, dom, makeChildrenDraggable, navigate } from "./utils";
import { OverlayView, View } from "./view";

function sourcePrefixToFeedLabel(source: SourcePrefix) {
   switch (source) {
      case "r/":
         return "Subreddits";
      case "hn/":
         return "Hackernews";
      case "rss/":
         return "RSS feeds";
      case "yt/":
         return "YouTube channels";
      case "m/":
         return "Mastodon accounts";
      default:
         assertNever(source);
   }
}

function sourcePrefixToFeedPlaceholder(source: SourcePrefix) {
   switch (source) {
      case "r/":
         return "r/all\nr/videos\nr/puppies\n...";
      case "hn/":
         return "";
      case "rss/":
         return "https://techcrunch.com/feed/\nhttps://www.theverge.com/rss/frontpage\nhttps://www.wired.com/feed/rss\n...";
      case "yt/":
         return "RedLetterMedia\nVeritasium\n...";
      case "m/":
         // FIXME
         return "Mastodon accounts";
      default:
         assertNever(source);
   }
}

function sourcePrefixToSourceName(source: SourcePrefix) {
   switch (source) {
      case "r/":
         return "Reddit";
      case "hn/":
         return "Hackernews";
      case "rss/":
         return "RSS";
      case "yt/":
         return "YouTube";
      case "m/":
         return "Mastodon";
      default:
         assertNever(source);
   }
}

function getSourceIcon(source: SourcePrefix) {
   let svgIcon: string = "";
   switch (source) {
      case "r/":
         svgIcon = svgReddit;
         break;
      case "hn/":
         svgIcon = svgHackernews;
         break;
      case "rss/":
         svgIcon = svgRss;
         break;
      case "yt/":
         svgIcon = svgYoutube;
         break;
      case "m/":
         svgIcon = svgMastodon;
         break;
      default:
         assertNever(source);
   }
   return svgIcon;
}

export class SourceSelectorView extends OverlayView {
   constructor() {
      super("Add feed for");
      this.renderContent();
   }

   renderContent() {
      const sources: SourcePrefix[] = ["r/", "m/", "hn/", "rss/", "yt/"];

      this.content.append(
         ...dom(/*html*/ `
         ${sources.map((source) =>
            /*html*/`
            <div class="overlay-row" value="${source}" style="flex: 1; display: flex; align-items: center;">
               <span class="box" style="fill: var(--ledit-link-color);">${getSourceIcon(source)}</span>
               <span>${sourcePrefixToSourceName(source)}</span>
            </div>`
         )}
      `)
      );

      this.content.querySelectorAll(".overlay-row").forEach((source) => {
         source.addEventListener("click", () => {
            this.close();
            const bookmark: Bookmark = {
               source: (source as HTMLElement).getAttribute("value") as SourcePrefix,
               label: "",
               ids: [],
               isDefault: false
            }
            document.body.append(new BookmarkEditor(bookmark, true));
         })
      });
   }
}
customElements.define("ledit-source-selector", SourceSelectorView);

export class BookmarksView extends OverlayView {
   constructor() {
      super("Bookmarks");
      this.renderContent();
   }

   renderContent() {
      const settings = getSettings();
      this.content.innerHTML = "";

      // Add feed & accounts buttons
      const addBookmarkDiv = dom(`<div class="overlay-row"><span class="box color-fill">${svgBookmark}</span>Add feed</div>`)[0];
      this.content.append(addBookmarkDiv);
      addBookmarkDiv.addEventListener("click", () => {
         this.close();
         document.body.append(new SourceSelectorView());
      });

      const addMastodonAccountDiv = dom(`<div class="overlay-row"><span class="box color-fill">${svgBookmark}</span>Add Mastodon account</div>`)[0];
      this.content.append(addMastodonAccountDiv);
      addMastodonAccountDiv.addEventListener("click", () => {
         this.close();
         document.body.append(
            new MastodonUserEditor(
               {
                  source: "m/",
                  label: "",
                  ids: [],
                  isDefault: false,
                  supplemental: { username: "", instance: "", bearer: "" },
               },
               true
            )
         );
      });

      // Populate bookmarks
      const bookmarksDiv = dom(`<div></div>`)[0];
      this.content.append(bookmarksDiv);
      for (const [index, bookmark] of settings.bookmarks.entries()) {
         const isDefault = bookmark.isDefault;
         const hash = bookmarkToHash(bookmark);
         const bookmarkDiv = dom(/*html*/ `
               <div class="overlay-row">
                  <a x-id="feed" href="#${hash}" style="flex: 1; display: flex; align-items: center;"><span class="box" style="fill: var(--ledit-link-color);">${getSourceIcon(
            bookmark.source
         )}</span><span style="white-space: pre; text-overflow: ellipsis; overflow: hidden;">${bookmark.label}</span></a>
                  <div x-id="makeDefaultFeed" class="box ${isDefault ? "color-fill" : "color-dim-fill"}">${svgCheck}</div>
                  ${
                     bookmark.source == "hn/"
                        ? /*html*/ `<div x-id="editFeed" class="box"></div>`
                        : /*html*/ `<div x-id="editFeed" class="box color-fill">${svgPencil}</div>`
                  }
                  <div x-id="deleteFeed" class="box color-fill">${svgMinus}</div>
               </div>
            `)[0];
         const subElements = View.elements<{
            feed: Element;
            makeDefaultFeed: Element;
            editFeed: Element;
            deleteFeed: Element;
         }>(bookmarkDiv);
         subElements.feed.addEventListener("click", () => {
            navigate(hash);
         });
         subElements.makeDefaultFeed.addEventListener("click", (event) => {
            event.stopPropagation();
            if (isDefault) return;
            settings.bookmarks.forEach((bm) => {
               bm.isDefault = false;
            });
            bookmark.isDefault = true;
            saveSettings();
            this.renderContent();
         });
         if (bookmark.source != "hn/") {
            subElements.editFeed.addEventListener("click", (event) => {
               this.close();
               if (bookmark.source == "m/" && bookmark.supplemental) {
                  document.body.append(new MastodonUserEditor(bookmark, false));
               } else {
                  document.body.append(new BookmarkEditor(bookmark));
               }
            });
         }
         subElements.deleteFeed.addEventListener("click", (event) => {
            event.stopPropagation();
            if (confirm(`Are you sure you want to delete bookmark '${bookmark.label}'?`)) {
               settings.bookmarks = settings.bookmarks.filter((bm) => bm != bookmark);
               saveSettings();
               this.renderContent();
            }
         });
         bookmarkDiv.setAttribute("data-index", index.toString());
         bookmarksDiv.append(bookmarkDiv);
      }
      makeChildrenDraggable(bookmarksDiv, () => {
         const original = getSettings().bookmarks;
         const rearranged: Bookmark[] = [];
         bookmarksDiv.querySelectorAll(".overlay-row").forEach((bookmarkDiv) => {
            const oldIndex = Number.parseInt(bookmarkDiv.getAttribute("data-index")!);
            rearranged.push(original[oldIndex]);
            bookmarkDiv.setAttribute("data-index", (rearranged.length - 1).toString());
            getSettings().bookmarks = rearranged;
            saveSettings();
         })
      });
   }

   static showActionButton() {
      const actionButtons = dom(`<div class="fab-container"></div>`)[0];
      const openBookmarks = dom(`<div class="fab color-fill" style="margin-right: auto; margin-left: var(--ledit-margin);">${svgPlus}</div>`)[0];
      actionButtons.append(openBookmarks);
      openBookmarks.addEventListener("click", () => document.body.append(new BookmarksView()));
      document.body.append(actionButtons);
   }
}
customElements.define("ledit-bookmarks", BookmarksView);

export class BookmarkEditor extends OverlayView {
   constructor(public readonly bookmark: Bookmark, public readonly isNew = false) {
      super(sourcePrefixLabel(bookmark.source) + " bookmark");
      this.renderContent();
   }

   renderContent() {
      this.content.style.gap = "0.5em";
      const editorDom = dom(/*html*/ `
         <input x-id="label" value="${this.bookmark.label}" placeholder="Label, e.g 'Puppies'">
         <textarea x-id="feedIds" placeholder="${sourcePrefixToFeedPlaceholder(this.bookmark.source)}"></textarea>
         <div class="overlay-buttons">
            <div x-id="save" class="overlay-button" style="margin-left: auto;">Save</div>
         </div>
      `);
      this.content.append(...editorDom);

      const elements = this.elements<{
         container: Element;
         editor: Element;
         close: Element;
         label: HTMLInputElement;
         feedIds: HTMLTextAreaElement;
         save: Element;
      }>();

      // Populate feeds
      elements.feedIds.value = this.bookmark.ids.join("\n");

      // Save functionality
      elements.save.addEventListener("click", () => {
         // validate
         const label = elements.label.value.trim();
         if (label.length == 0) {
            alert("Please specify a label");
            return;
         }
         if (this.isNew) {
            if (getSettings().bookmarks.some((bookmark) => bookmark.label == label)) {
               alert(`Bookmark with label '${label}' already exists`);
               return;
            }
         }

         const feedIdsValue = elements.feedIds.value.trim();
         if (feedIdsValue.length == 0) {
            alert(`Please specify one or more ${sourcePrefixToFeedLabel(this.bookmark.source)}, separated by commas or line breaks.`);
            return;
         }
         const feedIds = feedIdsValue
            .split(/[,\n]+/)
            .filter((feedId) => feedId != undefined && feedId != null && feedId.trim().length != 0)
            .map((feedId) => feedId.trim());
         if (feedIds.length == 0) {
            alert(`Please specify one or more ${sourcePrefixToFeedLabel(this.bookmark.source)}, separated by commas or line breaks.`);
            return;
         }

         // All good, save the bookmark and close.
         this.bookmark.label = label;
         this.bookmark.ids = feedIds;
         if (this.isNew) {
            getSettings().bookmarks.push(this.bookmark);
         }
         saveSettings();
         this.close();
         navigate(bookmarkToHash(this.bookmark));
      });
   }
}
customElements.define("ledit-bookmark-editor", BookmarkEditor);

document.addEventListener("keydown", (event) => {
   if (event.key == "f"  && event.target == document.body && !document.body.querySelector("ledit-bookmarks")) {
      document.body.append(new BookmarksView());
   }
});