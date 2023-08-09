import "./posts.css";
import { Post, Posts, getPosts, getSubreddit } from "./reddit";
import { svgDownArrow, svgImages, svgLoader, svgSpeeBubble, svgUpArrow } from "./svg/index";
import { addCommasToNumber, dateToText, dom, intersectsViewport, onVisibleOnce, removeFixScroll } from "./utils";
import { View } from "./view";
import { MediaView } from "./media";
import { CommentsView } from "./comments";

export class PostsView extends View {
   private readonly postsDiv: Element;
   constructor() {
      super();
      this.append((this.postsDiv = dom(`<div x-id="posts" class="posts"></div>`)[0]));
      (async () => await this.loadPosts(null))();
   }

   async loadPosts(after: string | null) {
      const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.postsDiv.append(loadingDiv);
      try {
         let result = await getPosts(after);
         console.log(`Loaded more posts for ${getSubreddit()}.`);
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
         return;
      }

      // Render posts
      for (let i = 0; i < posts.data.children.length; i++) {
         const post = posts.data.children[i];
         const postDiv = new PostView(post);
         this.postsDiv.append(postDiv);
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
      if (e) console.error("An error occured: ", e);
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
         <div x-id="buttonsRow" class="post-buttons">
            <div x-id="toggleComments" class="post-comments-toggle">
               <span class="svg-icon">${svgSpeeBubble}</span>
               <span>${addCommasToNumber(post.num_comments)}</span>
            </div>
            ${
               post.is_gallery
                  ? /*html*/ `
            <div class="post-gallery-toggle">
               <span class="svg-icon">${svgImages}</span>
               <span>${numGalleryImages}</span>
            </div>`
                  : ""
            }
            <div class="post-points">
               <span class="svgIcon">${svgUpArrow}</span>
               <span>${addCommasToNumber(post.score)}</span>
               <span class="svg-icon">${svgDownArrow}</span>
            </div>
         </div>
         <div x-id="comments"></div>
      </div>
      `;

      const elements = this.elements<{
         media: Element;
         buttonsRow: Element;
         comments: Element;
      }>();

      elements.media.append(new MediaView(this.post));

      elements.buttonsRow.addEventListener("click", () => {
         this.toggleComments();
      });
   }

   commentsView: CommentsView | null = null;

   toggleComments() {
      const elements = this.elements<{
         comments: Element;
         buttonsRow: Element;
      }>();

      if (elements.comments.children.length == 0) {
         // Show the comments
         if (!this.commentsView) this.commentsView = new CommentsView(this.post, this);
         elements.comments.append(this.commentsView);
         elements.buttonsRow.classList.add("post-buttons-sticky");

         // If we haven't pushed a history state yet, push one
         // This will prevent the user from going back via the
         // back button or back swiping.
         //
         // Also push the view onto the list of currently open
         // views.
         if (!statePushed) {
            history.pushState({}, "", "");
            statePushed = true;
         }
         openCommentsViews.push(this.commentsView);
      } else {
         // Hide the comments, triggered by a click on the comments button
         this.commentsView?.remove();

         // Manually remove the view from the list of open views.
         openCommentsViews = openCommentsViews.filter((view) => view != this.commentsView);

         elements.buttonsRow.classList.remove("post-buttons-sticky");
         if (elements.buttonsRow.getBoundingClientRect().top < 16 * 4) {
            requestAnimationFrame(() => {
               window.scrollTo({ top: elements.buttonsRow.getBoundingClientRect().top + window.pageYOffset - 16 * 4 });
            })
         }
      }
   }
}
customElements.define("ledit-post", PostView);

let statePushed = false;
let openCommentsViews: CommentsView[] = [];
function popStateCallback(event: PopStateEvent) {
   console.log("In popstate callback");
   // Otherwise, if a state is pushed, at least one view is
   // open. Remove any visible views.
   if (statePushed) {
      let scrollTo = -1;
      let removedViews = 0;

      for (let i = 0; i < openCommentsViews.length; i++) {
         const commentsView = openCommentsViews[i];
         const postView = commentsView.postView as PostView;
         const buttonsRow = postView.elements<{ buttonsRow: Element }>().buttonsRow;

         // Is the toggle button for the view visible? Then remove the
         // view and optionally scroll to its toggle button, if its
         // at the top of the page.
         if (intersectsViewport(buttonsRow)) {
            commentsView.remove();
            removedViews++;
            openCommentsViews.splice(i, 1);
            buttonsRow.classList.remove("post-buttons-sticky");
            if (buttonsRow.getBoundingClientRect().top < 16 * 4) {
               scrollTo = buttonsRow.getBoundingClientRect().top + window.pageYOffset - 16 * 4;
            }
         }
      }

      if (scrollTo != -1) {
         requestAnimationFrame(() => window.scrollTo({ top:  scrollTo }));
      }

      if (removedViews == 0) {
         // If no views were removed, non were visible. Do a proper back navigation.
         window.removeEventListener("popstate", popStateCallback);
         history.back();
      } else {
         // Else, prevent back navigation
         event.preventDefault();
         event.stopPropagation();
         statePushed = false;
      }
   }
}
window.addEventListener("popstate", popStateCallback);
