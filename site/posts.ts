import { CommentView, CommentsView } from "./comments";
import { ContentView } from "./content";
import { Comment, Post, Posts, getSource } from "./data";
import { EscapeCallback, NavigationCallback, escapeGuard, navigationGuard } from "./guards";
import "./posts.css";
import { getSettings, saveSettings } from "./settings";
import { svgLoader, svgSpeechBubble } from "./svg/index";
import { addCommasToNumber, dom, intersectsViewport, onVisibleOnce } from "./utils";
import { View } from "./view";

export class PostsView extends View {
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
      this.classList.add("posts");
      (async () => await this.loadPosts(null))();
   }

   async loadPosts(after: string | null) {
      const source = getSource();
      const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.append(loadingDiv);
      try {
         let result = await source.getPosts(after);
         console.log(`Loaded more posts for '${source.getSourcePrefix() + source.getFeed()}'.`);
         if (after) {
            this.loadedPages++;
            this.append(dom(`<div class="post-loading">Page ${this.loadedPages}</div>`)[0]);
         }
         await this.renderPosts(result);
      } catch (e) {
         this.showError("Could not load " + source.getSourcePrefix() + source.getFeed(), e);
      } finally {
         loadingDiv.remove();
      }
   }

   renderPost(post: Post) {
      const postDiv = new PostView(post);
      if (PostsView.seenPosts.has(post.url)) {
         if (PostsView.hideSeen) {
            postDiv.classList.add("hidden");
         }
      }

      onVisibleOnce(postDiv, () => {
         if (!PostsView.seenPosts.has(post.url)) {
            PostsView.seenPosts.add(post.url);
            getSettings().seenIds.push(post.url);
            saveSettings();
            console.log("Seen " + post.url);
         }
      });

      return postDiv;
   }

   async renderPosts(posts: Posts) {
      const source = getSource();
      if (posts.posts.length == 0) {
         this.showError(`${source.getSourcePrefix() + source.getFeed()} does not exist or has no posts.`);
         return;
      }

      // Render posts
      let hiddenPosts = 0;
      for (let i = 0; i < posts.posts.length; i++) {
         const post = posts.posts[i];
         const postDiv = this.renderPost(post);
         if (postDiv.classList.contains("hidden")) hiddenPosts++;
         this.append(postDiv);
      }

      // Setup infinite scroll
      if (posts.after) {
         const loadMoreDiv = dom(`<div class="post-loading">Load more</div>`)[0];
         this.append(loadMoreDiv);
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
      this.append(dom(`<div class="post-loading">${message}</div>`)[0]);
      if (e) console.error("An error occured: ", e);
   }

   prependPost(post: Post) {
      const postDiv = this.renderPost(post);
      this.insertBefore(postDiv, this.children[0]);
      window.scrollTo({ top: 0 });
   }
}
customElements.define("ledit-posts", PostsView);

export class PostView extends View {
   escapeCallback: EscapeCallback | undefined;
   navigationCallback: NavigationCallback | undefined;

   constructor(private readonly post: Post) {
      super();
      this.classList.add("post");
      this.render();
   }

   render() {
      const post = this.post;
      if (!post.contentOnly) {
         this.renderFullPost(post);
      } else {
         onVisibleOnce(this, () => {
            console.log("Showing content of " + this.post.title);
            const content = new ContentView(this.post);
            this.append(content);
            for (const toggle of content.toggles) {
               this.append(toggle);
            }
         });
      }
   }

   renderFullPost(post: Post) {
      const showFeed = getSource().getFeed().toLowerCase() != post.feed.toLowerCase();
      const collapse = getSettings().collapseSeenPosts && PostsView.seenPosts.has(post.url) ? "post-seen" : "";
      this.innerHTML = /*html*/ `
         ${post.title && post.title.length > 0 ? `<div class="post-title"><a href="${post.url}" target="_blank">${post.title}</a></div>` : ""}
         <div x-id="meta" class="post-meta"></div>
         <div x-id="buttonsRow" class="post-buttons">
            ${
               post.numComments != null
                  ? /*html*/ `
                  <div x-id="commentsToggle" class="post-button">
                     <span class="color-fill">${svgSpeechBubble}</span>
                     <span>${addCommasToNumber(post.numComments)}</span>
                  </div>
               `
                  : ""
            }
         </div>
      `;

      const elements = this.elements<{
         meta: Element;
         buttonsRow: Element;
         commentsToggle: Element | null;
         link: Element | null;
      }>();

      elements.meta.append(...getSource().getMetaDom(post));

      onVisibleOnce(this, () => {
         console.log("Showing content of " + this.post.title);
         const content = new ContentView(this.post);

         for (const toggle of content.toggles) {
            elements.buttonsRow.append(toggle);
         }

         if (content.children.length > 0) {
            this.insertBefore(content, elements.buttonsRow);
         }

         if (!post.numComments && content.toggles.length == 0) elements.buttonsRow.classList.add("hidden");
      });

      if (post.numComments && post.numComments > 0) {
         elements.commentsToggle?.addEventListener("click", () => {
            this.toggleComments();
         });

         // Close when escape is pressed
         escapeGuard.register(0, () => {
            if (this.showingComments && intersectsViewport(this.commentsView)) this.toggleComments();
         });
      }

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

   prependComment(comment: Comment) {
      if (!this.commentsView) {
         this.toggleComments();
      } else {
         const commentDiv = new CommentView(comment, "");
         if (this.commentsView.children.length > 0) {
            this.commentsView.insertBefore(commentDiv, this.commentsView.children[0]);
         } else {
            this.commentsView.append(commentDiv);
         }
      }
   }

   showingComments = false;
   commentsView: CommentsView | null = null;

   toggleComments() {
      const elements = this.elements<{
         buttonsRow: Element;
      }>();

      const hideComments = () => {
         this.showingComments = false;
         // Hide the comments, triggered by a click on the comments button
         this.commentsView?.remove();
         navigationGuard.remove(this.navigationCallback);

         if (elements.buttonsRow.getBoundingClientRect().top < 16 * 4) {
            requestAnimationFrame(() => {
               const scrollTo = elements.buttonsRow.getBoundingClientRect().top + window.pageYOffset - 16 * 4;
               window.scrollTo({ top: scrollTo });
            });
         }
      };

      if (!this.showingComments) {
         // Show the comments
         this.showingComments = true;
         if (!this.commentsView) this.commentsView = new CommentsView(this.post, this);
         this.append(this.commentsView);
         this.navigationCallback = navigationGuard.register(0, () => {
            if (intersectsViewport(this.commentsView)) {
               hideComments();
               return false;
            }
            return true;
         });
      } else {
         hideComments();
      }
   }
}
customElements.define("ledit-post", PostView);
