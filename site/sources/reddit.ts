import "video.js/dist/video-js.min.css";

import { Comment, ContentDom, Page, PageIdentifier, Post, SortingOption, Source, SourcePrefix, getSource } from "./data";
import { svgDownArrow, svgReply, svgUpArrow } from "../svg";
import { addCommasToNumber, dateToText, dom, htmlDecode, intersectsViewport, makeCollapsible, renderGallery, renderVideo } from "../utils";

interface RedditPosts {
   kind: "listing";
   data: {
      after: string;
      children: RedditPost[];
   };
}

interface RedditPost {
   data: {
      author: string;
      created_utc: number;
      domain: string;
      is_created_from_ads_ui: boolean;
      is_reddit_media_domain: boolean;
      is_video: boolean;
      is_self: boolean;
      is_gallery: boolean;
      id: string;
      num_comments: number;
      over_18: boolean;
      permalink: string;
      selftext_html: string;
      gallery_data: {
         items: { media_id: string; id: number }[];
      };
      media_metadata: {
         [key: string]: {
            status: string;
            p: {
               x: number;
               y: number;
               u: string;
            }[];
         };
      };
      preview: {
         enabled: boolean;
         images: {
            resolutions: {
               url: string;
               width: number;
               height: number;
            }[];
         }[];
         reddit_video_preview: {
            dash_url: string;
            hls_url: string;
            fallback_url: string;
            is_gif: boolean;
            width: number;
            height: number;
         } | null;
         source: {
            url: string;
            width: number;
            height: number;
         };
      };
      secure_media: {
         reddit_video: {
            fallback_url: string;
            width: number;
            height: number;
            dash_url: string;
            hls_url: string;
         };
      };
      secure_media_embed: {
         content: string;
         width: number;
         height: number;
         media_domain_url: string;
      };
      score: number;
      subreddit: string;
      subreddit_id: string;
      thumbnail: string;
      title: string;
      ups: number;
      downs: number;
      url: string;
   };
}

export interface RedditComment {
   data: {
      author: string;
      created_utc: number;
      body_html: string;
      score: number;
      permalink: string;
      replies: RedditComments | "" | undefined;
   };
   kind: "t1";
}

export interface RedditComments {
   data: {
      children: RedditComment[];
   };
   kind: "Listing";
}

export class RedditSource extends Source<RedditPost, RedditComment> {
   async getPosts(nextPage: PageIdentifier): Promise<Page<Post<RedditPost>> | Error> {
      try {
         const sortFrag = this.getSortingFragment();
         const sortParam = this.getSortingParameter();
         const hash = "/r/" + this.getSubreddit() + "/" + sortFrag + "/.json?" + sortParam + "&" + (nextPage ? "after=" + nextPage : "");
         const url = "https://www.reddit.com" + (!hash.startsWith("/") ? "/" : "") + hash;
         const response = await fetch(url);
         const redditPosts = (await response.json()) as RedditPosts;
         if (!redditPosts || !redditPosts.data || !redditPosts.data.children) {
            return new Error(`Could not load posts for subreddit ${this.getSubreddit()}`);
         }

         const convertPost = (redditPost: RedditPost) => {
            const url = redditPost.data.url.startsWith("/r/") ? "https://www.reddit.com" + redditPost.data.url : redditPost.data.url;
            const post: Post<RedditPost> = {
               url,
               feed: redditPost.data.subreddit,
               title: redditPost.data.title,
               author: redditPost.data.author,
               createdAt: redditPost.data.created_utc,
               numComments: redditPost.data.num_comments,
               data: redditPost,
            };
            return post;
         };

         const posts: Post<RedditPost>[] = [];
         for (const redditPost of redditPosts.data.children) {
            if (redditPost.data.author == undefined) continue;
            posts.push(convertPost(redditPost));
         }

         return {
            items: posts,
            nextPage: redditPosts.data.after,
         };
      } catch (e) {
         return new Error(`Could not load subredd ${this.getSubreddit()}.`);
      }
   }
   async getComments(post: Post<RedditPost>): Promise<Comment<RedditComment>[] | Error> {
      try {
         const commentsUrl = "https://www.reddit.com/" + post.data.data.permalink + ".json";
         const response = await fetch(commentsUrl);
         const data = await response.json();
         if (data.length < 2) return [];
         const redditComments = data[1] as RedditComments;
         if (!redditComments || !redditComments.data || !redditComments.data.children) {
            return new Error(`Could not load comments.`);
         }

         const convertComment = (redditComment: RedditComment) => {
            const comment: Comment<RedditComment> = {
               url: "https://www.reddit.com/" + redditComment.data.permalink,
               author: redditComment.data.author,
               authorUrl: `http://www.reddit.com/u/${redditComment.data.author}`,
               createdAt: redditComment.data.created_utc,
               content: redditComment.data.body_html,
               replies: [],
               highlight: false,
               data: redditComment,
            };
            if (redditComment.data.replies != "" && redditComment.data.replies !== undefined) {
               for (const reply of redditComment.data.replies.data.children) {
                  if (reply.data.author == undefined) continue;
                  comment.replies.push(convertComment(reply));
               }
            }
            return comment;
         };

         const comments: Comment<RedditComment>[] = [];
         for (const comment of redditComments.data.children) {
            if (comment.data.author == undefined) continue;
            comments.push(convertComment(comment));
         }
         return comments;
      } catch (e) {
         throw new Error("Network error.");
      }
   }

   getMetaDom(post: Post<RedditPost>): HTMLElement[] {
      const feed = getSource().getFeed().toLowerCase();
      return dom(/*html*/ `
         ${post.feed.toLowerCase() != feed ? /*html*/ `<a href="https://www.reddit.com/${post.feed}">r/${post.feed}</a><span>•</span>` : ""}
         <span>${dateToText(post.createdAt * 1000)}</span>
         <span>•</span>
         <a href="${"https://www.reddit.com/u/" + post.author}">${post.author}</a>
         ${!(post.url.includes("redd.it") || post.url.includes("reddit.com")) ? /*html*/ `<span>•</span><span>${new URL(post.url).host}</span>` : ""}
      `);
   }

   getContentDom(canonicalPost: Post<RedditPost>): ContentDom {
      const post = canonicalPost.data;
      const postsWidth = document.querySelector("ledit-post-list")!.clientWidth; // account for padding in post
      const toggles: Element[] = [];
      const reply = dom(/*html*/ `<a href="${"https://www.reddit.com" + post.data.permalink}" class="fill-color post-button">${svgReply}</a>`)[0];
      toggles.push(reply);
      const points = dom(/*html*/ `
         <div class="post-points">
            <span class="fill-color">${svgUpArrow}</span>
            <span>${addCommasToNumber(post.data.score)}</span>
            <span class="fill-color">${svgDownArrow}</span>
         </div>
      `)[0];
      toggles.push(points);

      // Self post, show text, dim it, cap vertical size, and make it expand on click.
      if (post.data.is_self) {
         let selfPost = dom(`<div class="content-text">${htmlDecode(post.data.selftext_html ?? "")}</div>`)[0];

         requestAnimationFrame(() => {
            makeCollapsible(selfPost, 4.5);
         });
         return { elements: [selfPost], toggles };
      }

      // Gallery
      if (post.data.is_gallery && post.data.media_metadata && post.data.gallery_data) {
         type image = { x: number; y: number; u: string };
         const images: image[] = [];
         for (const imageKey of post.data.gallery_data.items) {
            if (post.data.media_metadata[imageKey.media_id].p) {
               let image: image | null = null;
               for (const img of post.data.media_metadata[imageKey.media_id].p) {
                  image = img;
                  if (img.x > postsWidth) break;
               }
               if (image) images.push(image);
            }
         }
         const imageUrls = images.map((img) => img.u);
         const gallery = renderGallery(imageUrls);
         toggles.unshift(gallery.toggle);
         return { elements: [gallery.gallery], toggles };
      }

      // Reddit hosted video
      if (post.data.secure_media && post.data.secure_media.reddit_video) {
         return { elements: [renderVideo(post.data.secure_media.reddit_video, false)], toggles };
      }

      // External embed like YouTube Vimeo
      if (post.data.secure_media_embed && post.data.secure_media_embed.media_domain_url) {
         const embed = post.data.secure_media_embed;
         const embedWidth = postsWidth;
         const embedHeight = Math.floor((embed.height / embed.width) * embedWidth);
         if (embed.content.includes("iframe")) {
            const embedUrl = htmlDecode(
               embed.content
                  .replace(`width="${embed.width}"`, `width="${embedWidth}"`)
                  .replace(`height="${embed.height}"`, `height="${embedHeight}"`)
                  .replace("position:absolute;", "")
            );
            let embedDom = dom(`<div width="${embedWidth}" height="${embedHeight}">${embedUrl}</div>`)[0];
            // Make YouTube videos stop if they scroll out of frame.
            if (embed.content.includes("youtube")) {
               // Pause when out of view
               document.addEventListener("scroll", () => {
                  const videoElement = embedDom.querySelector("iframe");
                  if (videoElement && !intersectsViewport(videoElement)) {
                     videoElement.contentWindow?.postMessage('{"event":"command","func":"' + "pauseVideo" + '","args":""}', "*");
                  }
               });
               return { elements: [embedDom], toggles };
            }
         } else {
            return {
               elements: dom(
                  `<div width="${embedWidth}" height="${embedHeight}"><iframe width="${embedWidth}" height="${embedHeight}" src="${embed.media_domain_url}"></iframe></div>`
               ),
               toggles,
            };
         }
      }

      // Plain old .gif
      if (post.data.url.endsWith(".gif")) {
         return { elements: dom(`<img src="${post.data.url}"></img>`), toggles };
      }

      // Image, pick the one that's one size above the current posts width so pinch zooming
      // in shows more pixels.
      if (post.data.preview && post.data.preview.images && post.data.preview.images.length > 0) {
         let image: { url: string; width: number; height: number } | null = null;
         for (const img of post.data.preview.images[0].resolutions) {
            image = img;
            if (img.width > postsWidth) break;
         }
         if (!image) return { elements: [document.createElement("div")], toggles };
         if (!post.data.preview.reddit_video_preview?.fallback_url) return { elements: dom(`<img src="${image.url}"></img>`), toggles };
         return { elements: [renderVideo(post.data.preview.reddit_video_preview, post.data.preview.reddit_video_preview.is_gif)], toggles };
      }

      // Fallback to thumbnail which is super low-res.
      const missingThumbnailTags = new Set<String>(["self", "nsfw", "default", "image", "spoiler"]);
      const thumbnailUrl = post.data.thumbnail.includes("://") ? post.data.thumbnail : "";
      if (post.data.thumbnail && !missingThumbnailTags.has(post.data.thumbnail)) {
         return { elements: dom(`<img src="${thumbnailUrl}"></img>`), toggles };
      }
      return { elements: [document.createElement("div")], toggles };
   }

   getCommentMetaDom(comment: Comment<RedditComment>, opName: string): HTMLElement[] {
      return dom(/*html*/ `
         <span class="comment-author ${opName == comment.author ? "comment-author-op" : ""}">
         <a href="${comment.authorUrl}">${comment.author}</a>
         </span>
         <span>•</span>
         <span>${dateToText(comment.createdAt * 1000)}</span>
         <span>•</span>
         <span>${addCommasToNumber(comment.data.data.score!)} pts</span>
         <span>•</span>
         <a href="${comment.url}" class="fill-color post-button">${svgReply}</a>
       `);
   }

   getFeed() {
      return this.getSubreddit();
   }

   getSourcePrefix(): SourcePrefix {
      return "r/";
   }

   getSortingOptions(): SortingOption[] {
      return [
         { value: "hot", label: "Hot" },
         { value: "new", label: "New" },
         { value: "rising", label: "Rising" },
         { value: "top-today", label: "Top today" },
         { value: "top-week", label: "Top week" },
         { value: "top-month", label: "Top month" },
         { value: "top-year", label: "Top year" },
         { value: "top-alltime", label: "Top all time" },
      ];
   }

   getSubreddit() {
      const hash = this.hash;
      if (hash.length == 0) {
         return "all";
      }
      const tokens = hash.substring(1).split("/");
      if (tokens.length < 2) return "all";
      return decodeURIComponent(tokens[1]);
   }

   getSorting() {
      const hash = this.hash;
      if (hash.length == 0) {
         return "hot";
      }
      const tokens = hash.substring(1).split("/");
      if (tokens.length < 3) return "hot";
      if (["hot", "new", "rising", "top-today", "top-week", "top-month", "top-year", "top-alltime"].some((sorting) => sorting == tokens[2])) {
         return tokens[2];
      } else {
         return "hot";
      }
   }

   getSortingFragment() {
      return this.getSorting().split("-")[0];
   }

   getSortingParameter() {
      const tokens = this.getSorting().split("-");
      if (tokens.length != 2) return "";
      return "t=" + tokens[1];
   }
}
