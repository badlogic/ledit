import { LitElement, PropertyValueMap } from "lit";
import { TemplateResult, html, nothing } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { customElement, property, query, state } from "lit/decorators.js";
import { Page, PageIdentifier, SortingOption, Source } from "./data";
import { checkmarkIcon, closeIcon, commentIcon, imageIcon, loaderIcon, reblogIcon, replyIcon, starIcon } from "./icons";
import { Overlay } from "./overlay";
import { ItemList, dom, renderContentLoader, renderErrorMessage, renderGallery, renderList, renderVideo, safeHTML } from "./partials";
import { Bookmark, bookmarkToHash, getSettings, saveSettings } from "./settings";
import { addCommasToNumber, dateToText, elements, navigate, onVisibleOnce, setLinkTargetsToBlank, waitForMediaLoaded } from "./utils";
import { globalStyles } from "./styles";
import { MastodonAccount, MastodonApi, MastodonEmoji, MastodonMedia, MastodonPost, MastodonRelationship, MastodonUserInfo } from "./mastodon-api";
import { navigationGuard } from "./guards";
import { renderComments } from "./comments";
import { HnCommentsView } from "./hackernews";

const mastodonUserIds = localStorage.getItem("mastodonCache") ? JSON.parse(localStorage.getItem("mastodonCache")!) : {};

function replaceEmojis(text: string, emojis: MastodonEmoji[]): TemplateResult {
   let replacedText = text;

   for (const emoji of emojis) {
      const shortcodeRegExp = new RegExp(`:${emoji.shortcode}:`, "g");
      replacedText = replacedText.replace(
         shortcodeRegExp,
         `<div class="inline-flex items-center align-middle h-[1.5em]"><img class="w-[1em] h-[1em]" src="${emoji.url}" alt="${emoji.shortcode}"></div>`
      );
   }

   return html`${safeHTML(replacedText)}`;
}

function getAccountName(account: MastodonAccount, shouldReplaceEmojis = true): TemplateResult | string {
   let name = account.display_name && account.display_name.length > 0 ? account.display_name : account.username;
   if (shouldReplaceEmojis) {
      return html`<span>${replaceEmojis(name, account.emojis)}</span>`;
   } else {
      return name;
   }
}

function getUserInfo(input: string, requireToken = false): MastodonUserInfo | undefined {
   let username = "";
   let instance = "";
   let bearer: string | null = null;

   if (input.startsWith("@")) input = input.substring(1);
   const tokens = input.split("@");
   if (tokens.length != 2) {
      return undefined;
   }
   username = tokens[0];
   instance = tokens[1];

   for (const bookmark of getSettings().bookmarks) {
      if (bookmark.source == "m/" && bookmark.supplemental && bookmark.supplemental.username == username && bookmark.supplemental.instance == instance) {
         bearer = bookmark.supplemental.bearer;
      }
   }
   if (requireToken && !bearer) return undefined;
   return { username, instance, bearer };
}

function extractUsernames(mastodonPost: MastodonPost) {
   const dom = new DOMParser().parseFromString(mastodonPost.content, "text/html");
   const mentionLinks = dom.querySelectorAll("a.u-url.mention");
   const usernames: string[] = [];

   mentionLinks.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;
      const match = href.match(/https?:\/\/([^/]+)\/@([^/]+)/);

      if (match) {
         const host = match[1];
         const username = match[2];
         usernames.push("@" + username + "@" + host);
      }
   });

   return usernames;
}

export interface MastodonWhat {
   type: "remote-user" | "local-user" | "instance" | "id" | "local" | "home" | "profile" | "comments";
   user?: string;
   instance?: string;
   tag?: string; // FIXME implement tags
   id?: string;
}

export type MastodonComment = {
   post: MastodonPost;
   replies: MastodonComment[];
};

export type MastodonComments = {
   possiblyIncomplete: boolean;
   remoteInstance: string;
   originalPost: MastodonPost;
   root: MastodonComment;
};

function getFeed(): string {
   const feed = location.hash;
   if (feed.length == 0) {
      return "";
   }
   let slashIndex = feed.indexOf("/");
   if (slashIndex == -1) return "";
   return decodeURIComponent(feed.substring(slashIndex + 1));
}

function getWhats() {
   const feedTokens = getFeed()
      .split("/")
      .map((token) => token.trim());
   if (feedTokens.length == 0)
      return new Error(`Invalid Mastodon feed ${getFeed()}. Must be a user name, e.g. @badlogic@mastodon.gamedev.place, or an instance name, e.g. mastodon.gamedev.place.`);

   const whats: MastodonWhat[] = [];
   for (const token of feedTokens) {
      if (token.startsWith("@")) {
         whats.push({ type: "local-user", user: token.substring(0) });
      } else if (token.split("@").length == 2) {
         // mario@mastodon.social
         whats.push({ type: "remote-user", user: token.split("@")[0], instance: token.split("@")[1] });
      } else if (token == "home") {
         // mario@mastodon.social/home
         whats.push({ type: "home" });
      } else if (token == "local") {
         whats.push({ type: "local" });
      } else if (token == "profile") {
         whats.push({ type: "profile" });
      } else if (token == "comments") {
         whats.push({ type: "comments" });
      } else {
         if (token.includes(".")) {
            whats.push({ type: "instance", instance: token });
         } else {
            whats.push({ type: "id", id: token });
         }
      }
   }
   let user: MastodonUserInfo | undefined;
   if (whats.length > 0 && whats[0].type == "remote-user") {
      user = getUserInfo(whats[0].user + "@" + whats[0].instance, true);
      if (user) whats.splice(0, 1);
   }
   return { user, whats };
}

export class MastodonSource extends Source<MastodonPost> {
   constructor(feed: string) {
      super(feed);

      window.addEventListener("hashchange", async () => {
         const hash = window.location.hash;
         if (!hash.startsWith("#m/")) return;

         const result = getWhats();
         if (result instanceof Error) return;
         const { user, whats } = result;
         if (whats.length == 0) return;
         if (whats[0].type == "profile") {
            if (whats.length > 1 && whats[1].type == "remote-user") {
               const lastChild = document.body.children[document.body.children.length - 1];
               if (lastChild.getAttribute("data-account") != whats[1].user + "@" + whats[1].instance) {
                  document.body.append(new MastodonProfileView());
               }
            }
         }
         if (whats[0].type == "comments") {
            if (whats.length > 2 && whats[1].type == "instance" && whats[2].type == "id") {
               const lastChild = document.body.children[document.body.children.length - 1];
               if (lastChild.getAttribute("data-id") != whats[1].instance + "/" + whats[2].id) {
                  const commentsView = new MastodonCommentsView();
                  document.body.append(commentsView);
                  const comments = await getComments(whats[2].id!, whats[1].instance!, user);
                  if (comments instanceof Error) {
                     commentsView.error = comments;
                  } else {
                     commentsView.data = comments;
                  }
               }
            }
         }
      });
   }

   async getPosts(nextPage: PageIdentifier): Promise<Error | Page<MastodonPost>> {
      let mastodonPosts: Page<MastodonPost> | Error | undefined;

      const result = getWhats();
      if (result instanceof Error) return result;
      const { user, whats } = result;

      if (user) {
         // User logged in
         if (whats.length == 0) {
            // mario@mastodon.social (logged in)
            const account = await MastodonApi.lookupAccount(user.username, user.instance);
            if (account instanceof Error) return account;
            mastodonPosts = await MastodonApi.getAccountPosts(account.id, user.instance, nextPage, user);
         } else if (whats[0].type == "home") {
            // mario@mastodon.social/home (logged in)
            mastodonPosts = await MastodonApi.getHomeTimeline(nextPage, user);
         } else if (whats[0].type == "local") {
            // mario@mastodon.social/local (logged in)
            mastodonPosts = await MastodonApi.getLocalTimeline(nextPage, user.instance);
         } else if (whats[0].type == "local-user") {
            // mario@mastodon.social/@badlogic
            const account = await MastodonApi.lookupAccount(whats[0].user!, user.instance);
            if (account instanceof Error) return new Error(`Could not lookup account '${whats[0].user! + "@" + user.instance}'`);
            mastodonPosts = await MastodonApi.getAccountPosts(account.id, user.instance, nextPage, user);
         } else if (whats[0].type == "remote-user") {
            // mario@mastodon.social/@badlogic@mastodon.gamedev.place
            const username = whats[0].user!;
            const instance = whats[0].instance!;
            if (instance == user.instance) {
               const account = await MastodonApi.lookupAccount(username, user.instance);
               if (account instanceof Error) return new Error(`Could not lookup account '${username + "@" + user.instance}'`);
               mastodonPosts = await MastodonApi.getAccountPosts(account.id, user.instance, nextPage, user);
            } else {
               const account = await MastodonApi.lookupAccount(username, instance);
               if (account instanceof Error) return new Error(`Could not lookup account '${username + "@" + instance}'`);
               mastodonPosts = await MastodonApi.getAccountPosts(account.id, instance, nextPage);
            }
         } else if (whats[0].type == "instance") {
            mastodonPosts = await MastodonApi.getLocalTimeline(nextPage, whats[0].instance!);
         } else {
            mastodonPosts = await MastodonApi.getHomeTimeline(nextPage, user);
         }
      } else {
         if (whats[0].type == "instance") {
            mastodonPosts = await MastodonApi.getLocalTimeline(nextPage, whats[0].instance!);
         } else if (whats[0].type == "remote-user") {
            const username = whats[0].user!;
            const instance = whats[0].instance!;
            const account = await MastodonApi.lookupAccount(username, instance);
            if (account instanceof Error) return new Error(`Could not lookup account '${username + "@" + instance}'`);
            mastodonPosts = await MastodonApi.getAccountPosts(account.id, instance, nextPage);
         } else {
            mastodonPosts = new Error(`Could not load feed '${this.getFeed()}'`);
         }
      }

      if (mastodonPosts instanceof Error) return mastodonPosts;
      if (!mastodonPosts) return new Error(`Invalid Mastodon feed ${this.getFeed()}`);

      const inReplyToPromises: Promise<MastodonPost | Error>[] = [];
      for (const post of mastodonPosts.items) {
         const postToView = post.reblog ?? post;
         if (postToView.in_reply_to_id) {
            inReplyToPromises.push(MastodonApi.getPost(postToView.in_reply_to_id, postToView.instance));
         }
      }
      const inReplyToPosts: (MastodonPost | Error)[] = await Promise.all(inReplyToPromises);
      let idx = 0;
      for (const post of mastodonPosts.items) {
         const postToView = post.reblog ?? post;
         if (postToView.in_reply_to_id) {
            const inReplyToPost = inReplyToPosts[idx++];
            postToView.in_reply_to_post = inReplyToPost instanceof Error ? null : inReplyToPost;
         }
      }
      return mastodonPosts;
   }

   async renderMain(main: HTMLElement) {
      const feedTokens = this.getFeed().split("/");
      if (feedTokens.length == 0)
         throw new Error(`Invalid Mastodon feed ${this.getFeed()}. Must be a user name, e.g. @badlogic@mastodon.gamedev.place, or an instance name, e.g. mastodon.gamedev.place.`);

      const user = getUserInfo(feedTokens[0].trim(), true);
      const loader = renderContentLoader();
      main.append(loader);
      const page = await this.getPosts(null);
      loader.remove();
      renderList(
         main,
         page,
         renderMastodonPost,
         (nextPage: PageIdentifier) => {
            return this.getPosts(nextPage);
         },
         user
      );
   }

   getSortingOptions(): SortingOption[] {
      return [];
   }
}

async function getComments(postId: string, instance: string, user?: MastodonUserInfo): Promise<MastodonComments | Error> {
   const post = await MastodonApi.getPost(postId, instance, user);
   if (post instanceof Error) return post;
   let postToView = post.reblog ?? post;

   // Fetch the context from the remote instance first
   let possiblyIncomplete = false;
   const remoteInstance = new URL(postToView.uri).host;
   const remotePostId = postToView.uri.split("/").pop()!;
   let context = await MastodonApi.getPostContext(remotePostId, remoteInstance, user);
   if (context instanceof Error) {
      if (remoteInstance == postToView.instance) return context;
      context = await MastodonApi.getPostContext(postToView.id, postToView.instance, user);
      if (context instanceof Error) return context;
      possiblyIncomplete = true;
   } else {
      const result = await MastodonApi.getPost(remotePostId, remoteInstance, user);
      if (result instanceof Error) return result;
      postToView = result;
   }

   // Fetch the full tree from root downwards
   if (context.ancestors.length > 0) {
      const newContext = await MastodonApi.getPostContext(context.ancestors[0].id, context.ancestors[0].instance, user);
      if (newContext instanceof Error) return newContext;
      newContext.ancestors.push(context.ancestors[0]);
      newContext.ancestors = newContext.ancestors.filter((post) => post.id != postToView.id);
      newContext.descendants = newContext.descendants.filter((post) => post.id != postToView.id);
      context = newContext;
   }

   const comments: MastodonComment[] = [];
   const commentsById = new Map<string, MastodonComment>();
   let root: MastodonComment | null = null;

   for (const post of [...context.ancestors, ...context.descendants, postToView]) {
      const comment = { post, replies: [] };
      comments.push(comment);
      commentsById.set(comment.post.id, comment);
      if (!comment.post.in_reply_to_id) {
         if (root) {
            console.log("WTF");
         }
         root = comment;
      }
   }

   if (!root) return new Error("Could not find root comment");
   for (const comment of comments) {
      if (comment.post.in_reply_to_id) {
         const other = commentsById.get(comment.post.in_reply_to_id);
         if (other) {
            other.replies.push(comment);
         } else {
            return new Error("Could not find parent of comment");
         }
      }
   }

   return { originalPost: postToView, root, possiblyIncomplete, remoteInstance };
}

export function renderMastodonMedia(post: MastodonPost, contentDom?: HTMLElement) {
   const mediaDom = dom(html`<div class="media flex flex-col items-center gap-2 mt-2"></div>`)[0];
   if (post.media_attachments.length > 0) {
      const images: string[] = [];
      const videos: MastodonMedia[] = [];

      for (const media of post.media_attachments) {
         if (media.type == "image") {
            images.push(media.url);
         } else if (media.type == "gifv") {
            videos.push(media);
         } else if (media.type == "video") {
            videos.push(media);
         }
      }

      if (images.length >= 1) {
         const gallery = renderGallery(images);
         mediaDom.append(gallery);
      }
      if (videos.length >= 1) {
         for (const video of videos) {
            mediaDom.append(
               renderVideo(
                  {
                     width: video.meta?.original?.width ?? 0,
                     height: video.meta?.original?.height ?? 0,
                     urls: [video.url],
                  },
                  false
               )
            );
         }
      }
   }

   // FIXME render cards
   if (post.card) {
   }

   // FIXME render poll
   if (post.poll) {
   }
   if (mediaDom.children.length > 0 && contentDom) contentDom.append(mediaDom);
   return mediaDom.children.length > 0 ? mediaDom : undefined;
}

function getProfileUrl(account: MastodonAccount, user?: MastodonUserInfo) {
   const baseUrl = user ? `#m/${user.username}@${user.instance}/profile/` : "#m/";
   if (!user) {
      console.log("wtf");
   }
   return baseUrl + account.username + "@" + new URL(account.url).host;
}

function showProfile(event: Event, account: MastodonAccount, user?: MastodonUserInfo) {
   event.stopPropagation();
   event.preventDefault();
   navigationGuard.call = false;
   const hash = getProfileUrl(account, user);
   if (hash != location.hash) location.hash = hash;
}

function getCommentsUrl(post: MastodonPost, user?: MastodonUserInfo) {
   const baseUrl = user ? `#m/${user.username}@${user.instance}/` : "#m/";
   if (!user) {
      console.log("wtf");
   }
   return baseUrl + `comments/${post.instance}/${post.id}`;
}

function showComments(event: Event, post: MastodonPost, user?: MastodonUserInfo) {
   event.stopPropagation();
   event.preventDefault();
   navigationGuard.call = false;
   const hash = getCommentsUrl(post, user);
   if (location.hash != hash) location.hash = hash;
}

export function renderMastodonPost(post: MastodonPost, user?: MastodonUserInfo) {
   const postToView = post.reblog ?? post;
   const postDom = dom(html` <article class="post mastodon-post gap-2">
      ${post.reblog
         ? html`<div class="flex items-center gap-2 text-sm text-color/60 overflow-hidden">
              <span>Boosted by</span>
              <a @click=${(event: Event) => showProfile(event, post.account, user)} class="flex items-center gap-2 text-color/60 overflow-hidden cursor-pointer">
                 <img class="w-[1.5em] h-[1.5em] rounded-full" src="${post.account.avatar_static}" />
                 <span class="overflow-hidden text-ellipsis">${getAccountName(post.account)}</span>
              </a>
           </div>`
         : ""}
      <div class="flex items-center gap-2">
         <img class="w-[2.5em] h-[2.5em] rounded-full" src="${postToView.account.avatar_static}" />
         <a @click=${(event: Event) => showProfile(event, postToView.account, user)} class="flex inline-block flex-col text-sm text-color overflow-hidden cursor-pointer">
            <span class="font-bold overflow-hidden text-ellipsis">${getAccountName(postToView.account)}</span>
            <span class="text-color/60 overflow-hidden text-ellipsis"
               >${postToView.account.username + (user && user.instance == new URL(postToView.account.url).host ? "" : "@" + new URL(postToView.account.url).host)}</span
            >
         </a>
         <a href="${postToView.url}" class="ml-auto text-xs self-start">${dateToText(new Date(postToView.created_at).getTime())}</a>
      </div>
      ${postToView.in_reply_to_post
         ? html` <div class="flex items-center gap-1 text-sm text-color/60 overflow-hidden">
              <span>In reply to</span>
              <a
                 @click=${(event: Event) => showProfile(event, postToView.in_reply_to_post!.account, user)}
                 class="flex items-center gap-2 text-color/60 overflow-hidden cursor-pointer"
              >
                 <img class="w-[1.5em] h-[1.5em] rounded-full" src="${postToView.in_reply_to_post.account.avatar_static}" />
                 <span class="overflow-hidden text-ellipsis">${getAccountName(postToView.in_reply_to_post.account)}</span>
              </a>
           </div>`
         : ""}
      <div x-id="contentDom" class="content">
         <div class="content-text">${replaceEmojis(postToView.content, postToView.emojis)}</div>
      </div>
      <div class="flex justify-between min-w-[320px] max-w-[320px] mx-auto !mb-[-0.5em]">
         <a @click=${(event: Event) => showComments(event, postToView, user)} href="" class="self-link flex items-center gap-1 h-[2em]">
            <i class="icon fill-color/60">${commentIcon}</i>
            <span class="text-color/60">${addCommasToNumber(postToView.replies_count)}</span>
         </a>
         ${user
            ? html`<a href="" class="flex items-center gap-1 h-[2em]">
                 <i class="icon fill-color/70">${replyIcon}</i>
                 <span class="text-color/60">Reply</span>
              </a>`
            : nothing}
         <a href="" class="flex items-center gap-1 h-[2em]" ?disabled=${user}>
            <i class="icon ${postToView.reblogged ? "fill-primary" : "fill-color/60"}">${reblogIcon}</i>
            <span class="${postToView.reblogged ? "text-primary" : "text-color/60"}">${addCommasToNumber(postToView.reblogs_count)}</span>
         </a>
         <a href="" class="flex items-center gap-1 h-[2em]" ?disabled=${user}>
            <i class="icon ${postToView.favourited ? "fill-primary" : "fill-color/60"}">${starIcon}</i>
            <span class="${postToView.favourited ? "text-primary" : "text-color/60"}">${addCommasToNumber(postToView.favourites_count)}</span>
         </a>
         ${postToView.media_attachments.length > 1
            ? html` <span class="flex items-center gap-1 cursor-pointer h-[2em]" x-id="gallery">
                 <i class="icon fill-color/70">${imageIcon}</i>
                 <span class="text-color/70">${postToView.media_attachments.length}</span>
              </span>`
            : ""}
      </div>
   </article>`);

   const { contentDom, gallery } = elements<{ contentDom: HTMLElement; gallery?: HTMLElement }>(postDom[0]);

   onVisibleOnce(postDom[0], () => {
      renderMastodonMedia(postToView, contentDom);
      setLinkTargetsToBlank(contentDom);

      if (gallery) {
         const img = contentDom.querySelector(".media img");
         if (img) {
            gallery.addEventListener("click", () => (img as HTMLElement).click());
         }
      }
   });

   return postDom;
}

@customElement("ledit-mastodon-account-editor")
export class MastodonAccountEditor extends LitElement {
   static styles = Overlay.styles;

   _bookmark?: Bookmark;

   set bookmark(value: Bookmark) {
      const user = value.supplemental as MastodonUserInfo;
      if (!user) throw new Error("Bookmark has no MastodonUserInfo");
      this._bookmark = value;
      this.id = user.username.length > 0 ? user.username + "@" + user.instance : "";
      this.accessToken = user.bearer ?? "";
   }

   get bookmark(): Bookmark | undefined {
      return this._bookmark;
   }

   @state()
   errorId = "";

   @state()
   errorToken = "";

   @state()
   id: string = "";

   @state()
   accessToken: string = "";

   @state()
   errorConnect = "";

   @query("#overlay")
   overlay?: Overlay;

   @query("#loader")
   loader?: HTMLElement;

   render() {
      if (!this.bookmark) return;
      const isNew = this.bookmark.label.length == 0;

      return html`
         <ledit-overlay id="overlay" headerTitle="${isNew ? "New Mastodon account" : "Edit Mastodon account"}" .closeCallback=${() => this.remove()} .modal=${true}>
            <div slot="content" class="w-full flex flex-col gap-4 px-4 pt-4">
               <label class="font-bold">Account</label>
               <input @input=${this.idChanged.bind(this)} placeholder="E.g. 'mario@mastodon.social'" .value="${this.id}" />
               ${this.errorId.length > 0 ? html`<div class="text-xs text-red-600">${this.errorId}</div>` : ""}
               <label class="font-bold">Access token <a href="" class="text-primary text-sm">(What is this?)</a></label>
               <input @input=${this.accessTokenChanged.bind(this)} placeholder="E.g. '0baeEdahe342Hdh23h-24h2h3bhaT234i'" .value="${this.accessToken}" />
               ${this.errorToken.length > 0 ? html`<div class="text-xs text-red-600">${this.errorToken}</div>` : ""}
               <div class="flex items-center self-end gap-4">
                  <div id="loader" class="hidden fill-primary">${loaderIcon}</div>
                  ${this.errorConnect.length > 0 ? html`<div class="text-xs text-red-600">${this.errorConnect}</div>` : ""}
                  <button @click=${this.saveClicked.bind(this)} ?disabled=${this.id.length == 0 || this.accessToken.length == 0}>Save</button>
               </div>
            </div>
         </ledit-overlay>
      `;
   }

   idChanged(event: InputEvent) {
      this.id = (event.target as HTMLInputElement).value.trim();
      if (this.id.length == 0) {
         this.errorId = "Please specify a Mastodon account";
         return;
      }

      const tokens = this.id.split("@");
      if (tokens.length != 2) {
         this.errorId = "Invalid Mastodon account format. Should be 'user@instance'.";
         return;
      }

      if (tokens[0].trim().length == 0 || tokens[1].trim().length == 0) {
         this.errorId = "Invalid Mastodon account format. Should be 'user@instance'.";
         return;
      }

      if (
         this.bookmark?.label.length == 0 &&
         getSettings().bookmarks.find((bookmark) => bookmark.supplemental && bookmark.supplemental.username == tokens[0] && bookmark.supplemental.instance == tokens[1])
      ) {
         this.errorId = `Account '${this.id}' already exists.`;
         return;
      }
      this.errorId = "";
   }

   accessTokenChanged(event: InputEvent) {
      this.accessToken = (event.target as HTMLInputElement).value.trim();
      if (this.accessToken.length == 0) {
         this.errorToken = `Please specify an access token`;
         return;
      }
      this.errorToken = "";
   }

   async saveClicked() {
      if (!this.bookmark) return;
      const tokens = this.id.split("@");
      const user: MastodonUserInfo = { username: tokens[0], instance: tokens[1], bearer: this.accessToken };
      this.loader?.classList.toggle("hidden");
      const result = await MastodonApi.getHomeTimeline(null, user);
      if (result instanceof Error) {
         this.loader?.classList.toggle("hidden");
         this.errorConnect = `Could not authenticate user '${this.id}`;
         return;
      }

      // All good, save the bookmark and close.
      this.bookmark.label = this.id + "/home";
      this.bookmark.ids = [this.id + "/home"];
      this.bookmark.supplemental = { username: tokens[0], instance: tokens[1], bearer: this.accessToken } as MastodonUserInfo;

      const settings = getSettings();
      if (!settings.bookmarks.find((other) => JSON.stringify(other.supplemental) == JSON.stringify(this.bookmark?.supplemental))) {
         settings.bookmarks.push(this.bookmark);
      }

      saveSettings();
      const callback = () => {
         window.removeEventListener("hashchange", callback);
         navigate(bookmarkToHash(this.bookmark!));
      };
      window.addEventListener("hashchange", callback);
      this.overlay?.close();
   }
}

export function renderMastodonAccountEditor(params: Record<string, string>) {
   const accountBookmark =
      getSettings().bookmarks.find((bookmark) => bookmark.label == params["id"]) ??
      ({
         source: "m/",
         label: "",
         ids: [],
         isDefault: false,
         supplemental: { username: "", instance: "", bearer: null } as MastodonUserInfo,
      } as Bookmark);
   const editor = new MastodonAccountEditor();
   editor.bookmark = accountBookmark;
   document.body.append(editor);
}

@customElement("ledit-mastodon-profile")
export class MastodonProfileView extends LitElement {
   static styles = globalStyles;

   @property()
   account?: MastodonAccount;

   accountId: string;
   user?: MastodonUserInfo;
   relationship?: MastodonRelationship;

   @state()
   error?: Error;

   @state()
   what: "posts" | "followers" | "following" = "posts";

   @state()
   possiblyIncomplete = false;

   @query("#posts")
   posts?: ItemList;

   @query("#following")
   following?: ItemList;

   @query("#followers")
   followers?: ItemList;

   @query("#overlay")
   overlay?: Overlay;

   constructor() {
      super();
      const result = getWhats();
      if (result instanceof Error) {
         this.accountId = "Error";
         this.error = result;
         return;
      }
      const { user, whats } = result;
      this.user = user;

      this.accountId = whats[1]?.user + "@" + whats[1]?.instance;
      this.setAttribute("data-account", whats[1]?.user + "@" + whats[1]?.instance);

      (async () => {
         // Fetch account from original instance
         let account = await MastodonApi.lookupAccount(whats[1].user!, whats[1].instance!);
         if (account instanceof Error) {
            if (this.user) {
               this.possiblyIncomplete = true;
               account = await MastodonApi.lookupAccount(whats[1].user! + "@" + whats[1].instance, this.user.instance!);
               if (account instanceof Error) {
                  this.error = account;
                  return;
               }
            } else {
               this.error = account;
               return;
            }
         }
         account.fields.unshift({ name: "Joined", value: account.created_at.substring(0, 10), verified_at: null });

         // Try to fetch relationship
         if (this.user && account.username != this.user.username && account.instance && this.user.instance) {
            let resolvedAccount =
               account.instance == this.user.instance ? account : await MastodonApi.lookupAccount(account.username + "@" + new URL(account.url).host, this.user.instance);
            if (resolvedAccount instanceof Error) resolvedAccount = await MastodonApi.resolveAccount(account.url, this.user);
            if (resolvedAccount instanceof Error) {
               this.possiblyIncomplete = true;
               resolvedAccount = account;
            } else {
               const relationship = await MastodonApi.getRelationship(resolvedAccount.id, this.user);
               if (relationship instanceof Error) {
                  this.error = new Error(`Could not get relationship with account '${getAccountName(account)}'`);
                  return;
               }
               this.relationship = relationship;
            }
         }
         this.account = account;

         MastodonApi.getAccountPosts(this.account.id, this.account.instance, null, user).then((result) => {
            this.posts!.load(result, renderMastodonPost, async (nextPage) => await MastodonApi.getAccountPosts(this.account!.id, this.account!.instance, nextPage, user), user);
         });

         const renderMastodonAccount = (account: MastodonAccount, data?: MastodonUserInfo) => {
            return dom(html`
               <div class="flex items-center gap-2 px-4 w-full px-4 py-2 border-b border-border/50">
                  <img class="w-[2.5em] h-[2.5em] rounded-full" src="${account.avatar_static}" />
                  <div class="flex flex-col">
                     <a @click=${(event: Event) => showProfile(event, account, this.user)} class="flex inline-block text-sm text-color overflow-hidden gap-2 cursor-pointer">
                        <span class="font-bold overflow-hidden text-ellipsis">${getAccountName(account)}</span>
                        <span class="text-color/60 overflow-hidden text-ellipsis"
                           >${account.username + (this.user && this.user.instance == new URL(account.url).host ? "" : "@" + new URL(account.url).host)}</span
                        >
                     </a>
                     <span class="text-sm text-color/50">${addCommasToNumber(account.followers_count)} followers</span>
                  </div>
               </div>
            `);
         };

         MastodonApi.getFollowing(this.account, this.account.instance, null, user).then((result) => {
            this.following?.load(result, renderMastodonAccount, async (nextPage) => {
               return await MastodonApi.getFollowing(this.account!, this.account!.instance, nextPage, user);
            });
         });

         MastodonApi.getFollowers(this.account, this.account.instance, null, user).then((result) => {
            this.followers?.load(result, renderMastodonAccount, async (nextPage) => {
               return await MastodonApi.getFollowers(this.account!, this.account!.instance, nextPage, user);
            });
         });
      })();
   }

   render() {
      let relationshipLabel: string = "";
      if (this.relationship) {
         if (this.relationship.blocking) {
            relationshipLabel = "Blocked";
         }
         if (this.relationship.following) {
            relationshipLabel = "Following";
         } else {
            relationshipLabel = "Follow";
         }
      }

      return html`
         <ledit-overlay id="overlay" .closeCallback=${() => this.remove()}>
            <div slot="header" class="relative min-h-[4em]">
               <div class="cursor-pointer py-2 pl-2 pr-1 flex items-center text-lg bg-background border-b border-border/50" @click=${() => this.overlay?.close()}>
                  <span class="font-bold text-primary text-ellipsis overflow-hidden flex-1">${this.accountId}</span>
                  <header-button>${closeIcon}</header-button>
               </div>
            </div>
            <div slot="content" class="w-full flex flex-col gap-4">
               ${this.account && !this.account.header_static?.includes("missing.png")
                  ? html`<img src="${this.account.header_static}" class="max-h-[30vh] w-full object-cover object-center mt-[-1em]" />`
                  : ""}
               ${this.account
                  ? html`<div class="flex items-center gap-2 px-4">
                          <img class="w-[2.5em] h-[2.5em] rounded-full" src="${this.account.avatar_static}" />
                          <a
                             @click=${(event: Event) => showProfile(event, this.account!, this.user)}
                             class="flex inline-block flex-col text-sm text-color overflow-hidden cursor-pointer"
                          >
                             <span class="font-bold overflow-hidden text-ellipsis">${getAccountName(this.account)}</span>
                             <span class="text-color/60 overflow-hidden text-ellipsis"
                                >${this.account.username + (this.user && this.user.instance == new URL(this.account.url).host ? "" : "@" + new URL(this.account.url).host)}</span
                             >
                          </a>
                          ${this.relationship?.followed_by
                             ? html`<span class="ml-2 border border-border p-1 rounded grow-0 shrink-1 text-xs text-color/50">Follows you</span>`
                             : ""}
                          ${relationshipLabel.length > 0 ? html`<button class="ml-auto">${relationshipLabel}</button>` : ""}
                       </div>
                       ${this.possiblyIncomplete
                          ? html`<div class="border border-border/50 rounded p-4 text-center text-color/50">
                               <b>Warning</b>: information may be incomplete, as it was retrieved from '${this.account.instance}' and not from the original instance
                               '${new URL(this.account.url).host}'
                            </div>`
                          : ""}
                       <div class="content-text px-4">${safeHTML(this.account.note)}</div>
                       <div class="flex px-4">
                          <div class="flex flex-col">
                             ${map(
                                this.account.fields,
                                (field) => html` <div class="flex">
                                   <span class="font-bold mr-2 text-color/50">${field.name}:</span>
                                </div>`
                             )}
                          </div>
                          <div class="flex flex-col">
                             ${map(
                                this.account.fields,
                                (field) => html` <div class="flex items-center pr-2">
                                   <span>${safeHTML(field.value)}</span>
                                   ${field.verified_at ? html`<i class="icon ml-2">${checkmarkIcon}</i>` : ""}
                                </div>`
                             )}
                          </div>
                       </div>
                       <div class="pb-4 border-b border-border/50 px-4 text-sm items-center justify-center gap-2 w-full flex">
                          <button @click=${() => (this.what = "posts")} class="px-2 text-color border-border/50" ?data-selected=${this.what == "posts"}>
                             <span class="font-bold">${addCommasToNumber(this.account.statuses_count)}</span> Posts
                          </button>
                          <button @click=${() => (this.what = "following")} class="px-2 text-color border-border/50" ?data-selected=${this.what == "following"}>
                             <span class="font-bold">${addCommasToNumber(this.account.following_count)}</span> Following
                          </button>
                          <button @click=${() => (this.what = "followers")} class="px-2 text-color border-border/50" ?data-selected=${this.what == "followers"}>
                             <span class="font-bold">${addCommasToNumber(this.account.followers_count)}</span> Followers
                          </button>
                       </div>
                       <ledit-item-list id="posts" class="${this.what == "posts" ? "" : "hidden"}"></ledit-item-list>
                       <ledit-item-list id="following" class="${this.what == "following" ? "" : "hidden"}"></ledit-item-list>
                       <ledit-item-list id="followers" class="${this.what == "followers" ? "" : "hidden"}"></ledit-item-list> `
                  : !this.error
                  ? renderContentLoader()
                  : ""}
               ${this.error ? renderErrorMessage(`Could not load Mastodon account profile '${location.hash}'`, this.error) : ""}
            </div>
         </ledit-overlay>
      `;
   }
}

export function renderMastodonComment(comment: MastodonComment, data: { originalPost: MastodonPost; op: string; isReply: boolean; user?: MastodonUserInfo }): HTMLElement {
   const postToView = comment.post.reblog ?? comment.post;
   const highlight = comment.post.id == data.originalPost.id;

   const commentDom = dom(html`
      <div class="comment ${data.isReply ? "reply" : ""} ${highlight ? "!border-b-0 !border-l-2 !border-solid !border-primary" : ""}" data-id="${comment.post.id}">
         <div class="author flex gap-1 text-sm items-center text-color/50">
            <div class="flex items-center gap-2 w-full">
               <img class="w-[2em] h-[2em] rounded-full" src="${postToView.account.avatar_static}" />
               <a
                  @click=${(event: Event) => showProfile(event, postToView.account, data.user)}
                  class="flex flex-col inline-block text-sm text-color overflow-hidden cursor-pointer"
               >
                  <span class="font-bold overflow-hidden text-ellipsis">${getAccountName(postToView.account)}</span>
                  <span class="text-color/60 overflow-hidden text-ellipsis"
                     >${postToView.account.username +
                     (data.user && data.user.instance == new URL(postToView.account.url).host ? "" : "@" + new URL(postToView.account.url).host)}</span
                  >
               </a>
               <a href="${postToView.url}" class="ml-auto text-xs">${dateToText(new Date(postToView.created_at).getTime())}</a>
            </div>
         </div>
         <div x-id="contentDom" class="content">
            <div class="content-text">${replaceEmojis(postToView.content, postToView.emojis)}</div>
         </div>
      </div>
   `);

   const { contentDom, gallery } = elements<{ contentDom: HTMLElement; gallery?: HTMLElement }>(commentDom[0]);
   const repliesDom = dom(html` <div class="replies">${map(comment.replies, (reply) => renderMastodonComment(reply, { ...data, isReply: true }))}</div>`)[0];
   commentDom[0].append(repliesDom);

   onVisibleOnce(commentDom[0], () => {
      renderMastodonMedia(postToView, contentDom);
      setLinkTargetsToBlank(contentDom);
      if (gallery) {
         const img = contentDom.querySelector(".media img");
         if (img) {
            gallery.addEventListener("click", () => (img as HTMLElement).click());
         }
      }
   });

   return commentDom[0];
}

@customElement("ledit-mastodon-comments")
export class MastodonCommentsView extends LitElement {
   static styles = globalStyles;

   @property()
   data?: MastodonComments;

   @property()
   error?: Error;

   scrolled = false;

   protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
      if (this.scrolled) return;
      if (this.data) {
         const comment = this.shadowRoot?.querySelector(`[data-id="${this.data.originalPost.id}"] > .author`);
         if (!comment) {
            console.log("WTF");
         } else {
            this.scrolled = true;
            setTimeout(() => {
               comment.scrollIntoView({ behavior: "smooth", block: "center" });
            }, 250);
         }
      }
   }

   render() {
      const result = getWhats();
      let header = "";
      let id = "";
      if (result instanceof Error) {
         this.error = result;
         header = "Error";
      } else {
         const { whats } = result;
         header = "comments/" + whats[1].instance + "/" + whats[2].id;
         id = whats[1].instance + "/" + whats[2].id;
      }
      this.setAttribute("data-id", id);
      return html`
         <ledit-overlay headerTitle="${header}" .sticky=${true} .closeCallback=${() => this.remove()}>
            <div slot="content" class="w-full">
               ${this.data && this.data.possiblyIncomplete
                  ? html`<div class="border border-border/50 rounded p-4 text-center text-color/50 mb-4">
                       <b>Warning</b>: information may be incomplete, as it was retrieved from '${this.data.root.post.instance}' and not from the original instance
                       '${this.data.remoteInstance}'
                    </div>`
                  : ""}
               <div class="comments">
                  ${this.error ? renderErrorMessage("Could not load comments", this.error) : nothing}
                  ${this.data
                     ? renderComments([this.data.root], renderMastodonComment, {
                          originalPost: this.data.originalPost,
                          op: getAccountName(this.data.root.post.account, false) as string,
                          isReply: false,
                          user: result instanceof Error ? undefined : result.user,
                       })
                     : nothing}
                  ${!this.error && !this.data ? renderContentLoader() : nothing}
               </div>
            </div>
         </ledit-overlay>
      `;
   }
}
