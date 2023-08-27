// @ts-ignore
// import { CommentView } from "../comments";
import { Page, PageIdentifier, SortingOption, Source, SourcePrefix } from "./data";
import { PostEditor } from "../post-editor";

import { OverlayView, PagedListView, View } from "../view";

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

   static async getPost(postId: string, userInfo: MastodonUserInfo): Promise<MastodonPost | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/statuses/${postId}`, options);
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

   static async getFollowers(account: MastodonAccount, instance: string, nextPage: string | null, userInfo: MastodonUserInfo): Promise<Page<MastodonAccount> | Error> {
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

   static async getNotifications(nextPage: PageIdentifier, userInfo: MastodonUserInfo, sinceId: string | null = null): Promise<Page<MastodonNotification> | Error> {
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

   static async getLocalTimeline(maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/timelines/public?local=true&limit=20${maxId ? maxId : ""}`, options);
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

function getUserInfo(input: string): MastodonUserInfo | null {
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

export class MastodonSource extends Source<MastodonPostData> {
   constructor(feed: string, readonly hideActionButtons = false) {
      super(feed);
   }

   static async mastodonPostToPost(
      mastodonPost: MastodonPost,
      onlyShowRoots: boolean,
      userInfo: MastodonUserInfo
   ): Promise<Post<MastodonPostData> | null> {
      let postToView = mastodonPost.reblog ?? mastodonPost;
      if (onlyShowRoots && postToView.in_reply_to_account_id) return null;
      let postUrl = postToView.url;

      let inReplyToPost: MastodonPost | Error | null = null;
      if (postToView.in_reply_to_id) {
         inReplyToPost = (await MastodonApi.getPost(postToView.in_reply_to_id, mastodonPost.userInfo ?? userInfo)) ?? inReplyToPost;
         if (inReplyToPost instanceof Error) {
            inReplyToPost = null;
         }
      }

      return {
         url: postUrl,
         feed: "",
         title: "",
         author: getAccountName(mastodonPost.account),
         createdAt: new Date(postToView.created_at).getTime() / 1000,
         numComments: postToView.replies_count + (inReplyToPost && postToView.replies_count == 0 ? 1 : 0),
         data: {
            mastodonPost,
            userInfo,
            id: mastodonPost.id,
            inReplyToPost,
         },
      };
   }

   static mastodonPostToComment(reply: MastodonPost, highlight: boolean, userInfo: MastodonUserInfo): Comment<MastodonCommentData> {
      const content = MastodonSource.getPostOrCommentContentDom(reply, null, userInfo, true);
      return {
         url: reply.url,
         author: getAccountName(reply.account),
         authorUrl: reply.account.url,
         createdAt: new Date(reply.created_at).getTime() / 1000,
         content,
         replies: [],
         highlight,
         data: {
            mastodonComment: reply,
            userInfo,
         },
      };
   }

   showActionButtons(userInfo: MastodonUserInfo) {
      if (!userInfo.bearer) return;
      const actionButtons = dom(`<div class="fab-container"></div>`)[0];

      const publish = dom(`<div class="fab">${svgPencil}</div>`)[0];
      const header = dom(`<span class="overlay-header">New post</span>`)[0];
      publish.addEventListener("click", () =>
         document.body.append(
            new PostEditor(
               header,
               null,
               "What's going on?",
               500,
               true,
               async (text) => {
                  const mastodonPost = await MastodonApi.publishPost(null, text, userInfo);
                  if (mastodonPost instanceof Error) return false;
                  const post = await MastodonSource.mastodonPostToPost(mastodonPost, false, userInfo);
                  if (!post) return false;
                  const postsView = document.querySelector("ledit-post-list") as PostListView;
                  postsView.prependPost(post);
                  return true;
               },
               (name, buffer) => {},
               (name) => {}
            )
         )
      );

      const notificationsDom = dom(`<div class="fab margin-right-big">${svgBell}</div>`)[0];
      notificationsDom.addEventListener("click", () => {
         notificationsDom.classList.remove("animation-pulsate", "border-accent", "fill-color-accent");
         document.body.append(new MastodonNotificationsOverlayView(userInfo));
      });
      const checkNotifications = async () => {
         setTimeout(checkNotifications, 1000 * 10);
         const lastNotificationId = localStorage.getItem("mastodonLastNotificationId");
         const notifications = await MastodonApi.getNotifications(null, userInfo, lastNotificationId);
         if (notifications instanceof Error) return;
         if (notifications.items.length == 0) return;
         if (lastNotificationId == null || lastNotificationId != notifications.items[0].id) {
            notificationsDom.classList.add("animation-pulsate", "border-accent", "fill-color-accent");
         }
      }
      checkNotifications();

      actionButtons.append(publish, notificationsDom);

      document.body.append(actionButtons);
   }

   static showCommentReplyEditor(mastodonComment: MastodonPost, userInfo: MastodonUserInfo, commentOrPostView: CommentView | PostView) {
      let userHandles: string[] = [];
      const commentHost = new URL(mastodonComment.uri).host;
      userHandles.push(...extractUsernames(mastodonComment).map((handle) => handle.replace("@" + userInfo.instance, "")));
      const commentUser = "@" + mastodonComment.account.username + (commentHost == userInfo.instance ? "" : "@" + commentHost);
      if (userHandles.indexOf(commentUser) == -1) userHandles.push(commentUser);
      userHandles = userHandles.filter((handle) => handle != "@" + userInfo.username && handle != "@" + userInfo.username + "@" + userInfo.instance);

      const header = dom(/*html*/ `
               <div class="overlay-supplement">
                  <div class="inline-row margin-bottom-small color font-weight-600">
                        <span>Replying to</span>
                        <img src="${
                           mastodonComment.account.avatar_static
                        }" class="border-radius-4px max-height-1-5-font-size">
                        <span>${getAccountName(mastodonComment.account, true)}</span>
                  </div>
                  <div>${mastodonComment.content}</div>
               </div>
            `)[0];
      document.body.append(
         new PostEditor(
            header,
            userHandles.length ? userHandles.join(" ") + " " : null,
            "Type your reply.",
            500,
            true,
            async (text) => {
               const mastodonReply = await MastodonApi.publishPost(mastodonComment, text, userInfo);
               if (mastodonReply instanceof Error) return false;
               const reply = MastodonSource.mastodonPostToComment(mastodonReply, true, userInfo);
               if (commentOrPostView instanceof CommentView) {
                  commentOrPostView.prependReply(reply);
               } else {
                  commentOrPostView.prependComment(reply);
               }
               return mastodonReply != null;
            },
            (name, bytes) => {},
            (name) => {}
         )
      );
   }

   async getPosts(nextPage: PageIdentifier): Promise<Page<Post<MastodonPostData>> | Error> {
      // We support different m/ url types
      //
      // These do not require an account bookmark and are readonly:
      // 1. instance, e.g. mastodon.gamedev.place, shows the local timeline in readonly mode.
      // 3. user@instance, e.g. badlogic@mastodon.gamedev.place, shows the user profile and public posts in readonly mode.
      // 2. user@instance(+user@instance)+, e.g. badlogic@mastodon.gamedev.place+eniko@peoplemaking.games, shows their most recent public posts in readonly mode.

      // These require an account bookmark and allow read/write, e.g. follow/unfollow, reblog, favourite, reply, publish.
      // 4. user@instance/home, shows the user's home timeline.
      // 6. user@instance/local, shows the local timeline.
      // 7. user@instance/@user(@instance)/, shows the user profile and posts.
      // 7. user@instance/<statusid>, shows the status.

      const feedTokens = this.getFeed().split("/");
      if (feedTokens.length == 0)
         return new Error(
            `Invalid Mastodon feed ${this.getFeed()}. Must be a user name, e.g. @badlogic@mastodon.gamedev.place, or an instance name, e.g. mastodon.gamedev.place.`
         );

      let userInfo = getUserInfo(feedTokens[0].trim());

      // Read-only urls
      if (userInfo == null) {
         const instance = feedTokens[0];
         userInfo = { username: "", instance, bearer: null };
         let mastodonPosts: MastodonPost[] | null = null;
         if (feedTokens.length == 1 || feedTokens[1].trim().length == 0) {
            const result = await MastodonApi.getLocalTimeline(nextPage, userInfo);
            if (result instanceof Error) return result;
            mastodonPosts = result;
         } else {
            const what = feedTokens[1];
            let otherUserInfo = getUserInfo(what);
            if (!otherUserInfo) return new Error(`Invalid Mastodon feed ${this.getFeed()}`);
            const resultAccount = await MastodonApi.lookupAccount(what, otherUserInfo.instance);
            if (resultAccount instanceof Error) return resultAccount;
            const mastodonAccount = resultAccount;
            const resultPosts = await MastodonApi.getAccountPosts(mastodonAccount.id, nextPage, otherUserInfo);
            if (resultPosts instanceof Error) return resultPosts;
            mastodonPosts = resultPosts;
            for (const mastodonPost of mastodonPosts) {
               mastodonPost.userInfo = otherUserInfo;
            }
         }

         if (!mastodonPosts) return new Error(`Invalid Mastodon feed ${this.getFeed()}`);

         let maxId: string | null = null;
         if (mastodonPosts) {
            maxId = mastodonPosts.length == 0 ? "end" : mastodonPosts[mastodonPosts.length - 1].id;
         }
         if (maxId != "end") {
            maxId = maxId ? `&max_id=${maxId}` : "";
         }
         const posts: Post<MastodonPostData>[] = [];
         const postPromises: Promise<Post<MastodonPostData> | null>[] = [];
         for (const mastodonPost of mastodonPosts) {
            postPromises.push(MastodonSource.mastodonPostToPost(mastodonPost, getSettings().showOnlyMastodonRoots, userInfo));
         }
         const resolvedPosts = await Promise.all(postPromises);
         for (const post of resolvedPosts) {
            if (post) posts.push(post);
         }
         return { items: posts, nextPage: maxId };
      }

      // Read/write urls
      if (feedTokens.length == 1) {
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
      }

      return new Error(`invaInvalid Mastodon feed ${this.getFeed()}`);
   }

   async getComments(post: Post<MastodonPostData>): Promise<Comment<MastodonCommentData>[] | Error> {
      const mastodonPost = post.data.mastodonPost;
      const userInfo = post.data.userInfo;
      const postToView = mastodonPost.reblog ?? mastodonPost;
      const host = new URL(postToView.uri).host;
      let statusId = postToView.uri.split("/").pop()!;
      let commentUserInfo: MastodonUserInfo = userInfo.instance == host ? userInfo : { username: "", instance: host, bearer: null };
      let rootId: string | null = null;
      const roots: Comment<MastodonCommentData>[] = [];
      const comments: Comment<MastodonCommentData>[] = [];
      const commentsById = new Map<string, Comment<MastodonCommentData>>();

      let result = await MastodonApi.getPostContext(statusId, commentUserInfo);
      if (result instanceof Error) {
         statusId = postToView.id;
         commentUserInfo = userInfo;
         result = await MastodonApi.getPostContext(statusId, commentUserInfo);
         if (result instanceof Error) {
            return result;
         }
      }
      let context = result;

      if (context.ancestors.length > 0) {
         // FIXME if the root is from our instance, query our instance
         // instead of whatever instance we fetched the context from.
         // this will give us properly set favourite and reblogged flags.
         let root = context.ancestors[0];
         if (new URL(root.url).host == userInfo.instance && userInfo.bearer) {
            const resolvedRoot = await MastodonApi.resolvePost(root.url, userInfo);
            if (resolvedRoot instanceof Error) return resolvedRoot;
            root = resolvedRoot;
            commentUserInfo = userInfo;
         }
         rootId = root.id;
         // FIXME matching by content is bad
         const rootComment = MastodonSource.mastodonPostToComment(root, root.uri == postToView.uri, userInfo);
         roots.push(rootComment);
         comments.push(rootComment);
         commentsById.set(root.id, rootComment);
         const fullContext = await MastodonApi.getPostContext(root.id, commentUserInfo);
         if (!(fullContext instanceof Error)) context = fullContext;
      }

      const mastodonComments: MastodonPost[] = [];
      if (context.ancestors && context.ancestors.length > 0) {
         rootId = context.ancestors[0].id;
         mastodonComments.push(...context.ancestors);
         mastodonComments.push(postToView);
      }
      mastodonComments.push(...context.descendants);

      for (const reply of mastodonComments) {
         // FIXME matching by content is bad
         const comment = MastodonSource.mastodonPostToComment(reply, reply.uri == postToView.uri, userInfo);
         if (!rootId && reply.in_reply_to_id == statusId) roots.push(comment);
         if (reply.id == rootId) roots.push(comment);
         comments.push(comment);
         commentsById.set(reply.id, comment);
      }
      for (const comment of comments) {
         const mastodonComment = comment.data.mastodonComment;
         if (commentsById.get(mastodonComment.in_reply_to_id!)) {
            const other = commentsById.get(mastodonComment.in_reply_to_id!)!;
            other.replies.push(comment);
         }
      }
      return roots;
   }

   getMetaDom(post: Post<MastodonPostData>): HTMLElement[] {
      const postToView = post.data.mastodonPost.reblog ?? post.data.mastodonPost;
      const userInfo = post.data.userInfo;
      const avatarImageUrl = postToView.account.avatar_static;
      const authorUrl = postToView.account.url;
      const postUrl = postToView.uri; // "/#m/" + userInfo.username + "@" + userInfo.instance + "/" + postToView.id;
      const metaDom = dom(/*html*/ `
         <a href="${authorUrl}" class="gap-small">
            ${avatarImageUrl ? /*html*/`<img src="${avatarImageUrl}" class="border-radius-4px max-height-2-5-font-size">` : ""}
            <div>
               <span><b>${getAccountName(postToView.account, true)}</b></span>
               <span>${postToView.account.username}${
         new URL(postToView.uri).host == userInfo.instance ? "" : "@" + new URL(postToView.uri).host
      }</span>
            </div>
         </a>
         <a href="${postUrl}" class="text-decoration-underline margin-left-auto align-items-flex-start">${dateToText(
         post.createdAt * 1000
      )}</span>
      `);
      metaDom[0].addEventListener("click", (event) => {
         event.preventDefault();
         document.body.append(new MastodonUserProfileOverlayView(postToView.account, userInfo));
      });

      return metaDom;
   }

   getContentDom(post: Post<MastodonPostData>): ContentDom {
      return MastodonSource.getPostOrCommentContentDom(post.data.mastodonPost, post.data.inReplyToPost, post.data.userInfo, false);
   }

   static getPollDom(post: MastodonPost): HTMLElement | null {
      // FIXME make this interactive and show results if poll has ended.
      if (post.poll) {
         const pollDiv = dom(`<div></div>`)[0];
         for (const option of post.poll.options) {
            pollDiv.append(dom(`<div class="mastodon-poll-option fill-color">${svgCircle}${option.title}</div>`)[0]);
         }
         pollDiv.append(dom(`<div class="mastodon-poll-summary">${post.poll.votes_count} votes, ${post.poll.voters_count} voters</div>`)[0]);
         return pollDiv;
      }
      return null;
   }

   static getMediaDom(post: MastodonPost): ContentDom | null {
      const toggles: Element[] = [];
      const mediaDom = dom(`<div class="padding-top-small"></div>`)[0];
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
            mediaDom.append(gallery.gallery);
            if (images.length > 1) toggles.push(gallery.toggle);
         }
         if (videos.length >= 1) {
            for (const video of videos) {
               mediaDom.append(
                  renderVideo(
                     {
                        width: video.meta?.original?.width ?? 0,
                        height: video.meta?.original?.height ?? 0,
                        dash_url: null,
                        hls_url: null,
                        fallback_url: video.url,
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

      return mediaDom.children.length > 0 ? { elements: [mediaDom], toggles } : null;
   }

   static getPostOrCommentContentDom(
      mastodonPost: MastodonPost,
      inReplyToPost: MastodonPost | null,
      userInfo: MastodonUserInfo,
      isComment: boolean
   ): ContentDom {
      let postToView = mastodonPost.reblog ?? mastodonPost;
      const elements: Element[] = [];
      const toggles: Element[] = [];

      let prelude: Element[] = [];
      if (mastodonPost.reblog) {
         const avatarImageUrl = mastodonPost.account.avatar_static;
         const reblogPrelude = dom(/*html*/ `
            <a x-id="preludeReblog" href="${mastodonPost.account.url}" class="mastodon-prelude">
               <div class="post-meta">
                     <span>Boosted by</span>
                     <img src="${avatarImageUrl}" class="border-radius-4px max-height-1-5-font-size">
                     <span>${getAccountName(mastodonPost.account, true)}</span>
               </div>
            </a>
         `)[0];
         prelude.push(reblogPrelude);
         reblogPrelude.addEventListener("click", (event) => {
            event.preventDefault();
            document.body.append(new MastodonUserProfileOverlayView(mastodonPost.account, userInfo));
         });
      }

      if (inReplyToPost) {
         const avatarImageUrl = inReplyToPost.account.avatar_static;
         const inReplyPrelude = dom(/*html*/ `
         <a x-id="preludeInReplyTo" href="${inReplyToPost.url}" class="mastodon-prelude">
            <div class="post-meta">
                  <span>In reply to</span>
                  <img src="${avatarImageUrl}" class="border-radius-4px max-height-1-5-font-size">
                  <span>${getAccountName(inReplyToPost.account, true)}</span>
            </div>
         </a>
         `)[0];
         prelude.push(inReplyPrelude);
         inReplyPrelude.addEventListener("click", (event) => {
            event.preventDefault();
            document.body.append(new MastodonUserProfileOverlayView(inReplyToPost.account, userInfo));
         })
      }
      const contentDom = dom(/*html*/`<div class="content-text"></div>`)[0];
      for(const el of prelude) {
         contentDom.append(el);
      }
      contentDom.append(...dom(/*html*/`<div>${replaceEmojis(postToView.content, postToView.emojis)}</div>`));
      elements.push(contentDom);

      const pollDom = MastodonSource.getPollDom(postToView);
      if (pollDom) elements.push(pollDom);
      const mediaDom = MastodonSource.getMediaDom(postToView);
      if (mediaDom) {
         for (const el of mediaDom.elements) {
            elements.push(el);
         }
         toggles.push(...mediaDom.toggles);
      }

      const boost = dom(/*html*/ `
         <div x-id="boost" class="post-button color">
            <span x-id="boostIcon" class="${postToView.reblogged ? "fill-color-gold" : "fill-color"}">${svgReblog}</span>
            <span x-id="boostCount" class="color">${addCommasToNumber(postToView.reblogs_count)}</span>
         </div>
      `)[0];

      const favourite = dom(/*html*/ `
         <div x-id="favourite" class="post-button color">
            <span x-id="favouriteIcon" class="${postToView.favourited ? "fill-color-gold" : "fill-color"}">${svgStar}</span>
            <span x-id="favouriteCount" class="color">${addCommasToNumber(postToView.favourites_count)}</span>
         </div>
      `)[0];

      if (userInfo.bearer) {
         const reply = dom(`<a class="fill-color post-button"">${svgReply}</a>`)[0];
         toggles.push(reply);
         reply.addEventListener("click", (event) => {
            let parent = reply.parentElement;
            while (parent) {
               if (parent instanceof CommentView) break;
               if (parent instanceof PostView) break;
               parent = parent.parentElement;
            }
            this.showCommentReplyEditor(postToView, userInfo, parent as PostView);
         });

         const boostElements = View.elements<{
            boostIcon: HTMLElement;
            boostCount: HTMLElement;
         }>(boost);

         let boosting = false;
         boost.addEventListener("click", async () => {
            if (boosting) return;
            boosting = true;
            postToView.reblogged = !postToView.reblogged;
            if (!(await MastodonApi.reblogPost(postToView, userInfo))) {
               alert("Coulnd't (un)reblog post");
               postToView.reblogged = !postToView.reblogged;
               boosting = false;
               return;
            }

            if (postToView.reblogged) postToView.reblogs_count++;
            else postToView.reblogs_count--;
            boostElements.boostCount.innerText = addCommasToNumber(postToView.reblogs_count);

            if (postToView.reblogged) {
               boostElements.boostIcon.classList.remove("fill-color");
               boostElements.boostIcon.classList.add("fill-color-gold");
            } else {
               boostElements.boostIcon.classList.remove("fill-color-gold");
               boostElements.boostIcon.classList.add("fill-color");
            }
            boosting = false;
         });

         const favouriteElements = View.elements<{
            favouriteIcon: HTMLElement;
            favouriteCount: HTMLElement;
         }>(favourite);

         let favouriting = false;
         favourite.addEventListener("click", async () => {
            if (favouriting) return;
            favouriting = true;
            postToView.favourited = !postToView.favourited;

            if (!(await MastodonApi.favouritePost(postToView, userInfo))) {
               alert("Couldn't (un)favourite post");
               postToView.favourited = !postToView.favourited;
               favouriting = false;
               return;
            }

            if (postToView.favourited) postToView.favourites_count++;
            else postToView.favourites_count--;
            favouriteElements.favouriteCount.innerText = addCommasToNumber(postToView.favourites_count);

            if (postToView.favourited) {
               favouriteElements.favouriteIcon.classList.remove("fill-color");
               favouriteElements.favouriteIcon.classList.add("fill-color-gold");
            } else {
               favouriteElements.favouriteIcon.classList.remove("fill-color-gold");
               favouriteElements.favouriteIcon.classList.add("fill-color");
            }
            favouriting = false;
         });
      }
      toggles.push(boost);
      toggles.push(favourite);

      return { elements: elements, toggles: toggles };
   }

   getCommentMetaDom(comment: Comment<MastodonCommentData>, opName: string | null): HTMLElement[] {
      const mastodonComment = comment.data.mastodonComment;
      const metaDom = dom(/*html*/ `
         <span class="comment-author ${opName == comment.author ? "comment-author-op" : ""}">
            <a href="${comment.authorUrl}" class="inline-row">
               <img src="${mastodonComment.account.avatar_static}" class="border-radius-4px max-height-1-5-font-size">
               <span>${getAccountName(comment.data.mastodonComment.account, true)}</span>
            </a>
         </span>
         <span>•</span>
         <a href="${comment.url}" class="text-decoration-underline">${dateToText(comment.createdAt * 1000)}</a>
      `);
      metaDom[0].addEventListener("click", (event) => {
         event.preventDefault();
         document.body.append(new MastodonUserProfileOverlayView(comment.data.mastodonComment.account, comment.data.userInfo));
      });
      return metaDom;
   }

   getFeed(): string {
      if (this.hash.length == 0) {
         return "";
      }
      let slashIndex = this.hash.indexOf("/");
      if (slashIndex == -1) return "";
      return decodeURIComponent(this.hash.substring(slashIndex + 1));
   }

   getSourcePrefix(): SourcePrefix {
      return "m/";
   }
   getSortingOptions(): SortingOption[] {
      return [];
   }
   getSorting(): string {
      return "";
   }
}

export class MastodonUserEditor extends OverlayView {
   constructor(public readonly bookmark: Bookmark, public readonly isNew: boolean) {
      super("Mastodon account", true);
      if (!this.bookmark.supplemental) {
         throw new Error("Need a bookmark with user info!");
      }
      this.renderContent();
   }

   renderContent() {
      this.content.style.gap = "0.5em";
      const editorDom = dom(/*html*/ `
            <input x-id="user" value="${
               this.bookmark.supplemental!.username ? this.bookmark.supplemental!.username + "@" + this.bookmark.supplemental!.instance : ""
            }" placeholder="user@instance.com">
            <input x-id="bearer" value="${this.bookmark.supplemental!.bearer}" placeholder="Access token">
            <div class="overlay-buttons">
               <button x-id="save" class="overlay-button margin-left-auto">Save</button>
               <div x-id="progress" class="fill-color hidden">${svgLoader}</div>
            </div>
         </div>
      `);
      this.content.append(...editorDom);

      const elements = this.elements<{
         editor: HTMLElement;
         close: HTMLElement;
         user: HTMLInputElement;
         bearer: HTMLInputElement;
         save: HTMLButtonElement;
         progress: HTMLElement;
      }>();

      elements.save.addEventListener("click", async (event: Event) => {
         event.stopPropagation();
         let user = elements.user.value.trim();
         let bearer = elements.bearer.value.trim();

         if (user.length == 0) {
            alert("Please specify a Mastodon user, e.g. user@mastodon.social");
            return;
         }

         const userInfo = getUserInfo(user);
         if (!userInfo) {
            alert("Invalid user name. Must have the form user@instance.com");
            return;
         }

         try {
            new URL("https://" + userInfo.instance);
         } catch (e) {
            alert("Invalid instance. Must be the domain name plus optional port of your instance, e.g. mastodon.social");
            return;
         }

         if (bearer.length == 0) {
            alert(
               "Please specify an access token.\nYou can find your access token as follows\n\n1. Log into your Mastodon account on your instance\n2. Go to Preferences > Development\n3. Click 'New application'\n4. Enter 'ledit' as the application name and click submit\n5. In the list, click on the application you just created\n6. Copy & paste the value of the 'Your access token' field"
            );
            return;
         }

         elements.user.setAttribute("disabled", "");
         elements.bearer.setAttribute("disabled", "");
         elements.save.setAttribute("disabled", "");
         elements.progress.classList.remove("hidden");

         userInfo.bearer = bearer;
         const posts = await MastodonApi.getHomeTimeline("", userInfo);
         if (!posts) {
            alert(`Couldn't authenticate your account. Please check the user name, instance, and access token.`);
            elements.user.removeAttribute("disabled");
            elements.bearer.removeAttribute("disabled");
            elements.save.removeAttribute("disabled");
            elements.progress.classList.add("hidden");
            return;
         }

         const bookmark = this.bookmark;

         bookmark.label = `${userInfo.username}@${userInfo.instance}`;
         bookmark.ids = [`${userInfo.username}@${userInfo.instance}/home`];
         bookmark.supplemental = userInfo;

         if (this.isNew) {
            getSettings().bookmarks.push(bookmark);
         }
         saveSettings();
         this.close();
         navigate(bookmarkToHash(bookmark));
      });
   }
}
customElements.define("ledit-mastodon-user-editor", MastodonUserEditor);

export class MastodonUserProfileView extends View {
   relationship: MastodonRelationship | null = null;
   localAccount: MastodonAccount | null = null;
   remoteAccount: MastodonAccount | null = null;

   constructor(account: MastodonAccount, public readonly userInfo: MastodonUserInfo) {
      super();

      const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.append(loadingDiv);
      (async () => {
         if (!userInfo.bearer) {
            this.localAccount = account;
            this.remoteAccount = account;
            this.relationship = null;
            this.renderContent();
         } else {
            const promises = [
               MastodonApi.resolveAccount(account.url, userInfo),
               MastodonApi.lookupAccount(account.username, new URL(account.url).host),
            ];
            const results = await Promise.all(promises);
            loadingDiv.remove();

            const resultLocalAccount = results[0];
            if (resultLocalAccount instanceof Error) {
               this.append(
                  ...dom(/*html*/ `
                  <div class="post-loading">Could not lookup user ${getAccountName(account, true)} on ${userInfo.instance}: ${
                     resultLocalAccount.message
                  }.</div>
               `)
               );
               return;
            }
            this.localAccount = resultLocalAccount;

            let resultRemoteAccount = results[1];
            if (resultRemoteAccount instanceof Error) {
               resultRemoteAccount = resultLocalAccount;
            }
            this.remoteAccount = resultRemoteAccount;
            const resultRelationship = await MastodonApi.getRelationship(this.localAccount.id, userInfo);
            if (resultRelationship instanceof Error) {
               this.append(
                  ...dom(/*html*/ `
                     <div class="post-loading">Could not load user ${getAccountName(this.localAccount, true)}: ${
                        resultRelationship.message
                     }</div>`
                  )
               );
               return;
            }
            this.relationship = resultRelationship;
            this.renderContent();
         }
      })();
   }

   renderContent(): void {
      if (!this.localAccount) return;
      const localAccount = this.localAccount;
      if (!this.remoteAccount) return;
      const remoteAccount = this.remoteAccount;

      this.style.gap = "0.5em";
      const avatarImageUrl = localAccount.avatar_static;
      const authorUrl = localAccount.url;
      const hasHeader = localAccount.header && !localAccount.header.includes("missing");
      const metaDom = dom(/*html*/ `
         <div>
            ${
               hasHeader
                  ? /*html*/`
                     <div class="max-height-30vh overflow-hidden margin-minus-1">
                        <img class="max-width-100" src="${localAccount.header}">
                     </div>`
                  : ""
            }
            <div class="display-flex margin-top-big-2 align-items-center gap-small">
               <a href="${authorUrl}" class="display-flex gap-small">
                  ${avatarImageUrl ? `<img src="${avatarImageUrl}" class="border-radius-4px max-height-2-5-font-size">` : ""}
                  <div class="display-flex flex-direction-column">
                     <span><b>${getAccountName(localAccount, true)}</b></span>
                     <span class="font-size-small color">@${localAccount.username}@${
         new URL(localAccount.url).host
      }</span>
                  </div>
               </a>
               ${
                  !(localAccount.username == this.userInfo.username && new URL(localAccount.url).host == this.userInfo.instance)
                     ? `<button x-id="follow" class="overlay-button margin-left-auto">${this.relationship?.following ? "Following" : "Follow"}</button>`
                     : ""
               }
            </div>

         </div>
         <div class="display-flex margin-top-small margin-bottom-small font-size-small">
            ${this.relationship?.followed_by ? `<span class="border-1px-solid border-radius-4px padding-tiny">Follows you</span>` : ""}
            ${this.relationship?.blocked_by ? `<span class="border-1px-solid border-radius-4px padding-tiny">Blocks you</span>` : ""}
            ${this.relationship?.blocking ? `<span class="border-1px-solid border-radius-4px padding-tiny">Blocked</span>` : ""}
         </div>
         <div>
            ${localAccount.note}
         </div>
         <div class="display-flex gap-big margin-auto margin-bottom-big">
            <div x-id="accountPosts" class="toggle-button selected"><span><b>${this.remoteAccount.statuses_count}</b></span><span>Posts</span></div>
            <div x-id="accountFollowing" class="toggle-button"><span><b>${this.remoteAccount.following_count}</b></span><span>Following</span></div>
            <div x-id="accountFollowers" class="toggle-button"><span><b>${this.remoteAccount.followers_count}</b></span><span>Followers</span></div>
         </div>
      `);
      this.append(...metaDom);

      let feed = getSource().getFeed().split("/");
      let posts = new PostListView(new MastodonSource(feed[0] + "/@@" + localAccount.username + "@" + new URL(localAccount.url).host), false);
      this.append(posts);

      let following = new MastodonAccountListView(async (nextPage) => {
         const result = await MastodonApi.getFollowing(remoteAccount, new URL(remoteAccount.url).host, nextPage, this.userInfo);
         if (result instanceof Error) return await MastodonApi.getFollowing(localAccount, this.userInfo.instance, nextPage, this.userInfo);
         return result;
      }, this.userInfo);

      let followers = new MastodonAccountListView(async (nextPage) => {
         const result = await MastodonApi.getFollowers(remoteAccount,  new URL(remoteAccount.url).host, nextPage, this.userInfo);
         if  (result instanceof Error) return await MastodonApi.getFollowers(localAccount, this.userInfo.instance, nextPage, this.userInfo);
         return result;
      }, this.userInfo);

      const elements = this.elements<{
         follow?: HTMLButtonElement;
         accountPosts: HTMLElement;
         accountFollowing: HTMLElement;
         accountFollowers: HTMLElement;
      }>();

      let followingInProgress = false;
      if (elements.follow && this.relationship) {
         const relationship = this.relationship;
         elements.follow.addEventListener("click", async () => {
            if (followingInProgress) return;
            followingInProgress = true;
            relationship.following = !relationship.following;
            elements.follow!.disabled = true;

            if (!(await MastodonApi.followAccount(localAccount, relationship.following, this.userInfo))) {
               alert("Couldn't follow account");
               relationship.following = !relationship.following;
               followingInProgress = false;
               elements.follow!.disabled = false;
               return;
            }
            elements.follow!.disabled = false;
            if (elements.follow) elements.follow.innerText = relationship.following ? "Following" : "Follow";
            followingInProgress = false;
         });
      }

      elements.accountPosts.addEventListener("click", () => {
         Array.from(this.querySelectorAll(".toggle-button")).forEach((el) => el.classList.remove("selected"));
         elements.accountPosts.classList.add("selected");
         followers.remove();
         following.remove();
         this.append(posts);
      });
      elements.accountFollowing.addEventListener("click", () => {
         Array.from(this.querySelectorAll(".toggle-button")).forEach((el) => el.classList.remove("selected"));
         elements.accountFollowing.classList.add("selected");
         followers.remove();
         posts.remove();
         this.append(following);
      });
      elements.accountFollowers.addEventListener("click", () => {
         Array.from(this.querySelectorAll(".toggle-button")).forEach((el) => el.classList.remove("selected"));
         elements.accountFollowers.classList.add("selected");
         following.remove();
         posts.remove();
         this.append(followers);
      });

      setLinkTargetsToBlank(this);
   }
}
customElements.define("ledit-mastodon-user-profile", MastodonUserProfileView);

export class MastodonUserProfileOverlayView extends OverlayView {
   constructor(account: MastodonAccount, public readonly userInfo: MastodonUserInfo) {
      super("", true, `#m/${userInfo.username}@${userInfo.instance}/${account.username}@${new URL(account.url).host}`);
      this.content.append(new MastodonUserProfileView(account, userInfo));
   }
}
customElements.define("ledit-mastodon-user-profile-overlay", MastodonUserProfileOverlayView);

export class MastodonAccountListView extends PagedListView<MastodonAccount> {
   constructor(
      public readonly fetchAccounts: (nextPage: PageIdentifier) => Promise<Page<MastodonAccount> | Error>,
      public readonly userInfo: MastodonUserInfo
   ) {
      super(fetchAccounts);
      this.classList.add("mastodon-account-list");
   }

   async renderItems(accounts: MastodonAccount[]) {
      for (const account of accounts) {
         const avatarImageUrl = account.avatar_static;
         const authorUrl = account.url;
         const accountDom = dom(/*html*/ `
         <div class="mastodon-account">
            <a href="${authorUrl}" class="display-flex gap-small">
               ${avatarImageUrl ? `<img src="${avatarImageUrl}" class="border-radius-4px max-height-2-5-font-size">` : ""}
               <div class="display-flex flex-direction-column font-size-small">
                  <span><b>${getAccountName(account, true)}</b></span>
                  <span class="color-dim">@${account.username}@${new URL(account.url).host}</span>
               </div>
            </a>
            ${
               // FIXME show relationships if possible
               /*
                  account.username != this.userInfo.username && new URL(account.url).host != this.userInfo.instance
                  ? `<button class="overlay-button margin-left-auto ${
                     this.relationship?.following ? "border-1px-solid" : ""
                  }">${this.relationship?.following ? "Following" : "Follow"}</button>`
                  : ""
               */
               ""
            }
         </div>
         `);
         setLinkTargetsToBlank(accountDom[0]);
         this.append(...accountDom);
      }
   }
}
customElements.define("ledit-mastodon-account-list", MastodonAccountListView);

export class MastodonNotificationsListView extends PagedListView<MastodonNotification> {
   public readonly userInfo: MastodonUserInfo;
   public firstPage = true;
   public lastNotificationId: string | null = null;
   public displayingOld = false;
   public onlyMentions = false;

   constructor(userInfo: MastodonUserInfo) {
      super((nextPage) => MastodonApi.getNotifications(nextPage, userInfo, null));
      this.userInfo = userInfo;
   }

   setupFirstPage(notifications: MastodonNotification[]) {
      if (this.firstPage) {
         this.firstPage = false;
         this.lastNotificationId = localStorage.getItem("mastodonLastNotificationId");
         localStorage.setItem("mastodonLastNotificationId", notifications[0].id);
         const notificationTypes = dom(/*html*/`
            <div class="display-flex gap-big margin-auto">
               <div x-id="all" class="toggle-button"><span>All</span></div>
               <div x-id="mentions" class="toggle-button"><span>Mentions</span></div>
            </div>
         `)[0];

         const typesElements = View.elements<{
            all: HTMLElement;
            mentions: HTMLElement;
         }>(notificationTypes);
         typesElements.all.classList.add("selected");
         typesElements.all.addEventListener("click", () => {
            if (typesElements.all.classList.contains("selected")) return;
            typesElements.mentions.classList.remove("selected");
            typesElements.all.classList.add("selected");
            Array.from(this.querySelectorAll(".mastodon-notification")).forEach((el) => el.classList.remove("hidden"));
            this.onlyMentions = false;
         });
         typesElements.mentions.addEventListener("click", () => {
            if (typesElements.mentions.classList.contains("selected")) return;
            typesElements.all.classList.remove("selected");
            typesElements.mentions.classList.add("selected");
            Array.from(this.querySelectorAll(".mastodon-notification")).forEach((el) => el.classList.add("hidden"));
            this.onlyMentions = true;
         });
         this.append(notificationTypes);
      }
   }

   async renderItems(notifications: MastodonNotification[]) {
      if (notifications.length == 0) return;
      this.setupFirstPage(notifications);

      // FIXME support mentions only
      const promises: Promise<Post<MastodonPostData> | null>[] = [];
      const notificationToPromise: number[] = [];
      for (let i = 0; i < notifications.length; i++) {
         const notification = notifications[i];
         if (notification.type === "mention") {
            const promise = MastodonSource.mastodonPostToPost(notification.status!, false, this.userInfo);
            promises.push(promise);
            notificationToPromise.push(promises.length - 1);
         } else {
            notificationToPromise.push(-1);
         }
      }
      const resolved = await Promise.all(promises);

      for (let i = 0; i < notifications.length; i++) {
         const notification = notifications[i];
         if (notification.id == this.lastNotificationId) {
            this.append(dom(/*html*/`<div class="post-loading">Previously seen notifications</div>`)[0]);
         }
         if (notificationToPromise[i] != -1) {
            const post = resolved[notificationToPromise[i]];
            if (!post) continue;
            const postView = new PostView(post);
            this.append(postView);
         } else {
            const notificationDom = this.getNotificationDom(notification);
            if (this.onlyMentions) notificationDom.classList.add("hidden");
            this.append(notificationDom);
         }
      }

      setLinkTargetsToBlank(this);
   }

   getNotificationDom(notification: MastodonNotification) {
      const getAuthorDomSmall = (account: MastodonAccount) => {
         return /*html*/ `
            <a href="${account.url}" class="inline-row notification-account">
               <img src="${account.avatar_static}" class="border-radius-4px max-height-1-5-font-size">
               <span>${getAccountName(account, true)}</span>
            </a>
            `;
      };

      let html = "";
      switch (notification.type) {
         case "mention":
            html = /*html*/ `
                  <div class="mastodon-notification-header">
                     ${getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">mentioned you ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="mastodon-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "status":
            break;
         case "reblog":
            html = /*html*/ `
                  <div class="mastodon-notification-header">
                     <span class="fill-color-gold">${svgReblog}</span>
                     ${getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">reblogged you ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="mastodon-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "follow":
            html = /*html*/ `
               <div class="mastodon-notification-header">
               ${getAuthorDomSmall(notification.account)}
                  <span>followed you ${dateToText(new Date(notification.created_at).getTime())} ago</span>
               </div>`;
            break;
         case "follow_request":
            html = /*html*/ `
               <div class="mastodon-notification-header">
                  ${getAuthorDomSmall(notification.account)}
                  <span>wants to follow you</span>
               </div>`;
            break;
         case "favourite":
            html = /*html*/ `
                  <div class="mastodon-notification-header">
                     <span class="fill-color-gold">${svgStar}</span>
                     ${getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">favorited your post ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="mastodon-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "poll":
            // FIXME show poll results
            html = /*html*/ `
                  <div class="mastodon-notification-header">
                     ${getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">poll has ended ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="mastodon-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "update":
            html = /*html*/ `
                  <div class="mastodon-notification-header">
                     ${getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">post was edited ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="mastodon-notification-text">${notification.status?.content}</div>
                  `;
            break;
      }
      const notificationDom = dom(`<div class="mastodon-notification">${html}</div>`)[0];
      const accountDom = notificationDom.querySelector(".notification-account");
      if (accountDom) {
         accountDom.addEventListener("click", (event) => {
            event.preventDefault();
            document.body.append(new MastodonUserProfileOverlayView(notification.account, this.userInfo));
         })
      }
      return notificationDom;
   }
}
customElements.define("ledit-mastodon-notifications-list", MastodonNotificationsListView);

export class MastodonNotificationsOverlayView extends OverlayView {
   constructor(public readonly userInfo: MastodonUserInfo) {
      super("Notifications", true, `#m/${userInfo.username}@${userInfo.instance}/notifications`);
      this.content.append(new MastodonNotificationsListView(userInfo));
   }
}
customElements.define("ledit-mastodon-notifications", MastodonNotificationsOverlayView);

export class MastodonPostEditor extends PostEditor {

}
