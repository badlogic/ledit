// @ts-ignore
import "./mastodon.css";
import { CommentView } from "./comments";
import { Comment, ContentDom, Post, Posts, SortingOption, Source, SourcePrefix } from "./data";
import { PostEditor } from "./post-editor";
import { PostView, PostsView } from "./posts";
import { getSettings } from "./settings";
import { svgBell, svgCircle, svgPencil, svgReblog, svgReply, svgStar } from "./svg";
import { addCommasToNumber, dateToText, dom, renderGallery, renderVideo } from "./utils";
import { View } from "./view";

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
}

interface MastodonNotification {
   id: string;
   type: "mention" | "status" | "reblog" | "follow" | "follow_request" | "favourite" | "poll" | "update";
   created_at: string;
   account: MastodonAccount;
   status: MastodonPost | null;
}

function getAccountName(account: MastodonAccount) {
   return account.display_name && account.display_name.length > 0 ? account.display_name : account.username;
}

function extractUserHostAndBearer(input: string): { username: string; host: string; bearer: string | null } | null {
   let username = "";
   let host = "";
   let bearer: string | null = null;

   if (input.startsWith("https://")) {
      const url = new URL(input);
      if (url.pathname.startsWith("/users/")) {
         const userPart = url.pathname.substring("/users/".length);
         const userHostParts = url.host.split(".");
         if (userHostParts.length >= 2) {
            username = userPart;
            host = userHostParts.slice(-2).join(".");
         }
      }
   } else {
      if (input.startsWith("@")) input = input.substring(1);
      const tokens = input.split("@");
      if (tokens.length != 2) {
         return null;
      }
      username = tokens[0];
      host = tokens[1];
      const bearerIndex = host.indexOf(":");
      if (bearerIndex != -1) {
         bearer = host.substring(bearerIndex + 1);
         host = host.substring(0, bearerIndex);
      }
   }

   return { username, host, bearer };
}

async function publishPost(userInfo: MastodonUserInfo, replyToId: string | null, text: string): Promise<MastodonPost | null> {
   if (!userInfo.bearer) return null;
   try {
      const response = await fetch(`https://${userInfo.host}/api/v1/statuses`, {
         method: "POST",
         headers: {
            Authorization: `Bearer ${userInfo.bearer}`,
            "Content-Type": "application/json",
         },
         body: JSON.stringify(replyToId ? { status: text, in_reply_to_id: replyToId } : { status: text }),
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

async function reblogPost(post: MastodonPost, userInfo: MastodonUserInfo): Promise<boolean> {
   const url = `https://${userInfo.host}/api/v1/statuses/${post.id}/${post.reblogged ? "reblog" : "unreblog"}`;
   const options = {
      method: "POST",
      headers: {
         Authorization: "Bearer " + userInfo.bearer,
      },
   };
   const response = await fetch(url, options);
   return response.status == 200;
}

async function favouritePost(post: MastodonPost, userInfo: MastodonUserInfo): Promise<boolean> {
   const url = `https://${userInfo.host}/api/v1/statuses/${post.id}/${post.favourited ? "favourite" : "unfavourite"}`;
   const options = {
      method: "POST",
      headers: {
         Authorization: "Bearer " + userInfo.bearer,
      },
   };
   const response = await fetch(url, options);
   return response.status == 200;
}

type MastodonUserInfo = { username: string; host: string; bearer: string | null };

export class MastodonSource implements Source {
   localizeMastodonAccountIds(mastodonAccount: MastodonAccount, userInfo: MastodonUserInfo) {
      mastodonAccount.url = `https://${userInfo.host}/@${mastodonAccount.username}@${new URL(mastodonAccount.url).host}/`;
   }

   localizeMastodonPostIds(mastodonPost: MastodonPost, userInfo: MastodonUserInfo) {
      if (!userInfo.bearer) return;
      mastodonPost.url = `https://${userInfo.host}/@${mastodonPost.account.username}@${new URL(mastodonPost.account.url).host}/${mastodonPost.id}`;
      this.localizeMastodonAccountIds(mastodonPost.account, userInfo);
      if (mastodonPost.reblog) {
         mastodonPost.reblog.url = `https://${userInfo.host}/@${mastodonPost.reblog.account.username}@${
            new URL(mastodonPost.reblog.account.url).host
         }/${mastodonPost.reblog.id}`;
         this.localizeMastodonAccountIds(mastodonPost.reblog.account, userInfo);
      }
   }

   async mastodonPostToPost(mastodonPost: MastodonPost, userInfo: MastodonUserInfo): Promise<Post | null> {
      const onlyShowRoots = getSettings().showOnlyMastodonRoots;
      this.localizeMastodonPostIds(mastodonPost, userInfo);
      let postToView = mastodonPost.reblog ?? mastodonPost;
      if (onlyShowRoots && postToView.in_reply_to_account_id) return null;
      const avatarImageUrl = postToView.account.avatar_static;
      let postUrl = postToView.url;

      let inReplyToPost: MastodonPost | null = null;
      if (postToView.in_reply_to_id) {
         const response = await fetch(`https://${userInfo.host}/api/v1/statuses/${postToView.in_reply_to_id}`);
         if (response.status == 200) inReplyToPost = await response.json();
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
      this.localizeMastodonPostIds(reply, userInfo);
      let replyUrl = reply.url;
      const avatarImageUrl = reply.account.avatar_static;
      const content = this.getPostOrCommentContentDom(reply, null, userInfo, true);
      return {
         url: replyUrl,
         author: avatarImageUrl
            ? /*html*/ `
            <img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(1 * var(--ledit-font-size));">
            <span>${getAccountName(reply.account)}</span>
         `
            : getAccountName(reply.account),
         authorUrl: reply.account.url,
         createdAt: new Date(reply.created_at).getTime() / 1000,
         score: null,
         content,
         replies: [],
         highlight,
         mastodonComment: reply
      } as Comment;
   }

   extractUsernames(element: CommentView | PostView) {
      const mentionLinks = element.querySelectorAll(".content-text a.u-url.mention");
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
                  const mastodonPost = await publishPost(userInfo, null, text);
                  if (mastodonPost) {
                     const post = await this.mastodonPostToPost(mastodonPost, userInfo);
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
      userHandles.push(...this.extractUsernames(commentOrPostView));
      const commentUser = "@" + mastodonComment.account.username + (commentHost == userInfo.host ? "" : "@" + commentHost);
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
               const mastodonReply = await publishPost(userInfo, mastodonComment.id, text);
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

      const userInfo = extractUserHostAndBearer(mastodonUser);
      if (!userInfo) return [];

      if (!mastodonUserId) {
         const url = "https://" + userInfo.host + "/api/v1/accounts/lookup?acct=" + userInfo.username;
         const response = await fetch(url);
         const json = await response.json();
         if (!json.id) return [];
         mastodonUserId = json.id;
         mastodonUserIds[mastodonUser] = mastodonUserId;
         localStorage.setItem("mastodonCache", JSON.stringify(mastodonUserIds));
      }

      let maxId = after ? `&max_id=${after}` : "";
      let options = undefined;
      if (userInfo.bearer) {
         options = {
            method: "GET",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
      }

      let url;
      if (timeline == "home") {
         url = `https://${userInfo.host}/api/v1/timelines/home?limit=40${maxId}`;
      } else if (timeline == "notifications") {
         url = `https://${userInfo.host}/api/v1/notifications?limit=40${maxId}`;
      } else {
         url = `https://${userInfo.host}/api/v1/accounts/${mastodonUserId}/statuses?limit=40${maxId}`;
      }

      const response = await fetch(url, options);
      const json = await response.json();

      if (timeline != "notifications") {
         const mastodonPosts = json as MastodonPost[];
         const posts: Post[] = [];
         for (const mastodonPost of mastodonPosts) {
            const post = await this.mastodonPostToPost(mastodonPost, userInfo);
            if (post) posts.push(post);
         }
         if (timeline == "home") this.showActionButtons(userInfo);
         return posts;
      } else {
         const notifications = json as MastodonNotification[];
         const posts: Post[] = [];
         for (const notification of notifications) {
            posts.push({
               contentOnly: true,
               notification,
               userInfo,
               id: notification.id,
            } as any);
         }
         return posts;
      }
   }

   async getPosts(after: string | null): Promise<Posts> {
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
         const userInfo = extractUserHostAndBearer(urls[i]);
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

      return { posts, after: newAfters!.join("+") };
   }

   async getComments(post: Post): Promise<Comment[]> {
      const mastodonPost = (post as any).mastodonPost as MastodonPost;
      const userInfo = (post as any).userInfo as MastodonUserInfo;
      let postToView = mastodonPost.reblog ?? mastodonPost;
      let host = new URL(postToView.uri).host;
      let statusId = postToView.uri.split("/").pop();
      if (userInfo.bearer) {
         host = userInfo.host;
         statusId = postToView.id;
      }
      const response = await fetch(`https://${host}/api/v1/statuses/${statusId}/context`);
      const context = (await response.json()) as { ancestors: MastodonPost[]; descendants: MastodonPost[] };

      const roots: Comment[] = [];
      const comments: Comment[] = [];
      const commentsById = new Map<string, Comment>();

      let rootId: string | null = null;
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
         // if (mastodonComment.in_reply_to_id == statusId) continue;
         if (commentsById.get(mastodonComment.in_reply_to_id!)) {
            const other = commentsById.get(mastodonComment.in_reply_to_id!)!;
            other.replies.push(comment);
         }
      }
      return roots;
   }

   getMetaDom(post: Post): HTMLElement[] {
      const postToView = (post as any).mastodonPost.reblog ?? (post as any).mastodonPost;
      const userInfo = (post as any).userInfo;
      const avatarImageUrl = postToView.account.avatar_static;
      const postUrl = postToView.url;
      const authorUrl = postToView.account.url;

      return dom(/*html*/ `
         ${
            avatarImageUrl
               ? /*html*/ `
               <a href="${authorUrl}" target="_blank" style="gap: var(--ledit-padding);">
                  <img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(2.5 * var(--ledit-font-size));">
                  <div>
                     <span><b>${getAccountName(postToView.account)}</b></span>
                     <span>${postToView.account.username}@${
                    new URL(postToView.uri).host == userInfo.host ? null : new URL(postToView.uri).host
                 }</span>
                  </div>
               </a>
               `
               : userInfo.username + "@" + userInfo.host
         }
         <span style="margin-left: auto; align-items: flex-start;">${dateToText(post.createdAt * 1000)}</span>
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

   getPollDom(post: MastodonPost): HTMLElement | null{
      if (post.poll) {
         const pollDiv = dom(`<div></div>`)[0];
         for (const option of post.poll.options) {
            pollDiv.append(dom(`<div class="mastodon-poll-option color-fill">${svgCircle}${option.title}</div>`)[0]);
         }
         pollDiv.append(
            dom(`<div class="mastodon-poll-summary">${post.poll.votes_count} votes, ${post.poll.voters_count} voters</div>`)[0]
         );
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

      return mediaDom.children.length > 0 ? {elements: [mediaDom], toggles} : null;
   }

   getPostOrCommentContentDom(
      mastodonPost: MastodonPost,
      inReplyToPost: MastodonPost | null,
      userInfo: MastodonUserInfo,
      isComment: boolean
   ): ContentDom {
      let postToView = mastodonPost.reblog ?? mastodonPost;
      const elements: Element[] = []
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
      elements.push(dom(/*html*/ `
         <div class="content-text">
            ${prelude}${postToView.content}
         </div>
      `)[0]);
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
            if (!(await reblogPost(postToView, userInfo))) {
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

            if (!(await favouritePost(postToView, userInfo))) {
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
      this.localizeMastodonAccountIds(notification.account, (post as any).userInfo);
      if (notification.status) this.localizeMastodonPostIds(notification.status!, (post as any).userInfo);
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
      const metaDom = dom(/*html*/ `
         <span class="comment-author ${opName == comment.author ? "comment-author-op" : ""}">
         <a href="${comment.authorUrl}" target="_blank">${comment.author}</a>
         </span>
         <span>•</span>
         <span>${dateToText(comment.createdAt * 1000)}</span>
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
