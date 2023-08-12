import "./posts.css";
import { svgDownArrow, svgImages, svgLoader, svgSpeeBubble, svgUpArrow } from "./svg/index";
import { addCommasToNumber, dateToText, dom, intersectsViewport, onVisibleOnce } from "./utils";
import { View } from "./view";
import { MediaView } from "./media";
import { CommentsView } from "./comments";
import { getSettings, saveSettings } from "./settings";
import { Post, Posts, Source, getSource } from "./data";

export class PostsView extends View {
   private readonly postsDiv: Element;
   public static seenPosts = new Set<string>();
   public static hideSeen = false;
   private loadedPages = 1;
   static {
      getSettings().seenIds.forEach((seen) => PostsView.seenPosts.add(seen));
      PostsView.hideSeen = getSettings().hideSeen;
      getSettings().hideSeen = false;
      saveSettings();
   }
   constructor() {
      super();
      this.append((this.postsDiv = dom(`<div x-id="posts" class="posts"></div>`)[0]));
      (async () => await this.loadPosts(null))();
   }

   async loadPosts(after: string | null) {
      const source = getSource();
      const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.postsDiv.append(loadingDiv);
      try {
         let result = await source.getPosts(after);
         console.log(`Loaded more posts for '${source.getSubPrefix() + source.getSub()}'.`);
         if (after) {
            this.loadedPages++;
            this.postsDiv.append(dom(`<div class="post-loading">Page ${this.loadedPages}</div>`)[0]);
         }
         await this.renderPosts(result);
      } catch (e) {
         this.showError("Could not load " + source.getSubPrefix() + source.getSub(), e);
      } finally {
         loadingDiv.remove();
      }
   }

   async renderPosts(posts: Posts) {
      const source = getSource();
      if (posts.posts.length == 0) {
         this.showError(`${source.getSubPrefix() + source.getSub()} does not exist.`);
         return;
      }

      // Render posts
      let hiddenPosts = 0;
      for (let i = 0; i < posts.posts.length; i++) {
         const post = posts.posts[i];
         const postDiv = new PostView(post);
         if (PostsView.seenPosts.has(post.url)) {
            if (PostsView.hideSeen) {
               postDiv.classList.add("hidden");
               hiddenPosts++;
            }
         }
         this.postsDiv.append(postDiv);

         onVisibleOnce(postDiv, () => {
            if (!PostsView.seenPosts.has(post.url)) {
               PostsView.seenPosts.add(post.url);
               getSettings().seenIds.push(post.url);
               saveSettings();
               console.log("Seen " + post.url);
            }
         });
      }

      // Setup infinite scroll
      if (posts.after) {
         const loadMoreDiv = dom(`<div class="post-loading">Load more</div>`)[0];
         this.postsDiv.append(loadMoreDiv);
         const loadMore = async () => {
            loadMoreDiv.remove();
            await this.loadPosts(posts.after);
         };

         if (hiddenPosts == posts.posts.length) {
            // Load more if all posts where hidden.
            requestAnimationFrame(() => {
               loadMore();
            });
         } else {
            // Otherwise the user will have to scroll.
            onVisibleOnce(loadMoreDiv, loadMore);
            loadMoreDiv.addEventListener("click", loadMore);
         }
      }
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
      const source = getSource();
      const post = this.post;
      const showUrl = !post.isSelf && !post.url.includes("redd.it") && !post.url.includes("www.reddit.com");
      const showSub = getSource().getSub().toLowerCase() != post.sub.toLowerCase();
      const collapse = getSettings().collapseSeenPosts && PostsView.seenPosts.has(post.url) ? "post-seen" : "";
      this.innerHTML = /*html*/ `
      <div class="post ${collapse}">
         <div class="post-title"><a href="${post.url}" target="_blank">${post.title}</a></div>
         <div class="post-meta">
            ${
               showSub
                  ? /*html*/ `<a href="${post.url}" target="_blank"><span class="post-sub">${post.sub}</span></a><span style="margin: 0 calc(var(--ledit-padding) / 2);">•</span>`
                  : ""
            }
            <span class="post-date">${dateToText(post.createdAt * 1000)}</span>
            ${post.author.length != 0 ? `<span style="margin: 0 calc(var(--ledit-padding) / 2);">•</span>` : ""}
            <span class="post-author"><a href="${post.authorUrl}" target="_blank">${post.author}</a></span>
            ${
               showUrl
                  ? `<span style="margin: 0 calc(var(--ledit-padding) / 2);>•</span><span class="post-url">${
                       new URL(post.url.startsWith("/r/") ? "https://www.reddit.com" + post.url : post.url).host
                    }</span>`
                  : ""
            }
         </div>
         <div x-id="media" class="post-media"></div>
         <div x-id="buttonsRow" class="post-buttons">
            <div x-id="toggleComments" class="post-comments-toggle">
               <span class="svg-icon color-fill">${svgSpeeBubble}</span>
               <span>${addCommasToNumber(post.numComments)}</span>
            </div>
            ${
               post.isGallery
                  ? /*html*/ `
            <div class="post-gallery-toggle">
               <span class="svg-icon color-fill">${svgImages}</span>
               <span>${post.numGalleryImages}</span>
            </div>`
                  : ""
            }
            <div class="post-points">
               <span class="svgIcon color-fill">${svgUpArrow}</span>
               <span>${addCommasToNumber(post.score)}</span>
               <span class="svg-icon color-fill">${svgDownArrow}</span>
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

      document.addEventListener("keydown", (event) => {
         if (event.key === "Escape" || event.keyCode === 27) {
            popStateCallback(null);
         }
      });
      if (post.numComments == -1) elements.buttonsRow.classList.add("hidden");

      if (collapse) {
         const expand = (event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();
            this.querySelector(".post")?.classList.remove("post-seen");
            this.removeEventListener("click", expand);
         };
         this.addEventListener("click", expand);
      }
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
            });
         }
      }
   }
}
customElements.define("ledit-post", PostView);

let statePushed = false;
let openCommentsViews: CommentsView[] = [];
function popStateCallback(event: PopStateEvent | null) {
   // If a state is pushed, at least one view is
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
         requestAnimationFrame(() => window.scrollTo({ top: scrollTo }));
      }

      if (removedViews == 0) {
         // If no views were removed, non were visible. Do a proper back navigation.
         if (event) {
            window.removeEventListener("popstate", popStateCallback);
            history.back();
         }
      } else {
         // Else, prevent back navigation
         event?.preventDefault();
         event?.stopPropagation();
         statePushed = false;
      }
   }
}
window.addEventListener("popstate", popStateCallback);
