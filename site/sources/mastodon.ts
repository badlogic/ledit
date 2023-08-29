import { html, render } from "lit-html";
import { Page, PageIdentifier, SortingOption, Source, SourcePrefix } from "./data";
import { Bookmark, bookmarkToHash, getSettings, saveSettings } from "./settings";
import { dom, makeOverlayModal, renderContentLoader, renderOverlay, renderPosts } from "./utils";
import { elements, navigate } from "../utils";
// @ts-ignore
import loaderIcon from "../svg/loader.svg";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";


const mastodonUserIds = localStorage.getItem("mastodonCache") ? JSON.parse(localStorage.getItem("mastodonCache")!) : {};

interface MastodonAccount {
   acct: string;
   avatar: string | null;
   avatar_static: string | null;
   bot: boolean;
   created_at: string;
   discoverable: boolean;
   display_name: string | null;
   followers_count: number;
   following_count: number;
   header: string | null;
   header_static: string | null;
   id: string;
   last_status_at: string;
   locked: boolean;
   noindex: boolean;
   note: string | null;
   statuses_count: number;
   url: string;
   username: string;
   emojis: MastodonEmoji[];
}

interface MastodonRelationship {
   id: string;
   following: boolean;
   showing_reblogs: boolean;
   notifying: boolean;
   followed_by: boolean;
   blocking: boolean;
   blocked_by: boolean;
   muting: boolean;
   muting_notifications: boolean;
   requested: boolean;
   domain_blocking: boolean;
   endorsed: boolean;
   note: string;
}

interface MastodonMention {
   acct: string;
   id: string;
   url: string;
   username: string;
}

interface MastodonMedia {
   id: string;
   type: "image" | "gifv" | "video" | "audio";
   url: string;
   meta: {
      original:
         | {
              width: number;
              height: number;
              aspect: number;
           }
         | undefined;
   };
}

interface MastodonEmoji {
   shortcode: string;
   url: string;
   static_url: string;
}

interface MastodonCard {}

interface MastodonPoll {
   options: { title: string; votes_count: number }[];
   voters_count: number;
   votes_count: number;
}

interface MastodonPost {
   account: MastodonAccount;
   content: string;
   card: MastodonCard;
   created_at: string;
   edited_at: string | null;
   favourited: boolean;
   favourites_count: number;
   id: string;
   in_reply_to_account_id: string | null;
   in_reply_to_id: string | null;
   in_reply_to_post: MastodonPost | null;
   media_attachments: MastodonMedia[];
   metions: MastodonMention;
   poll: MastodonPoll;
   reblog: MastodonPost | null;
   reblogged: boolean;
   reblogs_count: number;
   replies_count: number;
   sensitive: boolean;
   spoiler_text: string;
   uri: string;
   url: string;
   visibility: string;
   userInfo: MastodonUserInfo | undefined;
   emojis: MastodonEmoji[];
}

interface MastodonNotification {
   id: string;
   type: "mention" | "status" | "reblog" | "follow" | "follow_request" | "favourite" | "poll" | "update";
   created_at: string;
   account: MastodonAccount;
   status: MastodonPost | null;
}

interface MastodonPostContext {
   ancestors: MastodonPost[];
   descendants: MastodonPost[];
}

export class MastodonApi {
   static getAuthHeader(userInfo: MastodonUserInfo): RequestInit {
      return !userInfo.bearer
         ? {}
         : {
              headers: { Authorization: `Bearer ${userInfo.bearer}` },
           };
   }

   static async resolvePost(postUrl: string, userInfo: MastodonUserInfo): Promise<MastodonPost | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v2/search/?q=${postUrl}&resolve=true`, options);
         if (response.status != 200) return new Error(`Could not resolve post. Server responded with status code ${response.status}`);
         const searchResult = (await response.json()) as { statuses: MastodonPost[] };
         if (searchResult.statuses.length == 0) return new Error(`Post ${postUrl} could not be found.`);
         return searchResult.statuses[0];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getPost(postId: string, instance: string, userInfo?: MastodonUserInfo): Promise<MastodonPost | Error> {
      try {
         const options = userInfo && userInfo.instance == instance ? this.getAuthHeader(userInfo) : {};
         const response = await fetch(`https://${instance}/api/v1/statuses/${postId}`, options);
         if (response.status != 200) return new Error(`Could not load post. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonPost;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getPostContext(postId: string, userInfo: MastodonUserInfo): Promise<MastodonPostContext | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/statuses/${postId}/context`, options);
         if (response.status != 200) return new Error(`Could not load post context. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonPostContext;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async lookupAccount(userName: string, instance: string): Promise<MastodonAccount | Error> {
      try {
         const response = await fetch("https://" + instance + "/api/v1/accounts/lookup?acct=" + userName);
         if (response.status != 200) return new Error(`Could not look up account. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonAccount;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async resolveAccount(accountUrl: string, userInfo: MastodonUserInfo): Promise<MastodonAccount | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v2/search/?q=${accountUrl}&resolve=true`, options);
         if (response.status != 200) return new Error(`Could not resolve account. Server responded with status code ${response.status}`);
         const searchResult = (await response.json()) as { accounts: MastodonAccount[]; statuses: MastodonPost[] };
         if (searchResult.accounts.length == 0) return new Error(`Account ${accountUrl} could not be found.`);
         return searchResult.accounts[0];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getAccountPosts(accountId: string, maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/accounts/${accountId}/statuses?limit=20${maxId ? maxId : ""}`, options);
         if (response.status != 200) return new Error(`Could not get posts for account. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonPost[];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getRelationship(otherAccountId: string, userInfo: MastodonUserInfo): Promise<MastodonRelationship | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch("https://" + userInfo.instance + "/api/v1/accounts/relationships?id[]=" + otherAccountId, options);
         if (response.status != 200) return new Error(`Could not load relationship. Server responded with status code ${response.status}`);
         return (await response.json())[0] as MastodonRelationship;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getFollowing(
      account: MastodonAccount,
      instance: string,
      nextPage: PageIdentifier,
      userInfo: MastodonUserInfo
   ): Promise<Page<MastodonAccount> | Error> {
      try {
         const following: MastodonAccount[] = [];
         if (!nextPage) nextPage = `https://${instance}/api/v1/accounts/${account.id}/following`;
         const response = await fetch(nextPage, instance == userInfo.instance ? this.getAuthHeader(userInfo) : undefined);
         if (response.status != 200)
            return new Error(`Could not get following list for account. Server responded with status code ${response.status}`);
         const result = (await response.json()) as MastodonAccount[];
         if (result.length == 0) return { items: [], nextPage: "end" };
         following.push(...result);
         nextPage = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
         return { items: following, nextPage: nextPage ?? "end" };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getFollowers(
      account: MastodonAccount,
      instance: string,
      nextPage: string | null,
      userInfo: MastodonUserInfo
   ): Promise<Page<MastodonAccount> | Error> {
      try {
         const following: MastodonAccount[] = [];
         if (!nextPage) nextPage = `https://${instance}/api/v1/accounts/${account.id}/followers`;
         const response = await fetch(nextPage, instance == userInfo.instance ? this.getAuthHeader(userInfo) : undefined);
         if (response.status != 200)
            return new Error(`Could not get following list for account. Server responded with status code ${response.status}`);
         const result = (await response.json()) as MastodonAccount[];
         if (result.length == 0) return { items: [], nextPage: "end" };
         following.push(...result);
         nextPage = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
         return { items: following, nextPage: nextPage ?? "end" };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getNotifications(
      nextPage: PageIdentifier,
      userInfo: MastodonUserInfo,
      sinceId: string | null = null
   ): Promise<Page<MastodonNotification> | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      try {
         const options = this.getAuthHeader(userInfo);
         if (!nextPage) nextPage = `https://${userInfo.instance}/api/v1/notifications?limit=20${sinceId ? "&sinceId=" + sinceId : ""}}`;
         const response = await fetch(nextPage, options);
         if (response.status != 200)
            return new Error(`Could not get notifications for account. Server responded with status code ${response.status}`);
         const result = (await response.json()) as MastodonNotification[];
         if (result.length == 0) return { items: [], nextPage: "end" };
         const notifications: MastodonNotification[] = [];
         notifications.push(...result);
         nextPage = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
         return { items: notifications, nextPage: nextPage ?? "end" };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async dismissNotifications(userInfo: MastodonUserInfo): Promise<boolean> {
      try {
         const url = `https://${userInfo.instance}/api/v1/notifications/clear`;
         const options = {
            method: "POST",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
         const response = await fetch(url, options);
         return response.status == 200;
      } catch (e) {
         return false;
      }
   }

   static async getHomeTimeline(maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/timelines/home?limit=20${maxId ? maxId : ""}`, options);
         if (response.status != 200) return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonPost[];
      } catch (e) {
         return new Error("Networking error.");
      }
   }

   static async getLocalTimeline(maxId: string | null, instance: string, userInfo?: MastodonUserInfo): Promise<MastodonPost[] | Error> {
      try {
         const options = userInfo && userInfo.instance == instance ? this.getAuthHeader(userInfo) : {};
         const response = await fetch(`https://${instance}/api/v1/timelines/public?local=true&limit=20${maxId ? maxId : ""}`, options);
         if (response.status != 200) return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonPost[];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getEmojis(instance: string): Promise<MastodonEmoji[] | Error> {
      try {
         const response = await fetch(`https://${instance}/api/v1/custom_emojis`);
         if (response.status != 200) return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonEmoji[];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async publishPost(replyTo: MastodonPost | null, text: string, userInfo: MastodonUserInfo): Promise<MastodonPost | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      const resolvedPost = replyTo ? await this.resolvePost(replyTo.uri, userInfo) : null;
      if (resolvedPost instanceof Error) return new Error("Could not resolve post to reply to.");
      try {
         const response = await fetch(`https://${userInfo.instance}/api/v1/statuses`, {
            method: "POST",
            headers: {
               Authorization: `Bearer ${userInfo.bearer}`,
               "Content-Type": "application/json",
            },
            body: JSON.stringify(replyTo ? { status: text, in_reply_to_id: resolvedPost?.id } : { status: text }),
         });
         const json = await response.json();
         if (response.status != 200) {
            console.error(JSON.stringify(json));
            return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         }
         return json as MastodonPost;
      } catch (e) {
         console.error("Couldn't publish post.", e);
         return new Error("Network error.");
      }
   }

   static async reblogPost(post: MastodonPost, userInfo: MastodonUserInfo): Promise<boolean> {
      try {
         const resolvedPost = await this.resolvePost(post.uri, userInfo);
         if (resolvedPost instanceof Error) return false;
         const url = `https://${userInfo.instance}/api/v1/statuses/${resolvedPost.id}/${post.reblogged ? "reblog" : "unreblog"}`;
         const options = {
            method: "POST",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
         const response = await fetch(url, options);
         return response.status == 200;
      } catch (e) {
         return false;
      }
   }

   static async favouritePost(post: MastodonPost, userInfo: MastodonUserInfo): Promise<boolean> {
      try {
         const resolvedPost = await this.resolvePost(post.uri, userInfo);
         if (resolvedPost instanceof Error) return false;
         const url = `https://${userInfo.instance}/api/v1/statuses/${resolvedPost.id}/${post.favourited ? "favourite" : "unfavourite"}`;
         const options = {
            method: "POST",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
         const response = await fetch(url, options);
         return response.status == 200;
      } catch (e) {
         return false;
      }
   }

   static async followAccount(account: MastodonAccount, follow: boolean, userInfo: MastodonUserInfo): Promise<boolean> {
      try {
         const resolveAccount = await this.resolveAccount(account.url, userInfo);
         if (resolveAccount instanceof Error) return false;
         const url = `https://${userInfo.instance}/api/v1/accounts/${resolveAccount.id}/${follow ? "follow" : "unfollow"}`;
         const options = {
            method: "POST",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
         const response = await fetch(url, options);
         return response.status == 200;
      } catch (e) {
         return false;
      }
   }
}

function replaceEmojis(text: string, emojis: MastodonEmoji[]) {
   let replacedText = text;

   for (const emoji of emojis) {
      const shortcodeRegExp = new RegExp(`:${emoji.shortcode}:`, "g");
      replacedText = replacedText.replace(shortcodeRegExp, `<img class="mastodon-emoji" src="${emoji.url}" alt="${emoji.shortcode}">`);
   }

   return replacedText;
}

function getAccountName(account: MastodonAccount, shouldReplaceEmojis = false) {
   let name = account.display_name && account.display_name.length > 0 ? account.display_name : account.username;
   if (shouldReplaceEmojis) {
      return `<span class="mastodon-emoji-container">${replaceEmojis(name, account.emojis)}</span>`;
   } else {
      return name;
   }
}

function getUserInfo(input: string, requireToken = false): MastodonUserInfo | null {
   let username = "";
   let instance = "";
   let bearer: string | null = null;

   if (input.startsWith("@")) input = input.substring(1);
   const tokens = input.split("@");
   if (tokens.length != 2) {
      return null;
   }
   username = tokens[0];
   instance = tokens[1];

   for (const bookmark of getSettings().bookmarks) {
      if (
         bookmark.source == "m/" &&
         bookmark.supplemental &&
         bookmark.supplemental.username == username &&
         bookmark.supplemental.instance == instance
      ) {
         bearer = bookmark.supplemental.bearer;
      }
   }
   if (requireToken && !bearer) return null;
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

export type MastodonUserInfo = { username: string; instance: string; bearer: string | null };
export type MastodonPostData = { mastodonPost: MastodonPost; userInfo: MastodonUserInfo; id: string; inReplyToPost: MastodonPost | null };
export type MastodonCommentData = { mastodonComment: MastodonPost; userInfo: MastodonUserInfo };

export class MastodonSource extends Source<MastodonPost> {
   public readonly user;

   constructor(feed: string) {
      super(feed);
      this.user = getUserInfo(feed, true);
   }

   async getPosts(nextPage: PageIdentifier): Promise<Error | Page<MastodonPost>> {
      const user = this.user;

      // Read-only urls
      if (this.user == null) {
         const feedTokens = this.getFeed().split("@");
         let mastodonPosts: MastodonPost[] | null = null;
         if (feedTokens.length == 1 || feedTokens[1].trim().length == 0) {
            const result = await MastodonApi.getLocalTimeline(nextPage, feedTokens[0]);
            if (result instanceof Error) return result;
            mastodonPosts = result;
         } else {
            const what = this.getFeed();
            let userInfo = getUserInfo(what);
            if (!userInfo) return new Error(`Invalid Mastodon feed ${this.getFeed()}`);
            const resultAccount = await MastodonApi.lookupAccount(what, userInfo.instance);
            if (resultAccount instanceof Error) return resultAccount;
            const mastodonAccount = resultAccount;
            const resultPosts = await MastodonApi.getAccountPosts(mastodonAccount.id, nextPage, userInfo);
            if (resultPosts instanceof Error) return resultPosts;
            mastodonPosts = resultPosts;
         }

         if (!mastodonPosts) return new Error(`Invalid Mastodon feed ${this.getFeed()}`);

         let maxId: string | null = null;
         if (mastodonPosts) {
            maxId = mastodonPosts.length == 0 ? "end" : mastodonPosts[mastodonPosts.length - 1].id;
         }
         if (maxId != "end") {
            maxId = maxId ? `&max_id=${maxId}` : "";
         }

         const inReplyToPromises: Promise<MastodonPost | Error>[] = [];
         for (const post of mastodonPosts) {
            const postToView = post.reblog ?? post;
            if (postToView.in_reply_to_id) {
               inReplyToPromises.push(MastodonApi.getPost(postToView.in_reply_to_id, new URL(postToView.uri).host));
            }
         }
         const inReplyToPosts: (MastodonPost | Error)[] = await Promise.all(inReplyToPromises);
         let idx = 0;
         for (const post of mastodonPosts) {
            if (post.in_reply_to_id) {
               const inReplyToPost = inReplyToPosts[idx++];
               post.in_reply_to_post = inReplyToPost instanceof Error ? null : inReplyToPost;
            }
         }

         return { items: mastodonPosts, nextPage: maxId };
      }

      // Read/write urls
      /*if (feedTokens.length == 1) {
         feedTokens.push("");
      }

      if (feedTokens.length == 2) {
         let what = feedTokens[1].trim();

         let mastodonAccount: MastodonAccount | null = null;
         let mastodonPosts: MastodonPost[] | null = null;
         if (what == "home") {
            if (!userInfo.bearer) {
               return new Error(`You must add a Mastodon account for ${userInfo.username}@${userInfo.instance}.`);
            }
            const result = await MastodonApi.getHomeTimeline(nextPage, userInfo);
            if (result instanceof Error) return result;
            mastodonPosts = result;
         } else if (what == "local") {
            const result = await MastodonApi.getLocalTimeline(nextPage, userInfo);
            if (result instanceof Error) return result;
            mastodonPosts = result;
         } else if (what.includes("@@")) {
            what = what.substring(1);
            if (!userInfo.bearer) {
               return new Error(`You must add a Mastodon account for ${userInfo.username}@${userInfo.instance}.`);
            }
            let otherUserInfo = getUserInfo(what);
            if (!otherUserInfo || otherUserInfo.instance == userInfo.instance) otherUserInfo = userInfo;
            let resultAccount = await MastodonApi.lookupAccount(what, otherUserInfo.instance);
            // Remote instance doesn't allow lookup, fetch profile info from our instance
            if (resultAccount instanceof Error) {
               otherUserInfo = userInfo;
               resultAccount = await MastodonApi.lookupAccount(what, otherUserInfo.instance);
               if (resultAccount instanceof Error) return resultAccount;
            }
            mastodonAccount = resultAccount;
            const resultPosts = await MastodonApi.getAccountPosts(mastodonAccount.id, nextPage, otherUserInfo);
            if (resultPosts instanceof Error) return resultPosts;
            mastodonPosts = resultPosts;
            for (const mastodonPost of resultPosts) {
               mastodonPost.userInfo = otherUserInfo;
            }
         } else if (what.includes("@")) {
            if (!userInfo.bearer) {
               return new Error(`You must add a Mastodon account for ${userInfo.username}@${userInfo.instance}.`);
            }
            let otherUserInfo = getUserInfo(what);
            if (!otherUserInfo || otherUserInfo.instance == userInfo.instance) otherUserInfo = userInfo;
            let resultAccount = await MastodonApi.lookupAccount(what, otherUserInfo.instance);
            // Remote instance doesn't allow lookup, fetch profile info from our instance
            if (resultAccount instanceof Error) {
               otherUserInfo = userInfo;
               resultAccount = await MastodonApi.lookupAccount(what, otherUserInfo.instance);
               if (resultAccount instanceof Error) return resultAccount;
            }
            mastodonAccount = resultAccount;
            if (nextPage == null) {
               document.body.append(new MastodonUserProfileOverlayView(mastodonAccount, userInfo));
            }
            const result = await MastodonApi.getHomeTimeline(nextPage, userInfo);
            if (result instanceof Error) return result;
            mastodonPosts = result;
         } else if (what == "notifications") {
            if (nextPage == null) {
               document.body.append(new MastodonNotificationsOverlayView(userInfo));
            }
            const result = await MastodonApi.getHomeTimeline(nextPage, userInfo);
            if (result instanceof Error) return result;
            mastodonPosts = result;
         } else if (what.length == 0) {
            const resultAccount = await MastodonApi.lookupAccount(userInfo.username, userInfo.instance);
            if (resultAccount instanceof Error) return resultAccount;
            mastodonAccount = resultAccount;
            const resultPosts = await MastodonApi.getAccountPosts(mastodonAccount.id, nextPage, userInfo);
            if (resultPosts instanceof Error) return resultPosts;
            mastodonPosts = resultPosts;
            for (const mastodonPost of mastodonPosts) {
               mastodonPost.userInfo = userInfo;
            }
         } else {
            const post = await MastodonApi.getPost(what, userInfo);
            if (post instanceof Error) return post;
            mastodonPosts = [post];
         }

         const posts: Post<MastodonPostData>[] = [];
         if (mastodonAccount && !nextPage) {
            // FIXME show account info + posts + following + follows
         }

         let maxId: string | null = null;
         if (mastodonPosts) {
            maxId = mastodonPosts.length == 0 ? "end" : mastodonPosts[mastodonPosts.length - 1].id;
         }
         if (maxId != "end") {
            maxId = maxId ? `&max_id=${maxId}` : "";
         }

         if (mastodonPosts) {
            const postPromises: Promise<Post<MastodonPostData> | null>[] = [];
            for (const mastodonPost of mastodonPosts) {
               postPromises.push(MastodonSource.mastodonPostToPost(mastodonPost, getSettings().showOnlyMastodonRoots, userInfo));
            }
            const resolvedPosts = await Promise.all(postPromises);
            for (const post of resolvedPosts) {
               if (post) posts.push(post);
            }
         }

         if (nextPage == null && userInfo.bearer && !this.hideActionButtons) {
            this.showActionButtons(userInfo);
         }

         return { items: posts, nextPage: maxId };
      }*/

      return new Error(`invaInvalid Mastodon feed ${this.getFeed()}`);
   }

   async renderMain(main: HTMLElement) {
      const loader = renderContentLoader();
      main.append(loader);
      const page = await this.getPosts(null);
      loader.remove();
      renderPosts(main, page, renderMastodonPost, (nextPage: PageIdentifier) => {
         return this.getPosts(nextPage);
      })
   }

   getSortingOptions(): SortingOption[] {
      return [];
   }
}

export function renderMastodonPost(post: MastodonPost) {
   return dom(html`<article class="post mastodon-post">Mastodon post</article>`);
}

export function renderMastodonAccountEditor(params: Record<string, string>) {
   const accountBookmark =
      getSettings().bookmarks.find((bookmark) => bookmark.label == params["id"]) ??
      ({
         source: "m/",
         label: "",
         ids: [],
         isDefault: false,
         supplemental: {username: "", instance: "", bearer: null} as MastodonUserInfo,
      } as Bookmark);
   const isNew = accountBookmark.label.length == 0;

   const accountEditorTemplate = (user: MastodonUserInfo, errorId: string, errorToken: string, errorConnect: string) => html`
      <div class="w-full flex flex-col gap-4 px-4 pt-4">
         <label class="font-bold">Account</label>
         <input x-id="id" placeholder="E.g. 'mario@mastodon.social'" .value="${user.username.length > 0 ? user.username + "@" + user.instance : ""}" />
         ${errorId.length > 0 ? html`<div class="text-xs text-red-600">${errorId}</div>` : ""}
         <label class="font-bold">Access token <a href="" class="text-primary text-sm">(What is this?)</a></label>
         <input x-id="token" placeholder="E.g. 'mario@mastodon.social'" .value="${user.bearer}" />
         ${errorToken.length > 0 ? html`<div class="text-xs text-red-600">${errorToken}</div>` : ""}
         <div class="flex items-center self-end gap-4">
            <div x-id="loader" class="hidden fill-primary">${unsafeHTML(loaderIcon)}</div>
            ${errorConnect.length > 0 ? html`<div class="text-xs text-red-600">${errorConnect}</div>` : ""}
            <button x-id="save">Save</button>
         </div>
      </div>
   `;
   const overlay = renderOverlay(`New Mastodon account`);
   render(accountEditorTemplate(accountBookmark.supplemental, "", "", ""), overlay.dom);
   makeOverlayModal(overlay);

   const { id, token, save, loader } = elements<{ id: HTMLInputElement; token: HTMLInputElement; save: HTMLButtonElement; loader: HTMLElement }>(
      overlay.dom
   );
   save.addEventListener("click", async () => {
      const settings = getSettings();
      const idValue = id.value.trim();
      if (idValue.length == 0) {
         render(accountEditorTemplate(accountBookmark.supplemental, "Please specify a Mastodon account", "", ""), overlay.dom);
         id.focus();
         return;
      }
      const tokens = idValue.split("@");
      if (tokens.length != 2) {
         render(accountEditorTemplate(accountBookmark.supplemental, "Invalid Mastodon account format. Should be 'user@instance'.", "", ""), overlay.dom);
         id.focus();
         return;
      }
      if (isNew && settings.bookmarks.find((bookmark) => bookmark.supplemental && bookmark.supplemental.username == tokens[0] && bookmark.supplemental.instance == tokens[1])) {
         render(accountEditorTemplate(accountBookmark.supplemental, `Account '${idValue}' already exists.`, "", ""), overlay.dom);
         id.focus();
         return;
      }

      const tokenValue = token.value.trim();
      if (tokenValue.length == 0) {
         render(accountEditorTemplate(accountBookmark.supplemental, "", `Please specify an access token`, ""), overlay.dom);
         token.focus();
         return;
      }

      const user: MastodonUserInfo = { username: tokens[0], instance: tokens[1], bearer: tokenValue };
      id.disabled = token.disabled = save.disabled = true;
      loader.classList.toggle("hidden");
      const result = await MastodonApi.getHomeTimeline(null, user);
      if (result instanceof Error) {
         id.disabled = token.disabled = save.disabled = false;
         loader.classList.toggle("hidden");
         render(accountEditorTemplate(accountBookmark.supplemental, "", "", `Could not authenticate user '${idValue}.`), overlay.dom);
         return;
      }

      // All good, save the bookmark and close.
      accountBookmark.label = idValue;
      accountBookmark.ids = [idValue + "/home"];
      accountBookmark.supplemental = {username: idValue.split("@")[0], instance: idValue.split("@")[1], bearer: tokenValue } as MastodonUserInfo;

      if (!settings.bookmarks.find((other) =>JSON.stringify(other.supplemental) == JSON.stringify(accountBookmark.supplemental))) {
         settings.bookmarks.push(accountBookmark);
      }

      saveSettings();
      const callback = () => {
         window.removeEventListener("hashchange", callback);
         navigate(bookmarkToHash(accountBookmark));
      };
      window.addEventListener("hashchange", callback);
      overlay.close();
   });
}