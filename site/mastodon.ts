import { Comment, ContentDom, Post, Posts, SortingOption, Source, SourcePrefix } from "./data";
import { RedditSource } from "./reddit";
import { getSettings } from "./settings";
import { svgCircle, svgDownArrow, svgReblog, svgStar, svgUpArrow } from "./svg";
import { addCommasToNumber, dom, proxyFetch, renderGallery, renderVideo } from "./utils";

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
   favourites_count: number;
   id: string;
   in_reply_to_account_id: string | null;
   in_reply_to_id: string | null;
   media_attachments: MastodonMedia[];
   metions: MastodonMention;
   poll: MastodonPoll;
   reblog: MastodonPost | null;
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

   async getMastodonUserPosts(mastodonUser: string, after: string | null): Promise<Post[]> {
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

      let page = after ? `&max_id=${after}` : "";
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
         url = `https://${userInfo.host}/api/v1/timelines/home?limit=40${page}`;
      } else if (timeline == "notifications") {
         url = `https://${userInfo.host}/api/v1/notifications?limit=40${page}`;
      } else {
         url = `https://${userInfo.host}/api/v1/accounts/${mastodonUserId}/statuses?limit=40${page}`;
      }

      const response = await fetch(url, options);
      const json = await response.json();

      if (timeline != "notifications") {
         const mastodonPosts = json as MastodonPost[];
         const posts: Post[] = [];
         const onlyShowRoots = getSettings().showOnlyMastodonRoots;
         for (const mastodonPost of mastodonPosts) {
            this.localizeMastodonPostIds(mastodonPost, userInfo);
            let postToView = mastodonPost.reblog ?? mastodonPost;
            if (onlyShowRoots && postToView.in_reply_to_account_id) continue;
            const avatarImageUrl = postToView.account.avatar_static;
            let postUrl = postToView.url;
            let authorUrl = postToView.account.url;

            const post = {
               url: postUrl,
               domain: postToView.account.username + "@" + new URL(postToView.uri).host,
               feed: `${
                  avatarImageUrl
                     ? `<img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(2.5 * var(--ledit-font-size));">`
                     : userInfo.username + "@" + userInfo.host
               }`,
               title: "",
               isSelf: false,
               author: getAccountName(postToView.account),
               authorUrl: authorUrl,
               createdAt: new Date(postToView.created_at).getTime() / 1000,
               score: postToView.favourites_count,
               numComments: postToView.replies_count,
               contentOnly: false,
               mastodonPost,
               userInfo,
               id: mastodonPost.id,
            } as Post;
            posts.push(post);
         }
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
         promises.push(this.getMastodonUserPosts(urls[i], afters ? afters[i] : null));
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
      const context = (await response.json()) as { descendants: MastodonPost[] };

      const roots: Comment[] = [];
      const comments: Comment[] = [];
      const commentsById = new Map<string, Comment>();
      for (const reply of context.descendants) {
         this.localizeMastodonPostIds(reply, userInfo);
         let replyUrl = reply.url;
         const avatarImageUrl = reply.account.avatar_static;
         const content = this.getContent(reply);
         const comment = {
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
            mastodonComment: reply,
         } as Comment;
         if (reply.in_reply_to_id == statusId) roots.push(comment);
         comments.push(comment);
         commentsById.set(reply.id, comment);
      }
      for (const comment of comments) {
         const mastodonComment = (comment as any).mastodonComment as MastodonPost;
         if (mastodonComment.in_reply_to_id == statusId) continue;
         if (commentsById.get(mastodonComment.in_reply_to_id!)) {
            const other = commentsById.get(mastodonComment.in_reply_to_id!)!;
            other.replies.push(comment);
         }
      }
      return roots;
   }

   getContentDom(post: Post): ContentDom {
      if (!post.contentOnly) {
         let mastodonPost = (post as any).mastodonPost as MastodonPost;
         return this.getContent(mastodonPost);
      } else {
         const notification = (post as any).notification as MastodonNotification;
         this.localizeMastodonAccountIds(notification.account, (post as any).userInfo);
         let html = "";
         switch (notification.type) {
            case "mention":
               this.localizeMastodonPostIds(notification.status!, (post as any).userInfo);
               html = /*html*/ `
                  <div class="inline-row">
                     <span class="svgIcon color-fill">${svgStar}</span>
                     <a href="${notification.account.url}" class="inline-row">
                        <img src="${notification.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                        <span>${getAccountName(notification.account)}</span>
                     </a>
                     <a href="${notification.status!.url}">mentioned you</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
               break;
            case "status":
               break;
            case "reblog":
               this.localizeMastodonPostIds(notification.status!, (post as any).userInfo);
               html = /*html*/ `
                  <div class="inline-row">
                     <span class="svgIcon color-fill">${svgReblog}</span>
                     <a href="${notification.account.url}" class="inline-row">
                        <img src="${notification.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                        <span>${getAccountName(notification.account)}</span>
                     </a>
                     <a href="${notification.status!.url}">reblogged you</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
               break;
            case "follow":
               html = /*html*/ `
               <div class="inline-row" style="margin-bottom: -1em">
                  <a href="${notification.account.url}" class="inline-row">
                     <img src="${notification.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                     <span>${getAccountName(notification.account)}</span>
                  </a>
                  <span>follows you</span>
               </div>`;
               break;
            case "follow_request":
               html = /*html*/ `
               <div class="inline-row" style="margin-bottom: -1em">
                  <a href="${notification.account.url}" class="inline-row">
                     <img src="${notification.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                     <span>${getAccountName(notification.account)}</span>
                  </a>
                  <span>wants to follow you</span>
               </div>`;
               break;
               break;
            case "favourite":
               this.localizeMastodonPostIds(notification.status!, (post as any).userInfo);
               html = /*html*/ `
                  <div class="inline-row">
                     <span class="svgIcon color-fill">${svgStar}</span>
                     <a href="${notification.account.url}" class="inline-row">
                        <img src="${notification.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                        <span>${getAccountName(notification.account)}</span>
                     </a>
                     <a href="${notification.status!.url}">favorited your post</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
               break;
            case "poll":
               this.localizeMastodonPostIds(notification.status!, (post as any).userInfo);
               html = /*html*/ `
                  <div class="inline-row">
                     <span class="svgIcon color-fill">${svgReblog}</span>
                     <a href="${notification.account.url}" class="inline-row">
                        <img src="${notification.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                        <span>${getAccountName(notification.account)}'s</span>
                     </a>
                     <a href="${notification.status!.url}">poll has ended</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
               break;
            case "update":
               this.localizeMastodonPostIds(notification.status!, (post as any).userInfo);
               html = /*html*/ `
                  <div class="inline-row">
                     <span class="svgIcon color-fill">${svgReblog}</span>
                     <a href="${notification.account.url}" class="inline-row">
                        <img src="${notification.account.avatar_static}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                        <span>${getAccountName(notification.account)}'s</span>
                     </a>
                     <a href="${notification.status!.url}">post was edited</a>
                  </div>
                  <div class="post-notification-text">${notification.status?.content}</div>
                  `;
               break;
         }
         const content = dom(`<div class="post-content" style="margin-bottom: var(--ledit-margin);">${html}</div>`)[0];
         return { elements: [content], toggles: [] };
      }
   }

   getContent(mastodonPost: MastodonPost): ContentDom {
      let postToView = mastodonPost.reblog ?? mastodonPost;
      const toggles: Element[] = [];

      const points = dom(/*html*/ `
      <div class="post-points">
         <span class="svgIcon color-fill">${svgReblog}</span>
         <span>${addCommasToNumber(postToView.reblogs_count)}</span>
         <span class="svgIcon color-fill">${svgStar}</span>
         <span>${addCommasToNumber(postToView.favourites_count)}</span>
      </div>
      `)[0];
      toggles.push(points);

      let prelude = "";
      if (mastodonPost.reblog) {
         const avatarImageUrl = mastodonPost.account.avatar_static;
         prelude = /*html*/ `
         <a href="${mastodonPost.account.url}" target="_blank" style="color: var(--ledit-color-dim);">
            <div class="post-mastodon-prelude">
                  <span>Boosted by</span>
                  <img src="${avatarImageUrl}" style="border-radius: 4px; max-height: calc(1.5 * var(--ledit-font-size));">
                  <span>${getAccountName(mastodonPost.account)}</span>
            </div>
         </a>
         `;
      }
      const content = dom(`<div class="post-content">${prelude}${postToView.content}</div>`)[0];

      if (postToView.poll) {
         const pollDiv = dom(`<div class="post-mastodon-poll"></div>`)[0];
         for (const option of postToView.poll.options) {
            pollDiv.append(dom(`<div class="post-mastodon-poll-option svgIcon color-fill">${svgCircle}${option.title}</div>`)[0]);
         }
         pollDiv.append(
            dom(`<div class="post-mastodon-poll-summary">${postToView.poll.votes_count} votes, ${postToView.poll.voters_count} voters</div>`)[0]
         );
         content.append(pollDiv);
      }

      if (postToView.media_attachments.length > 0) {
         const images: string[] = [];
         const videos: MastodonMedia[] = [];

         for (const media of postToView.media_attachments) {
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
            content.append(gallery.gallery);
            if (images.length > 1) toggles.push(gallery.toggle);
         }
         if (videos.length >= 1) {
            for (const video of videos) {
               content.append(
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

      if (postToView.card) {
         // FIXME render cards
      }

      return { elements: [content], toggles };
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
