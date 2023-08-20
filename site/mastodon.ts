// @ts-ignore
import { CommentView } from "./comments";
import { Comment, ContentDom, Post, Posts, SortingOption, Source, SourcePrefix } from "./data";
import { EscapeCallback, NavigationCallback, escapeGuard, navigationGuard } from "./guards";
import "./mastodon.css";
import { PostEditor } from "./post-editor";
import { PostView, PostsView } from "./posts";
import { Bookmark, bookmarkToHash, getSettings, saveSettings } from "./settings";
import { svgBell, svgCircle, svgClose, svgLoader, svgPencil, svgReblog, svgReply, svgStar } from "./svg";
import { addCommasToNumber, dateToText, dom, navigate, renderGallery, renderVideo } from "./utils";
import { OverlayView, View } from "./view";

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

   static async getAccount(userName: string, userInfo: MastodonUserInfo): Promise<MastodonAccount | null> {
      try {
         const response = await fetch("https://" + userInfo.instance + "/api/v1/accounts/lookup?acct=" + userName);
         if (response.status != 200) return null;
         return (await response.json()) as MastodonAccount;
      } catch (e) {
         return null;
      }
   }

   static async getPostContext(postId: string, userInfo: MastodonUserInfo): Promise<MastodonPostContext | null> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/statuses/${postId}/context`, options);
         if (response.status != 200) return null;
         return (await response.json()) as MastodonPostContext;
      } catch (e) {
         return null;
      }
   }

   static async getPost(postId: string, userInfo: MastodonUserInfo): Promise<MastodonPost | null> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/statuses/${postId}`, options);
         if (response.status != 200) return null;
         return (await response.json()) as MastodonPost;
      } catch (e) {
         return null;
      }
   }

   static async resolvePost(postUrl: string, userInfo: MastodonUserInfo): Promise<MastodonPost | null> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v2/search/?q=${postUrl}&resolve=true`, options);
         if (response.status != 200) return null;
         const searchResult = (await response.json()) as any as {statuses: MastodonPost[]};
         if (searchResult.statuses.length == 0) return null;
         return searchResult.statuses[0];
      } catch (e) {
         return null;
      }
   }

   static async getAccountPosts(accountId: string, maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | null> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/accounts/${accountId}/statuses?limit=40${maxId ? maxId : ""}`, options);
         if (response.status != 200) return null;
         return (await response.json()) as MastodonPost[];
      } catch (e) {
         return null;
      }
   }

   static async getNotifications(maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonNotification[] | null> {
      if (!userInfo.bearer) return null;
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/notifications?limit=40${maxId ? maxId : ""}`, options);
         if (response.status != 200) return null;
         return (await response.json()) as MastodonNotification[];
      } catch (e) {
         return null;
      }
   }

   static async getHomeTimeline(maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | null> {
      if (!userInfo.bearer) return null;
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/timelines/home?limit=40${maxId ? maxId : ""}`, options);
         if (response.status != 200) return null;
         return (await response.json()) as MastodonPost[];
      } catch (e) {
         return null;
      }
   }

   static async getLocalTimeline(maxId: string | null, userInfo: MastodonUserInfo): Promise<MastodonPost[] | null> {
      if (!userInfo.bearer) return null;
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/timelines/public?limit=40${maxId ? maxId : ""}`, options);
         if (response.status != 200) return null;
         return (await response.json()) as MastodonPost[];
      } catch (e) {
         return null;
      }
   }

   static async publishPost(replyTo: MastodonPost | null, text: string, userInfo: MastodonUserInfo): Promise<MastodonPost | null> {
      if (!userInfo.bearer) return null;
      const resolvedPost = replyTo ? await this.resolvePost(replyTo.uri, userInfo) : null;
      if (replyTo && !resolvedPost) return null;
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
            return null;
         }
         return json as MastodonPost;
      } catch (e) {
         console.error("Couldn't publish post.", e);
         return null;
      }
   }

   static async reblogPost(post: MastodonPost, userInfo: MastodonUserInfo): Promise<boolean> {
      const resolvedPost = await this.resolvePost(post.uri, userInfo);
      if (!resolvedPost) return false;
      const url = `https://${userInfo.instance}/api/v1/statuses/${resolvedPost.id}/${post.reblogged ? "reblog" : "unreblog"}`;
      const options = {
         method: "POST",
         headers: {
            Authorization: "Bearer " + userInfo.bearer,
         },
      };
      const response = await fetch(url, options);
      return response.status == 200;
   }

   static async favouritePost(post: MastodonPost, userInfo: MastodonUserInfo): Promise<boolean> {
      const resolvedPost = await this.resolvePost(post.uri, userInfo);
      if (!resolvedPost) return false;
      const url = `https://${userInfo.instance}/api/v1/statuses/${resolvedPost.id}/${post.favourited ? "favourite" : "unfavourite"}`;
      const options = {
         method: "POST",
         headers: {
            Authorization: "Bearer " + userInfo.bearer,
         },
      };
      const response = await fetch(url, options);
      return response.status == 200;
   }
}

function getAccountName(account: MastodonAccount) {
   return account.display_name && account.display_name.length > 0 ? account.display_name : account.username;
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
export type MastodonPostData = {mastodonPost: MastodonPost, userInfo: MastodonUserInfo, id: string, inReplyToPost: MastodonPost | null }
export type MastodonCommentData = {mastodonComment: MastodonPost, userInfo: MastodonUserInfo }

export class MastodonSource implements Source<MastodonPostData, MastodonCommentData> {

   async mastodonPostToPost(mastodonPost: MastodonPost, onlyShowRoots: boolean, userInfo: MastodonUserInfo): Promise<Post<MastodonPostData> | null> {
      let postToView = mastodonPost.reblog ?? mastodonPost;
      if (onlyShowRoots && postToView.in_reply_to_account_id) return null;
      let postUrl = postToView.url;

      let inReplyToPost: MastodonPost | null = null;
      if (postToView.in_reply_to_id) {
         inReplyToPost = (await MastodonApi.getPost(postToView.in_reply_to_id, mastodonPost.userInfo ?? userInfo)) ?? inReplyToPost;
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
         }
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
            userInfo
         }
      };
   }

   showActionButtons(userInfo: MastodonUserInfo) {
      if (!userInfo.bearer) return;
      const actionButtons = dom(`<div class="fab-container"></div>`)[0];
      const publish = dom(`<div class="fab color-fill">${svgPencil}</div>`)[0];
      const notificationUrl = location.hash.replace("/home", "/notifications").substring(1);
      const notifications = dom(`<a href="#${notificationUrl}" style="margin-right: var(--ledit-margin);"><div class="fab color-fill">${svgBell}</div></a>`)[0];

      const header = dom(`<span class="overlay-editor-header">New post</span>`)[0];
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
                  if (mastodonPost) {
                     const post = await this.mastodonPostToPost(mastodonPost, false, userInfo);
                     if (!post) return false;
                     const postsView = document.querySelector("ledit-posts") as PostsView;
                     postsView.prependPost(post);
                  }
                  return mastodonPost != null;
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
                  <div class="inline-row" style="margin-bottom: var(--ledit-padding); color: var(--ledit-color);">
                        <span>Replying to</span>
                        <img src="${
                           mastodonComment.account.avatar_static
                        }" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                        <span>${getAccountName(mastodonComment.account)}</span>
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
               if (mastodonReply) {
                  const reply = await this.mastodonPostToComment(mastodonReply, true, userInfo);
                  if (!reply) return false;
                  if (commentOrPostView instanceof CommentView) {
                     commentOrPostView.prependReply(reply);
                  } else {
                     commentOrPostView.prependComment(reply);
                  }
               }
               return mastodonReply != null;
            },
            (name, bytes) => {},
            (name) => {}
         )
      );
   }

   async getPostsForUser(mastodonUser: string, after: string | null): Promise<Post<MastodonPostData>[]> {
      if (after == "end") return [];
      const tokens = mastodonUser.split("/");
      const timeline = tokens.length >= 2 ? tokens[1] : null;
      mastodonUser = tokens[0];
      let mastodonUserId: string | null = mastodonUserIds[mastodonUser];

      const userInfo = getUserInfo(mastodonUser);
      if (!userInfo) return [];

      if (!mastodonUserId) {
         const account = await MastodonApi.getAccount(userInfo.username, userInfo);
         if (!account) return [];
         mastodonUserId = account.id;
         mastodonUserIds[mastodonUser] = mastodonUserId;
         localStorage.setItem("mastodonCache", JSON.stringify(mastodonUserIds));
      }

      let maxId = after ? `&max_id=${after}` : "";

      let url;
      if (timeline == "notifications") {
         const mastodonNotifications = await MastodonApi.getNotifications(maxId, userInfo);
         if (!mastodonNotifications) return [];
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
         if (!mastodonPosts) return [];
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

   async getPosts(after: string | null): Promise<Posts<MastodonPostData>> {
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

      const noResult = { posts: [], after: null };
      if (after == "end") return noResult;

      const feedTokens = this.getFeed().split("/");
      if (feedTokens.length == 0) return noResult;

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
            let afters: (string | null)[] | undefined = after?.split("+");
            const promises: Promise<Post<MastodonPostData>[]>[] = [];
            for (let i = 0; i < urls.length; i++) {
               promises.push(this.getPostsForUser(urls[i], afters ? afters[i] : null));
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
            return { posts, after: newAfters!.join("+") };
         }
      }

      if (feedTokens.length == 2) {
         const userInfo = getUserInfo(feedTokens[0].trim());
         if (!userInfo) return noResult;
         if (!userInfo.bearer) {
            alert(`You must add a Mastodon account for ${userInfo.username}@${userInfo.instance}.`)
            return noResult;
         }
         const what = feedTokens[1].trim();
         if (what.length == 0) return noResult;

         let mastodonAccount: MastodonAccount | null = null;
         let mastodonPosts: MastodonPost[] | null = null;
         let mastodonNotifications: MastodonNotification[] | null = null;
         if (what == "home") {
            mastodonPosts = await MastodonApi.getHomeTimeline(after, userInfo);
            if (!mastodonPosts) return noResult;
         } else if (what == "notifications") {
            mastodonNotifications = await MastodonApi.getNotifications(after, userInfo);
         } else if (what == "local") {
            mastodonPosts = await MastodonApi.getLocalTimeline(after, userInfo);
         } else if (what.includes("@")) {
            let otherUserInfo = getUserInfo(what);
            if (!otherUserInfo || otherUserInfo.instance == userInfo.instance) otherUserInfo = userInfo;
            mastodonAccount = await MastodonApi.getAccount(what, otherUserInfo);
            if (!mastodonAccount) return noResult;
            mastodonPosts = await MastodonApi.getAccountPosts(mastodonAccount.id, after, otherUserInfo);
            if (mastodonPosts) {
               for (const mastodonPost of mastodonPosts) {
                  mastodonPost.userInfo = otherUserInfo;
               }
            }
         } else {
            const post = await MastodonApi.getPost(what, userInfo);
            if (!post) return noResult;
            mastodonPosts = [post];
         }

         const posts: Post<MastodonPostData>[] = [];
         if (mastodonAccount && !after) {
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
                  postPromises.push(Promise.resolve({
                     contentOnly: true,
                     notification,
                     userInfo,
                     id: notification.id,
                  }));
               }
            }

            // Wait for all the promises to resolve in parallel
            const fetchedPosts = await Promise.all(postPromises);

            // Push the fetched posts to the 'posts' array
            posts.push(...fetchedPosts);

            // FIXME show home button?
            this.showActionButtons(userInfo);
         }

         return {posts: posts, after: maxId};
      }

      return noResult;
   }

   async getComments(post: Post<MastodonPostData>): Promise<Comment<MastodonCommentData>[]> {
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

      let context = await MastodonApi.getPostContext(statusId, commentUserInfo);
      if (!context) return [];

      if (context.ancestors.length > 0) {
         // FIXME if the root is from our instance, query our instance
         // instead of whatever instance we fetched the context from.
         // this will give us properly set favourite and reblogged flags.
         let root = context.ancestors[0];
         if (new URL(root.url).host == userInfo.instance) {
            const resolvedRoot = await MastodonApi.resolvePost(root.url, userInfo);
            if (resolvedRoot) {
               root = resolvedRoot;
               commentUserInfo = userInfo;
            }
         }
         rootId = root.id;
         // FIXME matching by content is bad
         const rootComment = this.mastodonPostToComment(root, root.uri == postToView.uri, userInfo);
         roots.push(rootComment);
         comments.push(rootComment);
         commentsById.set(root.id, rootComment);
         const fullContext = await MastodonApi.getPostContext(root.id, commentUserInfo);
         if (fullContext) context = fullContext;
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
      return dom(/*html*/ `
         ${
            avatarImageUrl
               ? /*html*/ `
               <a href="${authorUrl}" target="_blank" style="gap: var(--ledit-padding);">
                  <img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(2.5 * var(--ledit-font-size));">
                  <div>
                     <span><b>${getAccountName(postToView.account)}</b></span>
                     <span>${postToView.account.username}${
                    new URL(postToView.uri).host == userInfo.instance ? "" : "@" + new URL(postToView.uri).host
                 }</span>
                  </div>
               </a>
               `
               : userInfo.username + "@" + userInfo.instance
         }
         <a href="${postUrl}" target="_blank" style="text-decoration: underline; margin-left: auto; align-items: flex-start;">${dateToText(post.createdAt * 1000)}</span>
      `);
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
         <a href="${mastodonPost.account.url}" target="_blank" class="mastodon-prelude">
            <div class="post-meta">
                  <span>Boosted by</span>
                  <img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                  <span>${getAccountName(mastodonPost.account)}</span>
            </div>
         </a>
         `;
      }

      if (inReplyToPost) {
         const avatarImageUrl = inReplyToPost.account.avatar_static;
         prelude += /*html*/ `
         <a href="${inReplyToPost.url}" target="_blank" class="mastodon-prelude">
            <div class="post-meta">
                  <span>In reply to</span>
                  <img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                  <span>${getAccountName(inReplyToPost.account)}</span>
            </div>
         </a>
         `;
      }
      elements.push(
         dom(/*html*/ `
         <div class="content-text">
            ${prelude}${postToView.content}
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
                     <a href="${notification.status!.url}" target="_blank">mentioned you ${dateToText(
               new Date(notification.created_at).getTime()
            )} ago</a>
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
                     <a href="${notification.status!.url}" target="_blank">reblogged you ${dateToText(
               new Date(notification.created_at).getTime()
            )} ago</a>
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
                     <a href="${notification.status!.url}" target="_blank">favorited your post ${dateToText(
               new Date(notification.created_at).getTime()
            )} ago</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "poll":
            // FIXME show poll results
            html = /*html*/ `
                  <div class="post-notification-header">
                     ${this.getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}" target="_blank">poll has ended ${dateToText(
               new Date(notification.created_at).getTime()
            )} ago</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
            break;
         case "update":
            html = /*html*/ `
                  <div class="post-notification-header">
                     ${this.getAuthorDomSmall(notification.account)}
                     <a href="${notification.status!.url}" target="_blank">post was edited ${dateToText(
               new Date(notification.created_at).getTime()
            )} ago</a>
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
         <a href="${account.url}" target="_blank" class="inline-row">
            <img src="${account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
            <span>${getAccountName(account)}</span>
         </a>
         `;
   }

   getCommentMetaDom(comment: Comment<MastodonCommentData>, opName: string | null): HTMLElement[] {
      const mastodonComment = comment.data.mastodonComment;
      const metaDom = dom(/*html*/ `
         <span class="comment-author ${opName == comment.author ? "comment-author-op" : ""}">
         <a href="${comment.authorUrl}" target="_blank" class="inline-row">
            <img src="${mastodonComment.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
            <span>${comment.author}</span>
         </a>
         </span>
         <span>•</span>
         <a href="${comment.url}" target="_blank" style="text-decoration: underline;">${dateToText(comment.createdAt * 1000)}</a>
      `);
      return metaDom;
   }

   getFeed(): string {
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
      super();
      if (!this.bookmark.supplemental) {
         throw new Error("Need a bookmark with user info!");
      }
      this.renderContent();
   }

   renderContent() {
      this.content.style.gap = "0.5em";
      const editorDom = dom(/*html*/ `
            <div x-id="headerRow" class="overlay-editor-header">Mastodon account</div>
            <input x-id="user" value="${this.bookmark.supplemental!.username ? this.bookmark.supplemental!.username + "@" + this.bookmark.supplemental!.instance : ""}" placeholder="user@instance.com">
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