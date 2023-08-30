import { html, nothing, render } from "lit-html";
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { Page, PageIdentifier, SortingOption, Source, SourcePrefix } from "./data";
import { Bookmark, bookmarkToHash, getSettings, saveSettings } from "./settings";
import { dom, makeOverlayModal, renderContentLoader, renderGallery, renderOverlay, renderPosts, renderVideo, safeHTML } from "./utils";
import { addCommasToNumber, dateToText, elements, navigate, onVisibleOnce, setLinkTargetsToBlank } from "../utils";
// @ts-ignore
import commentIcon from "remixicon/icons/Communication/chat-4-line.svg";
// @ts-ignore
import replyIcon from "remixicon/icons/Business/reply-line.svg";
// @ts-ignore
import starIcon from "remixicon/icons/System/star-line.svg";
// @ts-ignore
import reblogIcon from "remixicon/icons/Media/repeat-line.svg";
// @ts-ignore
import imageIcon from "remixicon/icons/Media/image-line.svg";
import { LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { Overlay } from "./overlay";
import { loaderIcon } from "./icons";

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

   static async getFollowing(account: MastodonAccount, instance: string, nextPage: PageIdentifier, userInfo: MastodonUserInfo): Promise<Page<MastodonAccount> | Error> {
      try {
         const following: MastodonAccount[] = [];
         if (!nextPage) nextPage = `https://${instance}/api/v1/accounts/${account.id}/following`;
         const response = await fetch(nextPage, instance == userInfo.instance ? this.getAuthHeader(userInfo) : undefined);
         if (response.status != 200) return new Error(`Could not get following list for account. Server responded with status code ${response.status}`);
         const result = (await response.json()) as MastodonAccount[];
         if (result.length == 0) return { items: [], nextPage: "end" };
         following.push(...result);
         nextPage = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
         return { items: following, nextPage: nextPage ?? "end" };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getFollowers(account: MastodonAccount, instance: string, nextPage: string | null, userInfo: MastodonUserInfo): Promise<Page<MastodonAccount> | Error> {
      try {
         const following: MastodonAccount[] = [];
         if (!nextPage) nextPage = `https://${instance}/api/v1/accounts/${account.id}/followers`;
         const response = await fetch(nextPage, instance == userInfo.instance ? this.getAuthHeader(userInfo) : undefined);
         if (response.status != 200) return new Error(`Could not get following list for account. Server responded with status code ${response.status}`);
         const result = (await response.json()) as MastodonAccount[];
         if (result.length == 0) return { items: [], nextPage: "end" };
         following.push(...result);
         nextPage = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
         return { items: following, nextPage: nextPage ?? "end" };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getNotifications(nextPage: PageIdentifier, userInfo: MastodonUserInfo, sinceId: string | null = null): Promise<Page<MastodonNotification> | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      try {
         const options = this.getAuthHeader(userInfo);
         if (!nextPage) nextPage = `https://${userInfo.instance}/api/v1/notifications?limit=20${sinceId ? "&sinceId=" + sinceId : ""}}`;
         const response = await fetch(nextPage, options);
         if (response.status != 200) return new Error(`Could not get notifications for account. Server responded with status code ${response.status}`);
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
      replacedText = replacedText.replace(
         shortcodeRegExp,
         `<div class="inline-flex items-center align-middle h-[1.5em]"><img class="w-[1em] h-[1em]" src="${emoji.url}" alt="${emoji.shortcode}"></div>`
      );
   }

   return html`${safeHTML(replacedText)}`;
}

function getAccountName(account: MastodonAccount, shouldReplaceEmojis = false) {
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

export type MastodonUserInfo = { username: string; instance: string; bearer: string | null };
export type MastodonPostData = { mastodonPost: MastodonPost; userInfo: MastodonUserInfo; id: string; inReplyToPost: MastodonPost | null };
export type MastodonCommentData = { mastodonComment: MastodonPost; userInfo: MastodonUserInfo };

export class MastodonSource extends Source<MastodonPost> {
   constructor(feed: string) {
      super(feed);
   }

   async getPosts(nextPage: PageIdentifier): Promise<Error | Page<MastodonPost>> {
      const feedTokens = this.getFeed().split("/");
      if (feedTokens.length == 0)
         return new Error(`Invalid Mastodon feed ${this.getFeed()}. Must be a user name, e.g. @badlogic@mastodon.gamedev.place, or an instance name, e.g. mastodon.gamedev.place.`);

      const user = getUserInfo(feedTokens[0].trim(), true);

      // Read-only urls
      if (user == null) {
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

      return new Error(`Invalid Mastodon feed ${this.getFeed()}`);
   }

   async renderMain(main: HTMLElement) {
      const feedTokens = this.getFeed().split("/");
      if (feedTokens.length == 0)
         throw new Error(`Invalid Mastodon feed ${this.getFeed()}. Must be a user name, e.g. @badlogic@mastodon.gamedev.place, or an instance name, e.g. mastodon.gamedev.place.`);

      const user = getUserInfo(feedTokens[0].trim());
      const loader = renderContentLoader();
      main.append(loader);
      const page = await this.getPosts(null);
      loader.remove();
      renderPosts(
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

export function renderMastodonMedia(post: MastodonPost, contentDom: HTMLElement) {
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
   contentDom.append(mediaDom);
}

export function renderMastodonPost(post: MastodonPost, user?: MastodonUserInfo) {
   const postToView = post.reblog ?? post;
   const postDom = dom(html` <article class="post mastodon-post gap-2">
      ${
         post.reblog
            ? html`<div class="flex items-center gap-2 text-sm text-color/60 overflow-hidden">
                 <span>Boosted by</span>
                 <img class="w-[1.5em] h-[1.5em] rounded-full" src="${post.account.avatar_static}" />
                 <span class="overflow-hidden text-ellipsis">${getAccountName(post.account)}</span>
              </div>`
            : ""
      }
      <div class="flex items-center gap-2">
         <img class="w-[2.5em] h-[2.5em] rounded-full" src="${postToView.account.avatar_static}" />
         <a href="${postToView.account.url}" class="flex inline-block flex-col text-sm text-color overflow-hidden">
            <span class="font-bold overflow-hidden text-ellipsis">${getAccountName(postToView.account)}</span>
            <span class="text-color/60 overflow-hidden text-ellipsis"
               >${postToView.account.username + (user && user.instance == new URL(postToView.account.url).host ? "" : "@" + new URL(postToView.account.url).host)}</span
            >
         </a>
         <a href="${postToView.url}" class="ml-auto text-xs self-start">${dateToText(new Date(postToView.created_at).getTime())}</a>
      </div>
      ${
         postToView.in_reply_to_post
            ? html` <div class="flex items-center gap-1 text-sm text-color/60 overflow-hidden">
                 <span>In reply to</span>
                 <img class="w-[1.5em] h-[1.5em] rounded-full" src="${postToView.in_reply_to_post.account.avatar_static}" />
                 <span class="overflow-hidden text-ellipsis">${getAccountName(postToView.in_reply_to_post.account)}</span>
              </div>`
            : ""
      }
      <div x-id="contentDom" class="content">
         <div class="content-text">${replaceEmojis(postToView.content, postToView.emojis)}</div>
      </div>
      <div class="flex justify-between min-w-[320px] max-w-[320px] mx-auto">
         <a href="" class="self-link flex items-center gap-1 h-[2em]">
            <i class="icon fill-color/60">${unsafeHTML(commentIcon)}</i>
            <span class="text-color/60">${addCommasToNumber(postToView.replies_count)}</span>
         </span>
         <a href="" class="flex items-center gap-1 h-[2em]">
            <i class="icon fill-color/70">${unsafeHTML(replyIcon)}</i>
            <span class="text-color/60">Reply</span>
         </a>
         <a href="" class="flex items-center gap-1 h-[2em]">
            <i class="icon ${postToView.reblogged ? "fill-primary" : "fill-color/60"}">${unsafeHTML(reblogIcon)}</i>
            <span class="text-color/60">${addCommasToNumber(postToView.reblogs_count)}</span>
         </a>
         <a href="" class="flex items-center gap-1 h-[2em]">
            <i class="icon ${postToView.favourited ? "fill-primary" : "fill-color/60"}">${unsafeHTML(starIcon)}</i>
            <span class="text-color/60">${addCommasToNumber(postToView.favourites_count)}</span>
         </a>
         ${
            postToView.media_attachments.length > 1
               ? html` <span class="flex items-center gap-1 cursor-pointer h-[2em]" x-id="gallery">
                    <i class="icon fill-color/70">${unsafeHTML(imageIcon)}</i>
                    <span class="text-color/70">${postToView.media_attachments.length}</span>
                 </span>`
               : ""
         }
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
      this.bookmark.label = this.id;
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
