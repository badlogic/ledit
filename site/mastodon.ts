// @ts-ignore
import "./mastodon.css";
import { CommentView } from "./comments";
import { Comment, ContentDom, Page, PageIdentifier, Post, SortingOption, Source, SourcePrefix, getSource } from "./data";
import { PostEditor } from "./post-editor";
import { PostListView, PostView } from "./posts";
import { Bookmark, bookmarkToHash, getSettings, saveSettings } from "./settings";
import { svgBell, svgCircle, svgLoader, svgPencil, svgReblog, svgReply, svgStar } from "./svg";
import { addCommasToNumber, dateToText, dom, navigate, renderGallery, renderVideo, setLinkTargetsToBlank } from "./utils";
import { OverlayView, PagedListView, View } from "./view";

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

   static async lookupAccount(userName: string, instance: string): Promise<MastodonAccount | Error> {
      try {
         const response = await fetch("https://" + instance + "/api/v1/accounts/lookup?acct=" + userName);
         if (response.status != 200) return new Error(`Could not look up account. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonAccount;
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

   static async resolvePost(postUrl: string, userInfo: MastodonUserInfo): Promise<MastodonPost | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v2/search/?q=${postUrl}&resolve=true`, options);
         if (response.status != 200) return new Error(`Could not resolve post. Server responded with status code ${response.status}`);
         const searchResult = (await response.json()) as any as { statuses: MastodonPost[] };
         if (searchResult.statuses.length == 0) return new Error(`Post ${postUrl} could not be found.`);
         return searchResult.statuses[0];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async resolveAccount(accountUrl: string, userInfo: MastodonUserInfo): Promise<MastodonAccount | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v2/search/?q=${accountUrl}&resolve=true`, options);
         if (response.status != 200) return new Error(`Could not resolve account. Server responded with status code ${response.status}`);
         const searchResult = (await response.json()) as any as { accounts: MastodonAccount[]; statuses: MastodonPost[] };
         if (searchResult.accounts.length == 0) return new Error(`Account ${accountUrl} could not be found.`);
         return searchResult.accounts[0];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getAccountPosts(accountId: string, maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/accounts/${accountId}/statuses?limit=40${maxId ? maxId : ""}`, options);
         if (response.status != 200) return new Error(`Could not get posts for account. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonPost[];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getFollowing(account: MastodonAccount, nextPage: PageIdentifier, userInfo: MastodonUserInfo): Promise<Page<MastodonAccount> | Error> {
      try {
         const instance = new URL(account.url).host;
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

   static async getFollowers(account: MastodonAccount, nextPage: string | null, userInfo: MastodonUserInfo): Promise<Page<MastodonAccount> | Error> {
      try {
         const instance = new URL(account.url).host;
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

   static async getNotifications(maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonNotification[] | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/notifications?limit=40${maxId ? maxId : ""}`, options);
         if (response.status != 200)
            return new Error(`Could not get notifications for account. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonNotification[];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getHomeTimeline(maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/timelines/home?limit=40${maxId ? maxId : ""}`, options);
         if (response.status != 200) return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonPost[];
      } catch (e) {
         return new Error("Networking error.");
      }
   }

   static async getLocalTimeline(maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/timelines/public?limit=40${maxId ? maxId : ""}`, options);
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
      return `<div class="mastodon-emoji-container">${replaceEmojis(name, account.emojis)}</div>`;
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

export class MastodonSource implements Source<MastodonPostData, MastodonCommentData> {
   constructor(public readonly fixedHash?: string) {}

   async mastodonPostToPost(mastodonPost: MastodonPost, onlyShowRoots: boolean, userInfo: MastodonUserInfo): Promise<Post<MastodonPostData> | null> {
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
         contentOnly: false,
         data: {
            mastodonPost,
            userInfo,
            id: mastodonPost.id,
            inReplyToPost,
         },
      };
   }

   mastodonPostToComment(reply: MastodonPost, highlight: boolean, userInfo: MastodonUserInfo): Comment<MastodonCommentData> {
      const content = this.getPostOrCommentContentDom(reply, null, userInfo, true);
      return {
         url: reply.url,
         author: getAccountName(reply.account),
         authorUrl: reply.account.url,
         createdAt: new Date(reply.created_at).getTime() / 1000,
         score: null,
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
      const publish = dom(`<div class="fab color-fill">${svgPencil}</div>`)[0];
      const notificationUrl = location.hash.replace("/home", "/notifications").substring(1);
      const notifications = dom(
         `<a href="#${notificationUrl}" style="margin-right: var(--ledit-margin);"><div class="fab color-fill">${svgBell}</div></a>`
      )[0];

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
                  const post = await this.mastodonPostToPost(mastodonPost, false, userInfo);
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
      actionButtons.append(publish, notifications);
      document.body.append(actionButtons);
   }

   showCommentReplyEditor(mastodonComment: MastodonPost, userInfo: MastodonUserInfo, commentOrPostView: CommentView | PostView) {
      let userHandles: string[] = [];
      const commentHost = new URL(mastodonComment.uri).host;
      userHandles.push(...extractUsernames(mastodonComment).map((handle) => handle.replace("@" + userInfo.instance, "")));
      const commentUser = "@" + mastodonComment.account.username + (commentHost == userInfo.instance ? "" : "@" + commentHost);
      if (userHandles.indexOf(commentUser) == -1) userHandles.push(commentUser);
      userHandles = userHandles.filter((handle) => handle != "@" + userInfo.username && handle != "@" + userInfo.username + "@" + userInfo.instance);

      const header = dom(/*html*/ `
               <div class="overlay-supplement">
                  <div class="inline-row" style="margin-bottom: var(--ledit-padding); color: var(--ledit-color); font-weight: 600;">
                        <span>Replying to</span>
                        <img src="${
                           mastodonComment.account.avatar_static
                        }" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
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
               const reply = this.mastodonPostToComment(mastodonReply, true, userInfo);
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

   async getPostsForUser(mastodonUser: string, nextPage: PageIdentifier): Promise<Post<MastodonPostData>[]> {
      const tokens = mastodonUser.split("/");
      const timeline = tokens.length >= 2 ? tokens[1] : null;
      mastodonUser = tokens[0];
      let mastodonUserId: string | null = mastodonUserIds[mastodonUser];

      const userInfo = getUserInfo(mastodonUser);
      if (!userInfo) return [];

      if (!mastodonUserId) {
         const account = await MastodonApi.lookupAccount(userInfo.username, userInfo.instance);
         if (account instanceof Error) return [];
         mastodonUserId = account.id;
         mastodonUserIds[mastodonUser] = mastodonUserId;
         localStorage.setItem("mastodonCache", JSON.stringify(mastodonUserIds));
      }

      let maxId = nextPage ? `&max_id=${nextPage}` : "";

      if (timeline == "notifications") {
         const mastodonNotifications = await MastodonApi.getNotifications(maxId, userInfo);
         if (mastodonNotifications instanceof Error) return [];
         const posts: Post<MastodonPostData>[] = [];
         for (const notification of mastodonNotifications) {
            if (notification.type == "mention") {
               const post = await this.mastodonPostToPost(notification.status!, false, userInfo);
               if (!post) {
                  posts.push({
                     contentOnly: true,
                     notification,
                     userInfo,
                     id: notification.id,
                  } as any); // FIXME don't use any!
               } else {
                  posts.push(post);
               }
            } else {
               posts.push({
                  contentOnly: true,
                  notification,
                  userInfo,
                  id: notification.id,
               } as any); // FIXME don't use any!
            }
         }
         return posts;
      } else {
         const mastodonPosts =
            timeline == "home"
               ? await MastodonApi.getHomeTimeline(maxId, userInfo)
               : await MastodonApi.getAccountPosts(mastodonUserId, maxId, userInfo);
         if (mastodonPosts instanceof Error) return [];
         const posts: Post<MastodonPostData>[] = [];
         const postPromises: Promise<Post<MastodonPostData> | null>[] = [];
         for (const mastodonPost of mastodonPosts) {
            postPromises.push(this.mastodonPostToPost(mastodonPost, getSettings().showOnlyMastodonRoots, userInfo));
         }
         const resolvedPosts = await Promise.all(postPromises);
         for (const post of resolvedPosts) {
            if (post) posts.push(post);
         }
         if (timeline == "home") this.showActionButtons(userInfo);
         return posts;
      }
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
      // 5. user@instance/notifications, shows user's notifications.
      // 6. user@instance/local, shows the local timeline.
      // 7. user@instance/@user(@instance)/, shows the user profile and posts.
      // 7. user@instance/<statusid>, shows the status.

      const feedTokens = this.getFeed().split("/");
      if (feedTokens.length == 0)
         return new Error(
            `Invalid Mastodon feed ${this.getFeed()}. Must be a user name, e.g. @badlogic@mastodon.gamedev.place, or an instance name, e.g. mastodon.gamedev.place.`
         );

      if (feedTokens.length == 1) {
         if (feedTokens[0].includes("@")) {
            const userTokens = feedTokens[0].split("+");
            const users: MastodonUserInfo[] = [];
            for (const userToken of userTokens) {
               const userInfo = getUserInfo(userToken);
               if (userInfo) {
                  users.push(userInfo);
               }
            }

            const urls = this.getFeed().split("+");
            let nextPages: (string | null)[] | undefined = nextPage?.split("+");
            const promises: Promise<Post<MastodonPostData>[]>[] = [];
            for (let i = 0; i < urls.length; i++) {
               promises.push(this.getPostsForUser(urls[i], nextPages ? nextPages[i] : null));
            }

            const promisesResult = await Promise.all(promises);
            const posts: Post<MastodonPostData>[] = [];
            const newAfters = [];
            for (let i = 0; i < urls.length; i++) {
               posts.push(...promisesResult[i]);
               const userInfo = getUserInfo(urls[i]);
               if (!userInfo) {
                  newAfters.push(null);
                  continue;
               }

               let maxId = promisesResult[i].length == 0 ? "end" : promisesResult[i][promisesResult[i].length - 1].data.id;
               newAfters.push(maxId);
            }
            if (urls.length > 1) {
               posts.sort((a, b) => b.createdAt - a.createdAt);
            }

            // FIXME
            return { items: posts, nextPage: newAfters!.join("+") };
         }
      }

      if (feedTokens.length == 2) {
         const userInfo = getUserInfo(feedTokens[0].trim());
         if (!userInfo) return new Error(`Invalid Mastodon user name ${feedTokens[0]}.`);
         if (!userInfo.bearer) {
            return new Error(`You must add a Mastodon account for ${userInfo.username}@${userInfo.instance}.`);
         }
         const what = feedTokens[1].trim();
         if (what.length == 0) return new Error(`Invalid Mastodon feed ${this.getFeed()}. Expected /home, /@username@instance, or a /<statusid>.`);

         let mastodonAccount: MastodonAccount | null = null;
         let mastodonPosts: MastodonPost[] | null = null;
         let mastodonNotifications: MastodonNotification[] | null = null;
         if (what == "home") {
            const result = await MastodonApi.getHomeTimeline(nextPage, userInfo);
            if (result instanceof Error) return result;
            mastodonPosts = result;
         } else if (what == "notifications") {
            const result = await MastodonApi.getNotifications(nextPage, userInfo);
            if (result instanceof Error) return result;
            mastodonNotifications = result;
         } else if (what == "local") {
            const result = await MastodonApi.getLocalTimeline(nextPage, userInfo);
            if (result instanceof Error) return result;
            mastodonPosts = result;
         } else if (what.includes("@")) {
            let otherUserInfo = getUserInfo(what);
            if (!otherUserInfo || otherUserInfo.instance == userInfo.instance) otherUserInfo = userInfo;
            const resultAccount = await MastodonApi.lookupAccount(what, otherUserInfo.instance);
            if (resultAccount instanceof Error) return resultAccount;
            mastodonAccount = resultAccount;
            const resultPosts = await MastodonApi.getAccountPosts(mastodonAccount.id, nextPage, otherUserInfo);
            if (resultPosts instanceof Error) return resultPosts;
            mastodonPosts = resultPosts;
            for (const mastodonPost of resultPosts) {
               mastodonPost.userInfo = otherUserInfo;
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
         if (mastodonNotifications) {
            maxId = mastodonNotifications.length == 0 ? "end" : mastodonNotifications[mastodonNotifications.length - 1].id;
         }
         maxId = maxId ? `&max_id=${maxId}` : "";

         if (mastodonPosts) {
            const postPromises: Promise<Post<MastodonPostData> | null>[] = [];
            for (const mastodonPost of mastodonPosts) {
               postPromises.push(this.mastodonPostToPost(mastodonPost, getSettings().showOnlyMastodonRoots, userInfo));
            }
            const resolvedPosts = await Promise.all(postPromises);
            for (const post of resolvedPosts) {
               if (post) posts.push(post);
            }
            this.showActionButtons(userInfo);
         }

         if (mastodonNotifications) {
            const postPromises: Promise<any>[] = [];

            for (const notification of mastodonNotifications) {
               if (notification.type === "mention") {
                  // Push the promise for fetching the post to the array
                  postPromises.push(this.mastodonPostToPost(notification.status!, false, userInfo));
               } else {
                  // Create a promise that resolves to the current notification data
                  postPromises.push(
                     Promise.resolve({
                        contentOnly: true,
                        notification,
                        userInfo,
                        id: notification.id,
                     })
                  );
               }
            }

            // Wait for all the promises to resolve in parallel
            const fetchedPosts = await Promise.all(postPromises);

            // Push the fetched posts to the 'posts' array
            posts.push(...fetchedPosts);

            // FIXME show home button?
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
      const statusId = postToView.uri.split("/").pop()!;
      let commentUserInfo: MastodonUserInfo = userInfo.instance == host ? userInfo : { username: "", instance: host, bearer: null };
      let rootId: string | null = null;
      const roots: Comment<MastodonCommentData>[] = [];
      const comments: Comment<MastodonCommentData>[] = [];
      const commentsById = new Map<string, Comment<MastodonCommentData>>();

      let result = await MastodonApi.getPostContext(statusId, commentUserInfo);
      if (result instanceof Error) return result;
      let context = result;

      if (context.ancestors.length > 0) {
         // FIXME if the root is from our instance, query our instance
         // instead of whatever instance we fetched the context from.
         // this will give us properly set favourite and reblogged flags.
         let root = context.ancestors[0];
         if (new URL(root.url).host == userInfo.instance) {
            const resolvedRoot = await MastodonApi.resolvePost(root.url, userInfo);
            if (resolvedRoot instanceof Error) return resolvedRoot;
            root = resolvedRoot;
            commentUserInfo = userInfo;
         }
         rootId = root.id;
         // FIXME matching by content is bad
         const rootComment = this.mastodonPostToComment(root, root.uri == postToView.uri, userInfo);
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
         const comment = this.mastodonPostToComment(reply, reply.uri == postToView.uri, userInfo);
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
         <a href="${authorUrl}" style="gap: var(--ledit-padding);">
            ${avatarImageUrl ? `<img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(2.5 * var(--ledit-font-size));">` : ""}
            <div>
               <span><b>${getAccountName(postToView.account, true)}</b></span>
               <span>${postToView.account.username}${
         new URL(postToView.uri).host == userInfo.instance ? "" : "@" + new URL(postToView.uri).host
      }</span>
            </div>
         </a>
         <a href="${postUrl}" style="text-decoration: underline; margin-left: auto; align-items: flex-start;">${dateToText(
         post.createdAt * 1000
      )}</span>
      `);
      metaDom[0].addEventListener("click", (event) => {
         event.preventDefault();
         document.body.append(new MastodonUserProfileView(postToView.account, userInfo));
      });

      return metaDom;
   }

   getContentDom(post: Post<MastodonPostData>): ContentDom {
      if (!post.contentOnly) {
         let userInfo = post.data.userInfo;
         let mastodonPost = post.data.mastodonPost;
         let inReplyToPost = post.data.inReplyToPost;
         return this.getPostOrCommentContentDom(mastodonPost, inReplyToPost, userInfo, false);
      } else {
         return this.getNotificationContentDom(post);
      }
   }

   getPollDom(post: MastodonPost): HTMLElement | null {
      // FIXME make this interactive and show results if poll has ended.
      if (post.poll) {
         const pollDiv = dom(`<div></div>`)[0];
         for (const option of post.poll.options) {
            pollDiv.append(dom(`<div class="mastodon-poll-option color-fill">${svgCircle}${option.title}</div>`)[0]);
         }
         pollDiv.append(dom(`<div class="mastodon-poll-summary">${post.poll.votes_count} votes, ${post.poll.voters_count} voters</div>`)[0]);
         return pollDiv;
      }
      return null;
   }

   getMediaDom(post: MastodonPost): ContentDom | null {
      const toggles: Element[] = [];
      const mediaDom = dom(`<div style="padding-top: var(--ledit-padding);"></div>`)[0];
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
                        width: video.meta.original?.width ?? 0,
                        height: video.meta.original?.height ?? 0,
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

   getPostOrCommentContentDom(
      mastodonPost: MastodonPost,
      inReplyToPost: MastodonPost | null,
      userInfo: MastodonUserInfo,
      isComment: boolean
   ): ContentDom {
      let postToView = mastodonPost.reblog ?? mastodonPost;
      const elements: Element[] = [];
      const toggles: Element[] = [];

      let prelude = "";
      if (mastodonPost.reblog) {
         const avatarImageUrl = mastodonPost.account.avatar_static;
         prelude = /*html*/ `
         <a href="${mastodonPost.account.url}" class="mastodon-prelude">
            <div class="post-meta">
                  <span>Boosted by</span>
                  <img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                  <span>${getAccountName(mastodonPost.account, true)}</span>
            </div>
         </a>
         `;
      }

      if (inReplyToPost) {
         const avatarImageUrl = inReplyToPost.account.avatar_static;
         prelude += /*html*/ `
         <a href="${inReplyToPost.url}" class="mastodon-prelude">
            <div class="post-meta">
                  <span>In reply to</span>
                  <img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                  <span>${getAccountName(inReplyToPost.account, true)}</span>
            </div>
         </a>
         `;
      }
      elements.push(
         dom(/*html*/ `
         <div class="content-text">
            ${prelude}${replaceEmojis(postToView.content, postToView.emojis)}
         </div>
      `)[0]
      );

      const pollDom = this.getPollDom(postToView);
      if (pollDom) elements.push(pollDom);
      const mediaDom = this.getMediaDom(postToView);
      if (mediaDom) {
         for (const el of mediaDom.elements) {
            elements.push(el);
         }
         toggles.push(...mediaDom.toggles);
      }

      // Add points last, so they go right as the only toggle.
      const boost = dom(/*html*/ `
         <div x-id="boost" class="post-button" style="color: var(--ledit-color); ${!isComment ? "margin-left: auto;" : ""}">
            <span x-id="boostIcon" class="${postToView.reblogged ? "color-gold-fill" : "color-fill"}">${svgReblog}</span>
            <span x-id="boostCount">${addCommasToNumber(postToView.reblogs_count)}</span>
         </div>
      `)[0];

      const favourite = dom(/*html*/ `
         <div x-id="favourite" class="post-button" style="color: var(--ledit-color);">
            <span x-id="favouriteIcon" class="${postToView.favourited ? "color-gold-fill" : "color-fill"}">${svgStar}</span>
            <span x-id="favouriteCount">${addCommasToNumber(postToView.favourites_count)}</span>
         </div>
      `)[0];

      if (userInfo.bearer) {
         const reply = dom(`<a class="color-fill post-button"">${svgReply}</a>`)[0];
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
            boostElements.boostCount.innerHTML = addCommasToNumber(postToView.reblogs_count);

            if (postToView.reblogged) {
               boostElements.boostIcon.classList.remove("color-fill");
               boostElements.boostIcon.classList.add("color-gold-fill");
            } else {
               boostElements.boostIcon.classList.remove("color-gold-fill");
               boostElements.boostIcon.classList.add("color-fill");
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
            favouriteElements.favouriteCount.innerHTML = addCommasToNumber(postToView.favourites_count);

            if (postToView.favourited) {
               favouriteElements.favouriteIcon.classList.remove("color-fill");
               favouriteElements.favouriteIcon.classList.add("color-gold-fill");
            } else {
               favouriteElements.favouriteIcon.classList.remove("color-gold-fill");
               favouriteElements.favouriteIcon.classList.add("color-fill");
            }
            favouriting = false;
         });
      }
      toggles.push(boost);
      toggles.push(favourite);

      return { elements: elements, toggles: toggles };
   }

   getNotificationContentDom(post: Post<MastodonPostData>) {
      // FIXME don't use any
      const notification = (post as any).notification as MastodonNotification;
      let html = "";
      switch (notification.type) {
         case "mention":
            html = /*html*/ `
                  <div class="post-notification-header">
                     ${this.getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">mentioned you ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "status":
            break;
         case "reblog":
            html = /*html*/ `
                  <div class="post-notification-header">
                     <span class="color-gold-fill">${svgReblog}</span>
                     ${this.getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">reblogged you ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "follow":
            html = /*html*/ `
               <div class="post-notification-header">
               ${this.getAuthorDomSmall(notification.account)}
                  <span>followed you ${dateToText(new Date(notification.created_at).getTime())} ago</span>
               </div>`;
            break;
         case "follow_request":
            html = /*html*/ `
               <div class="post-notification-header">
                  ${this.getAuthorDomSmall(notification.account)}
                  <span>wants to follow you</span>
               </div>`;
            break;
         case "favourite":
            html = /*html*/ `
                  <div class="post-notification-header">
                     <span class="color-gold-fill">${svgStar}</span>
                     ${this.getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">favorited your post ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "poll":
            // FIXME show poll results
            html = /*html*/ `
                  <div class="post-notification-header">
                     ${this.getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">poll has ended ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "update":
            html = /*html*/ `
                  <div class="post-notification-header">
                     ${this.getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}">post was edited ${dateToText(new Date(notification.created_at).getTime())} ago</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
            break;
      }
      const content = dom(`<div class="post-content">${html}</div>`)[0];
      return { elements: [content], toggles: [] };
   }

   getAuthorDomSmall(account: MastodonAccount) {
      return /*html*/ `
         <a href="${account.url}" class="inline-row">
            <img src="${account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
            <span>${getAccountName(account, true)}</span>
         </a>
         `;
   }

   getCommentMetaDom(comment: Comment<MastodonCommentData>, opName: string | null): HTMLElement[] {
      const mastodonComment = comment.data.mastodonComment;
      const metaDom = dom(/*html*/ `
         <span class="comment-author ${opName == comment.author ? "comment-author-op" : ""}">
         <a href="${comment.authorUrl}" class="inline-row">
            <img src="${mastodonComment.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
            <span>${getAccountName(comment.data.mastodonComment.account, true)}</span>
         </a>
         </span>
         <span>•</span>
         <a href="${comment.url}" style="text-decoration: underline;">${dateToText(comment.createdAt * 1000)}</a>
      `);
      return metaDom;
   }

   getFeed(): string {
      if (this.fixedHash) return this.fixedHash;
      const hash = window.location.hash;
      if (hash.length == 0) {
         return "";
      }
      let slashIndex = hash.indexOf("/");
      if (slashIndex == -1) return "";
      return decodeURIComponent(hash.substring(slashIndex + 1));
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
      super("Mastodon account");
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
               <button x-id="save" class="overlay-button" style="margin-left: auto;">Save</button>
               <div x-id="progress" class="color-fill hidden">${svgLoader}</div>
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

export class MastodonUserProfileView extends OverlayView {
   relationship: MastodonRelationship | null = null;
   localAccount: MastodonAccount | null = null;
   remoteAccount: MastodonAccount | null = null;

   constructor(account: MastodonAccount, public readonly userInfo: MastodonUserInfo) {
      super();

      const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.content.append(loadingDiv);
      (async () => {
         const resultLocalAccount = await MastodonApi.resolveAccount(account.url, userInfo);
         if (resultLocalAccount instanceof Error) {
            this.content.innerHTML = `
               <div class="post-loading">Could not lookup user ${getAccountName(account, true)} on ${userInfo.instance}: ${resultLocalAccount.message}.</div>
            `;
            return;
         }
         this.localAccount = resultLocalAccount;

         const remoteInstance = new URL(account.url).host;
         const resultRemoteAccount = await MastodonApi.lookupAccount(account.username, remoteInstance);
         if (resultRemoteAccount instanceof Error) {
            this.content.innerHTML = `
               <div class="post-loading">Could not lookup user ${getAccountName(account, true)} on ${remoteInstance}: ${resultRemoteAccount.message}</div>
            `;
            return;
         } else {
            this.remoteAccount = resultRemoteAccount;
            const resultRelationship = await MastodonApi.getRelationship(this.localAccount.id, userInfo);
            if (resultRelationship instanceof Error) {
               this.content.innerHTML = `<div class="post-loading">Could not load user ${getAccountName(this.localAccount, true)}: ${resultRelationship.message}</div>`;
               return;
            }
            this.relationship = resultRelationship;
            this.content.innerHTML = "";
            this.renderContent();
         }
      })();
   }

   renderContent(): void {
      if (!this.localAccount) return;
      const localAccount = this.localAccount;
      if (!this.remoteAccount) return;
      const remoteAccount = this.remoteAccount;

      this.content.style.gap = "0.5em";
      const avatarImageUrl = localAccount.avatar_static;
      const authorUrl = localAccount.url;
      const hasHeader = localAccount.header && !localAccount.header.includes("missing");
      const metaDom = dom(/*html*/ `
         <div>
            ${
               hasHeader
                  ? `<div style="max-height: 30vh; overflow: hidden; margin: -1em;"><img src="${localAccount.header}" class="mastodon-user-profile-header"></div>`
                  : ""
            }
            <div style="display: flex; margin-top: 2em; align-items: center; gap: var(--ledit-padding);">
               <a href="${authorUrl}" style="display: flex; gap: var(--ledit-padding);">
                  ${avatarImageUrl ? `<img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(2.5 * var(--ledit-font-size));">` : ""}
                  <div style="display: flex; flex-direction: column;">
                     <span><b>${getAccountName(localAccount, true)}</b></span>
                     <span style="font-size: var(--ledit-font-size-small); color: var(--ledit-color-dim);">@${localAccount.username}@${
         new URL(localAccount.url).host
      }</span>
                  </div>
               </a>
               ${
                  localAccount.username != this.userInfo.username && new URL(localAccount.url).host != this.userInfo.instance
                     ? `<button class="overlay-button" style="margin-left: auto; ${
                          this.relationship?.following ? "border: 1px solid var(--ledit-border-color);" : ""
                       }">${this.relationship?.following ? "Following" : "Follow"}</button>`
                     : ""
               }
            </div>

         </div>
         <div class="mastodon-user-profile-relationship-status">
            ${this.relationship?.followed_by ? `<span class="selected">Follows you</span>` : ""}
            ${this.relationship?.blocked_by ? `<span>Blocks you</span>` : ""}
            ${this.relationship?.blocking ? `<span>>Blocked</span>` : ""}
         </div>
         <div class="content-text">
            ${localAccount.note}
         </div>
         <div class="mastodon-user-profile-stats">
            <div x-id="accountPosts" class="selected"><span><b>${this.remoteAccount.statuses_count}</b></span><span>Posts</span></div>
            <div x-id="accountFollowing"><span><b>${this.remoteAccount.following_count}</b></span><span>Following</span></div>
            <div x-id="accountFollowers"><span><b>${this.remoteAccount.followers_count}</b></span><span>Followers</span></div>
         </div>
      `);
      this.content.append(...metaDom);

      let feed = getSource().getFeed().split("/");
      let posts = new PostListView(new MastodonSource(feed[0] + "/@" + localAccount.username + "@" + new URL(localAccount.url).host), false);
      let following = new MastodonAccountListView(
         async (nextPage) => {
            return await MastodonApi.getFollowing(remoteAccount, nextPage, this.userInfo);
         },
         this.userInfo
      );
      let followers = new MastodonAccountListView(
         async (nextPage) => {
            return await MastodonApi.getFollowers(remoteAccount, nextPage, this.userInfo);
         },
         this.userInfo
      );

      this.content.append(posts);
      posts.style.marginTop = "0";

      const elements = this.elements<{
         accountPosts: HTMLElement;
         accountFollowing: HTMLElement;
         accountFollowers: HTMLElement;
      }>();

      elements.accountPosts.addEventListener("click", () => {
         Array.from(this.content.querySelectorAll(".mastodon-user-profile-stats .selected")).forEach((el) => el.classList.remove("selected"));
         elements.accountPosts.classList.add("selected");
         followers.remove();
         following.remove();
         this.content.append(posts);
      });
      elements.accountFollowing.addEventListener("click", () => {
         Array.from(this.content.querySelectorAll(".mastodon-user-profile-stats .selected")).forEach((el) => el.classList.remove("selected"));
         elements.accountFollowing.classList.add("selected");
         followers.remove();
         posts.remove();
         this.content.append(following);
      });
      elements.accountFollowers.addEventListener("click", () => {
         Array.from(this.content.querySelectorAll(".mastodon-user-profile-stats .selected")).forEach((el) => el.classList.remove("selected"));
         elements.accountFollowers.classList.add("selected");
         following.remove();
         posts.remove();
         this.content.append(followers);
      });

      setLinkTargetsToBlank(this);
   }
}
customElements.define("ledit-mastodon-user-profile", MastodonUserProfileView);

export class MastodonAccountListView extends PagedListView<MastodonAccount> {
   constructor(
      public readonly fetchAccounts: (nextPage: PageIdentifier) => Promise<Page<MastodonAccount> | Error>,
      public readonly userInfo: MastodonUserInfo
   ) {
      super(fetchAccounts);
      this.classList.add("mastodon-account-list");
   }

   renderItems(accounts: MastodonAccount[]) {
      for (const account of accounts) {
         const avatarImageUrl = account.avatar_static;
         const authorUrl = account.url;
         const accountDom = dom(/*html*/ `
         <div class="mastodon-account">
            <a href="${authorUrl}" style="display: flex; gap: var(--ledit-padding);">
               ${avatarImageUrl ? `<img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(2.5 * var(--ledit-font-size));">` : ""}
               <div style="display: flex; flex-direction: column; font-size: var(--ledit-font-size-small);">
                  <span><b>${getAccountName(account, true)}</b></span>
                  <span style="color: var(--ledit-color-dim);">@${account.username}@${new URL(account.url).host}</span>
               </div>
            </a>
            ${
               /*
                  account.username != this.userInfo.username && new URL(account.url).host != this.userInfo.instance
                  ? `<button class="overlay-button" style="margin-left: auto; ${
                     this.relationship?.following ? "border: 1px solid var(--ledit-border-color);" : ""
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
