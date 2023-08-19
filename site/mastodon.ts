// @ts-ignore
import "./mastodon.css";
import { CommentView } from "./comments";
import { Comment, ContentDom, Post, Posts, SortingOption, Source, SourcePrefix } from "./data";
import { PostEditor } from "./post-editor";
import { PostView, PostsView } from "./posts";
import { Bookmark, SettingsView, getSettings, saveSettings } from "./settings";
import { svgBell, svgCircle, svgClose, svgLoader, svgPencil, svgReblog, svgReply, svgStar } from "./svg";
import { addCommasToNumber, dateToText, dom, renderGallery, renderVideo } from "./utils";
import { View } from "./view";
import { EscapeCallback, NavigationCallback, escapeGuard, navigationGuard } from "./guards";

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

export class MastodonSource implements Source {

   async mastodonPostToPost(mastodonPost: MastodonPost, onlyShowRoots: boolean, userInfo: MastodonUserInfo): Promise<Post | null> {
      let postToView = mastodonPost.reblog ?? mastodonPost;
      if (onlyShowRoots && postToView.in_reply_to_account_id) return null;
      let postUrl = postToView.url;

      let inReplyToPost: MastodonPost | null = null;
      if (postToView.in_reply_to_id) {
         inReplyToPost = (await MastodonApi.getPost(postToView.in_reply_to_id, mastodonPost.userInfo ?? userInfo)) ?? inReplyToPost;
      }

      return {
         url: postUrl,
         domain: null,
         feed: "",
         title: "",
         isSelf: false,
         author: getAccountName(mastodonPost.account),
         authorUrl: null,
         createdAt: new Date(postToView.created_at).getTime() / 1000,
         score: postToView.favourites_count,
         numComments: postToView.replies_count + (inReplyToPost && postToView.replies_count == 0 ? 1 : 0),
         contentOnly: false,
         mastodonPost,
         userInfo,
         id: mastodonPost.id,
         inReplyToPost,
      } as Post;
   }

   mastodonPostToComment(reply: MastodonPost, highlight: boolean, userInfo: MastodonUserInfo): Comment {
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
         mastodonComment: reply,
         userInfo
      } as Comment;
   }

   showActionButtons(userInfo: MastodonUserInfo) {
      if (!userInfo.bearer) return;
      const actionButtons = dom(`<div class="fab-container"></div>`)[0];
      const notificationUrl = location.hash.replace("/home", "/notifications").substring(1);
      const notifications = dom(`<a href="#${notificationUrl}"><div class="fab color-fill">${svgBell}</div></a>`)[0];
      const publish = dom(`<div class="fab color-fill">${svgPencil}</div>`)[0];

      const header = dom(`<span>New post</span>`)[0];
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
      userHandles.push(...extractUsernames(mastodonComment));
      const commentUser = "@" + mastodonComment.account.username + (commentHost == userInfo.instance ? "" : "@" + commentHost);
      if (commentUser) userHandles.push(commentUser);

      const header = dom(/*html*/ `
               <div class="editor-supplement">
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

   async getPostsForUser(mastodonUser: string, after: string | null): Promise<Post[]> {
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
         const posts: Post[] = [];
         for (const notification of mastodonNotifications) {
            if (notification.type == "mention") {
               const post = await this.mastodonPostToPost(notification.status!, false, userInfo);
               if (!post) {
                  posts.push({
                     contentOnly: true,
                     notification,
                     userInfo,
                     id: notification.id,
                  } as any);
               } else {
                  posts.push(post);
               }
            } else {
               posts.push({
                  contentOnly: true,
                  notification,
                  userInfo,
                  id: notification.id,
               } as any);
            }
         }
         return posts;
      } else {
         const mastodonPosts =
            timeline == "home"
               ? await MastodonApi.getHomeTimeline(maxId, userInfo)
               : await MastodonApi.getAccountPosts(mastodonUserId, maxId, userInfo);
         if (!mastodonPosts) return [];
         const posts: Post[] = [];
         const postPromises: Promise<Post | null>[] = [];
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

   async getPosts(after: string | null): Promise<Posts> {
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
            const promises: Promise<Post[]>[] = [];
            for (let i = 0; i < urls.length; i++) {
               promises.push(this.getPostsForUser(urls[i], afters ? afters[i] : null));
            }

            const promisesResult = await Promise.all(promises);
            const posts: Post[] = [];
            const newAfters = [];
            for (let i = 0; i < urls.length; i++) {
               posts.push(...promisesResult[i]);
               const userInfo = getUserInfo(urls[i]);
               if (!userInfo) {
                  newAfters.push(null);
                  continue;
               }

               let maxId = promisesResult[i].length == 0 ? "end" : (promisesResult[i][promisesResult[i].length - 1] as any).id;
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

         let maxId: string | null = null;
         if (mastodonPosts) {
            maxId = mastodonPosts.length == 0 ? "end" : mastodonPosts[mastodonPosts.length - 1].id;
         }
         if (mastodonNotifications) {
            maxId = mastodonNotifications.length == 0 ? "end" : mastodonNotifications[mastodonNotifications.length - 1].id;
         }
         maxId = maxId ? `&max_id=${maxId}` : "";

         const posts: Post[] = [];
         if (mastodonPosts) {
            const postPromises: Promise<Post | null>[] = [];
            for (const mastodonPost of mastodonPosts) {
               postPromises.push(this.mastodonPostToPost(mastodonPost, getSettings().showOnlyMastodonRoots, userInfo));
            }
            const resolvedPosts = await Promise.all(postPromises);
            for (const post of resolvedPosts) {
               if (post) posts.push(post);
            }
            if (what == "home") this.showActionButtons(userInfo);
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
         }

         return {posts: posts, after: maxId};
      }

      return noResult;
   }

   async getComments(post: Post): Promise<Comment[]> {
      const mastodonPost = (post as any).mastodonPost as MastodonPost;
      const userInfo = (post as any).userInfo as MastodonUserInfo;
      const postToView = mastodonPost.reblog ?? mastodonPost;
      const host = new URL(postToView.uri).host;
      const statusId = postToView.uri.split("/").pop()!;
      let commentUserInfo: MastodonUserInfo = userInfo.instance == host ? userInfo : { username: "", instance: host, bearer: null };
      let rootId: string | null = null;
      const roots: Comment[] = [];
      const comments: Comment[] = [];
      const commentsById = new Map<string, Comment>();

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
         const rootComment = this.mastodonPostToComment(root, root.id == statusId, userInfo);
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
         const comment = this.mastodonPostToComment(reply, reply.id == statusId, userInfo);
         if (!rootId && reply.in_reply_to_id == statusId) roots.push(comment);
         if (reply.id == rootId) roots.push(comment);
         comments.push(comment);
         commentsById.set(reply.id, comment);
      }
      for (const comment of comments) {
         const mastodonComment = (comment as any).mastodonComment as MastodonPost;
         if (commentsById.get(mastodonComment.in_reply_to_id!)) {
            const other = commentsById.get(mastodonComment.in_reply_to_id!)!;
            other.replies.push(comment);
         }
      }
      return roots;
   }

   getMetaDom(post: Post): HTMLElement[] {
      const postToView = ((post as any).mastodonPost.reblog ?? (post as any).mastodonPost) as MastodonPost;
      const userInfo = (post as any).userInfo as MastodonUserInfo;
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

   getContentDom(post: Post): ContentDom {
      if (!post.contentOnly) {
         let userInfo = (post as any).userInfo;
         let mastodonPost = (post as any).mastodonPost as MastodonPost;
         let inReplyToPost: MastodonPost | null = (post as any).inReplyToPost;
         return this.getPostOrCommentContentDom(mastodonPost, inReplyToPost, userInfo, false);
      } else {
         return this.getNotificationContentDom(post);
      }
   }

   getPollDom(post: MastodonPost): HTMLElement | null {
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
         prelude = /*html*/ `
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
      // FIXME when fetching comments, the reblog and favourited fields aren't sett. reblog is null, favourited is missing entirely.
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
               if (parent instanceof PostView) break;
               parent = parent.parentElement;
            }
            this.showCommentReplyEditor(postToView, userInfo, parent as PostView);
         });

         const boostElements = View.elements<{
            boostIcon: HTMLElement;
            boostCount: HTMLElement;
         }>(boost);

         boost.addEventListener("click", async () => {
            postToView.reblogged = !postToView.reblogged;
            if (!(await MastodonApi.reblogPost(postToView, userInfo))) {
               alert("Coulnd't (un)reblog post");
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
         });

         const favouriteElements = View.elements<{
            favouriteIcon: HTMLElement;
            favouriteCount: HTMLElement;
         }>(favourite);

         favourite.addEventListener("click", async () => {
            postToView.favourited = !postToView.favourited;

            if (!(await MastodonApi.favouritePost(postToView, userInfo))) {
               alert("Couldn't (un)favourite post");
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
         });
      }
      toggles.push(boost);
      toggles.push(favourite);

      return { elements: elements, toggles: toggles };
   }

   getNotificationContentDom(post: Post) {
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

   getCommentMetaDom(comment: Comment, opName: string): HTMLElement[] {
      const mastodonComment = (comment as any).mastodonComment as MastodonPost;
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

export class MastodonUserEditor extends View {
   escapeCallback: EscapeCallback | undefined;
   navigationCallback: NavigationCallback | undefined;

   constructor(public readonly user: MastodonUserInfo, public readonly isNew: boolean) {
      super();
      this.render();
      this.classList.add("editor-container");
   }

   render() {
      this.innerHTML = /*html*/ `
         <div x-id="editor" class="editor">
            <div x-id="close" class="editor-close"><span class="color-fill">${svgClose}</span></div>
            <div x-id="headerRow" class="editor-header">Mastodon user</div>
            <input x-id="user" value="${this.user.username}" placeholder="user@instance.com">
            <input x-id="bearer" value="${this.user.username}" placeholder="Access token">
            <div class="editor-buttons">
               <button x-id="save" class="editor-button" style="margin-left: auto;">Save</button>
               <div x-id="progress" class="color-fill hidden">${svgLoader}</div>
            </div>
         </div>
      `;

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

         const bookmark: Bookmark = {
            source: "m/",
            label: `${userInfo.username}@${userInfo.instance}`,
            ids: [`${userInfo.username}@${userInfo.instance}/home`],
            isDefault: false,
            supplemental: userInfo,
         };
         getSettings().bookmarks.push(bookmark);
         saveSettings();
         this.close();
         document.body.append(new SettingsView());
      });

      // Prevent clicking in input elements to dismiss editor
      elements.editor.addEventListener("click", (event: Event) => {
         event.stopPropagation();
      });

      // Close when container is clicked
      this.addEventListener("click", () => {
         this.close();
      });

      // Close when close button is clicked
      elements.close.addEventListener("click", () => {
         this.close();
      });

      // Close when escape is pressed
      this.escapeCallback = escapeGuard.register(1000, () => {
         this.close();
      });

      // Close on back navigation
      this.navigationCallback = navigationGuard.register(1000, () => {
         this.close();
         return false;
      });

      // Prevent underlying posts from scrolling
      document.body.style.overflow = "hidden";
   }

   close() {
      this.remove();
      escapeGuard.remove(this.escapeCallback!);
      navigationGuard.remove(this.navigationCallback!);
      document.body.style.overflow = "";
   }
}
customElements.define("ledit-mastodon-user-editor", MastodonUserEditor);
