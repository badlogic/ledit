import "./posts.css";
import { svgDownArrow, svgImages, svgLink, svgLoader, svgSpeechBubble as svgSpeechBubble, svgUpArrow } from "./svg/index";
import { addCommasToNumber, dateToText, dom, intersectsViewport, navigationGuard, onVisibleOnce } from "./utils";
import { View } from "./view";
import { ContentView } from "./content";
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
         console.log(`Loaded more posts for '${source.getSourcePrefix() + source.getFeed()}'.`);
         if (after) {
            this.loadedPages++;
            this.postsDiv.append(dom(`<div class="post-loading">Page ${this.loadedPages}</div>`)[0]);
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
         if (postDiv.classList.contains("hidden"))
            hiddenPosts++;
         this.postsDiv.append(postDiv);
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

   prependPost(post: Post) {
      const postDiv = this.renderPost(post);
      this.postsDiv.insertBefore(postDiv, this.postsDiv.children[0]);
      window.scrollTo({top: 0});
   }
}
customElements.define("ledit-posts", PostsView);

export class PostView extends View {
   constructor(private readonly post: Post) {
      super();
      this.render();
   }

   render() {
      const post = this.post;
      if (!post.contentOnly) {
         this.renderFullPost(post);
      } else {
         this.innerHTML = /*html*/ `
            <div class="post">
               <div x-id="content" class="post-content"></div>
               <div x-id="contentToggles"></div>
            </div>
         `;
         const elements = this.elements<{
            content: Element;
            contentToggles: Element;
         }>();

         onVisibleOnce(this, () => {
            console.log("Showing content of " + this.post.title);
            const content = new ContentView(this.post);

            for (const toggle of content.toggles) {
               elements.contentToggles.parentElement?.insertBefore(toggle, elements.contentToggles);
            }
            elements.contentToggles.remove();
            elements.content.append(content);
         });
      }
   }

   renderFullPost(post: Post) {
      const showFeed = getSource().getFeed().toLowerCase() != post.feed.toLowerCase();
      const collapse = getSettings().collapseSeenPosts && PostsView.seenPosts.has(post.url) ? "post-seen" : "";
      this.innerHTML = /*html*/ `
      <div class="post ${collapse}">
         <div class="post-title"><a href="${post.url}" target="_blank">${post.title}</a></div>
         <div class="post-meta">
            ${
               showFeed
                  ? /*html*/ `
                     <a href="${post.url}" target="_blank">
                        <span class="post-feed">${post.feed}</span>
                     </a>
                     <span style="margin: 0 calc(var(--ledit-padding) / 2);">•</span>`
                  : ""
            }
            <span class="post-date"><a href="${post.url}" target="_blank">${dateToText(post.createdAt * 1000)}</a></span>
            ${
               post.author && post.authorUrl
                  ? /*html*/ `
               <span style="margin: 0 calc(var(--ledit-padding) / 2);">•</span>
               <span class="post-author">
                  <a href="${post.authorUrl}" target="_blank">${post.author}</a>
               </span>`
                  : ""
            }
            ${
               post.domain
                  ? /*html*/ `
                  <span style="margin: 0 calc(var(--ledit-padding) / 2);">•</span>
                  <span class="post-url">${post.domain}</span>
               `
                  : ""
            }
         </div>
         <div x-id="content" class="post-content"></div>
         <div x-id="buttonsRow" class="post-buttons">
            ${
               post.numComments != null
                  ? /*html*/ `
                  <div x-id="commentsToggle" class="post-comments-toggle">
                     <span class="svg-icon color-fill">${svgSpeechBubble}</span>
                     <span>${addCommasToNumber(post.numComments)}</span>
                  </div>
               `
                  : ""
            }
            <div x-id="contentToggles"></div>
         </div>
         <div x-id="comments"></div>
      </div>
      `;

      const elements = this.elements<{
         content: Element;
         buttonsRow: Element;
         commentsToggle: Element | null;
         contentToggles: Element;
         link: Element | null;
      }>();

      onVisibleOnce(this, () => {
         console.log("Showing content of " + this.post.title);
         const content = new ContentView(this.post);

         for (const toggle of content.toggles) {
            elements.contentToggles.parentElement?.insertBefore(toggle, elements.contentToggles);
         }
         elements.contentToggles.remove();
         elements.content.append(content);
         if (!post.numComments && content.toggles.length == 0) elements.buttonsRow.classList.add("hidden");
      });

      if (post.numComments && post.numComments > 0) {
         elements.commentsToggle?.addEventListener("click", () => {
            this.toggleComments();
         });

         document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" || event.keyCode === 27) {
               if (elements.buttonsRow.classList.contains("post-buttons-sticky") && intersectsViewport(elements.buttonsRow)) this.toggleComments();
            }
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

   commentsView: CommentsView | null = null;

   toggleComments() {
      const elements = this.elements<{
         comments: Element;
         buttonsRow: Element;
      }>();

      const hideComments = () => {
         // Hide the comments, triggered by a click on the comments button
         this.commentsView?.remove();
         navigationGuard.removeCallback(navListener);

         elements.buttonsRow.classList.remove("post-buttons-sticky");
         if (elements.buttonsRow.getBoundingClientRect().top < 16 * 4) {
            requestAnimationFrame(() => {
               const scrollTo = elements.buttonsRow.getBoundingClientRect().top + window.pageYOffset - 16 * 4;
               window.scrollTo({ top: scrollTo });
            });
         }
      };

      const navListener = () => {
         if (intersectsViewport(elements.buttonsRow)) {
            hideComments();
            return false;
         }
         return true;
      };

      if (elements.comments.children.length == 0) {
         // Show the comments
         if (!this.commentsView) this.commentsView = new CommentsView(this.post, this);
         elements.comments.append(this.commentsView);
         elements.buttonsRow.classList.add("post-buttons-sticky");
         navigationGuard.registerCallback(navListener);
      } else {
         hideComments();
      }
   }
}
customElements.define("ledit-post", PostView);

