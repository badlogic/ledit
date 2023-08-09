import "./posts.css";
import { Post, Posts, getPosts, getSubreddit } from "./reddit";
import { svgDownArrow, svgImages, svgLoader, svgSpeeBubble, svgUpArrow } from "./svg/index";
import { addCommasToNumber, dateToText, dom, onVisibleOnce } from "./utils";
import { View } from "./view";
import { MediaView } from "./media";

export class PostsView extends View {
   private readonly postsDiv: Element;
   constructor() {
      super();
      this.append((this.postsDiv = dom(`<div x-id="posts" class="posts"></div>`)[0]));
      (async () => this.loadPosts(null))();
   }

   async loadPosts(after: string | null) {
      const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.postsDiv.append(loadingDiv);
      try {
         let result = await getPosts(after);
         this.renderPosts(result);
      } catch (e) {
         this.showError("Could not load r/" + getSubreddit(), e);
      } finally {
         loadingDiv.remove();
      }
   }

   renderPosts(posts: Posts) {
      if ((!posts || !posts.data || !posts.data.children) && this.postsDiv.children.length == 1) {
         this.showError(`Subreddit ${getSubreddit()} does not exist.`);
      }

      // Render posts
      for (let i = 0; i < posts.data.children.length; i++) {
         const post = posts.data.children[i];
         const postDiv = new PostView(post);
         this.postsDiv.append(new PostView(post));
      }

      // Setup infinite scroll
      const loadMoreDiv = dom(`<div class="post-loading">Load more</div>`)[0];
      this.postsDiv.append(loadMoreDiv);
      const loadMore = async () => {
         loadMoreDiv.remove();
         await this.loadPosts(posts.data.after);
      };
      onVisibleOnce(loadMoreDiv, loadMore);
      loadMoreDiv.addEventListener("click", loadMore);
   }

   showError(message: string, e: any | null = null) {
      this.postsDiv.append(dom(`<div class="post-loading">${message}</div>`)[0]);
      console.error("An error occured: ", e);
   }
}
customElements.define("ledit-posts", PostsView);

export class PostView extends View {
   constructor(private readonly post: Post) {
      super();
      this.render();
   }

   render() {
      const post = this.post.data;
      const showUrl = !post.is_self && !post.url.includes("redd.it") && !post.url.includes("www.reddit.com");
      const showSubreddit = getSubreddit().toLowerCase() != post.subreddit.toLowerCase();
      let numGalleryImages = 0;
      if (post.is_gallery) {
         for (const imageKey of Object.keys(post.media_metadata)) {
            if (post.media_metadata[imageKey].p) {
               numGalleryImages++;
            }
         }
      }
      this.innerHTML = /*html*/ `
      <div class="post">
         <div class="post-title"><a href="${post.url}" target="_blank">${post.title}</a></div>
         <div class="post-meta">
            ${
               showSubreddit
                  ? /*html*/ `<span class="post-subreddit"><a href="https://www.reddit.com/r/${post.subreddit}" target="_blank">r/${post.subreddit}</a></span><span> •</span>`
                  : ""
            }
            <span class="post-date">${dateToText(post.created_utc * 1000)}</span>
            <span>•</span>
            <span class="post-author"><a href="https://www.reddit.com/u/${post.author}" target="_blank">${post.author}</a></span>
            ${
               showUrl
                  ? `<span>• </span><span class="post-url">${
                       new URL(post.url.startsWith("/r/") ? "https://www.reddit.com" + post.url : post.url).host
                    }</span>`
                  : ""
            }
         </div>
         <div x-id="media"></div>
         <div class="post-buttons">
            <div x-id="toggleComments" class="post-comments-toggle">${svgSpeeBubble} ${addCommasToNumber(post.num_comments)}</div>
            ${post.is_gallery ? `<div class="post-gallery-toggle">${svgImages} ${numGalleryImages}</div>` : ""}
            <div class="post-points">${svgUpArrow} ${addCommasToNumber(post.score)}${svgDownArrow}</div>
         </div>
         <div x-id="comments" class="post-comments"></div>
      </div>
      `;

      const elements = this.elements<{
         media: Element;
         toggleComments: Element;
         comments: Element;
      }>();

      elements.media.append(new MediaView(this.post));
   }
}
customElements.define("ledit-post", PostView);
