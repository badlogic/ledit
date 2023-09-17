import { renderMastodonAccountEditor } from "./mastodon";
import { renderBookmarkEditor, renderBookmarks, renderSettings, renderSourceSelector } from "./settings";
import { route } from "./utils";

export const appPages = [
   route("#settings", renderSettings),
   route("#bookmarks", renderBookmarks),
   route("#bookmarks-select-source", renderSourceSelector),
   route("#bookmarks-new/:source", renderBookmarkEditor),
   route("#bookmarks-new/:source/:feed", renderBookmarkEditor),
   route("#bookmarks-edit/:id", renderBookmarkEditor),
   route("#bookmarks-add-mastodon-account", renderMastodonAccountEditor),
   route("#mastodon-edit-account/:id/home", renderMastodonAccountEditor),
];
