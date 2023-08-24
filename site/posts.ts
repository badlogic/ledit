// @ts-ignore
import "./posts.css";
import { CommentView, CommentsView } from "./comments";
import { ContentView } from "./content";
import { Comment, Post, Source, getSource } from "./data";
import { EscapeCallback, NavigationCallback, escapeGuard, navigationGuard } from "./guards";
import { getSettings, saveSettings } from "./settings";
import { svgSpeechBubble } from "./svg/index";
import { addCommasToNumber, dom, intersectsViewport, onVisibleOnce, setLinkTargetsToBlank } from "./utils";
import { OverlayView, PagedListView, View } from "./view";

export class PostListView extends PagedListView<Post<any>> {
   public static seenPosts = new Set<string>();
   public static hideSeen = false;
   private loadedPages = 1;

   static {
      getSettings().seenIds.forEach((seen) => PostListView.seenPosts.add(seen));
      PostListView.hideSeen = getSettings().hideSeen;
      getSettings().hideSeen = false;
      saveSettings();
   }

   constructor(source: Source<any, any>, public readonly showPages = true) {
      super((nextPage) => {
         return source.getPosts(nextPage);
      });
      this.classList.add("posts");
   }

   renderPost(post: Post<any>) {
      const postDiv = new PostView(post);
      if (PostListView.seenPosts.has(post.url)) {
         if (PostListView.hideSeen) {
            postDiv.classList.add("hidden");
         }
      }

      onVisibleOnce(postDiv, () => {
         if (!PostListView.seenPosts.has(post.url)) {
            PostListView.seenPosts.add(post.url);
            getSettings().seenIds.push(post.url);
            saveSettings();
         }
      });

      return postDiv;
   }

   async renderItems(posts: Post<any>[]) {
      if (this.loadedPages > 1 && this.showPages) {
         this.append(...dom(`<div class="post-loader">Page ${this.loadedPages}</div>`));
      }
      let hiddenPosts = 0;
      for (let i = 0; i < posts.length; i++) {
         const post = posts[i];
         const postView = this.renderPost(post);
         if (postView.classList.contains("hidden")) hiddenPosts++;
         this.append(postView);
      }
      this.loadedPages++;
   }

   prependPost(post: Post<any>) {
      const postVIew = this.renderPost(post);
      this.insertBefore(postVIew, this.children[0]);
      window.scrollTo({ top: 0 });
   }
}
customElements.define("ledit-post-list", PostListView);

export class PostView extends View {
   escapeCallback: EscapeCallback | undefined;
   navigationCallback: { hash: string | null; callback: NavigationCallback } | undefined;

   constructor(private readonly post: Post<any>) {
      super();
      this.classList.add("post");
      this.render();
   }

   render() {
      const post = this.post;
      if (!post.contentOnly) {
         this.renderFullPost(post);
         setLinkTargetsToBlank(this);
      } else {
         onVisibleOnce(this, () => {
            const content = new ContentView(this.post);
            this.append(content);
            for (const toggle of content.toggles) {
               this.append(toggle);
            }
            setLinkTargetsToBlank(this);
         });
      }
   }

   renderFullPost(post: Post<any>) {
      this.append(
         ...dom(/*html*/ `
         ${post.title && post.title.length > 0 ? `<div class="post-title"><a href="${post.url}">${post.title}</a></div>` : ""}
         <div x-id="meta" class="post-meta"></div>
         <div x-id="buttonsRow" class="post-buttons">
            ${
               post.numComments != null
                  ? /*html*/ `
                  <div x-id="commentsToggle" class="post-button">
                     <span class="fill-color">${svgSpeechBubble}</span>
                     <span>${addCommasToNumber(post.numComments)}</span>
                  </div>
               `
                  : ""
            }
         </div>
      `)
      );

      const elements = this.elements<{
         meta: Element;
         buttonsRow: Element;
         commentsToggle: Element | null;
         link: Element | null;
      }>();

      elements.meta.append(...getSource().getMetaDom(post));

      onVisibleOnce(this, () => {
         const content = new ContentView(this.post);

         for (const toggle of content.toggles) {
            elements.buttonsRow.append(toggle);
         }

         if (content.children.length > 0) {
            this.insertBefore(content, elements.buttonsRow);
         }

         if (!post.numComments && content.toggles.length == 0) elements.buttonsRow.classList.add("hidden");

         setLinkTargetsToBlank(this);
      });

      if (post.numComments && post.numComments > 0) {
         elements.commentsToggle?.addEventListener("click", () => {
            this.toggleComments();
         });
      }

      if (getSettings().collapseSeenPosts && PostListView.seenPosts.has(post.url)) {
         const expand = (event: MouseEvent) => {
            event.stopPropagation();
            event.preventDefault();
            this.classList.remove("post-seen");
            this.removeEventListener("click", expand);
         };
         this.addEventListener("click", expand);
         this.classList.add("post-seen");
      }
   }

   prependComment(comment: Comment<any>) {
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
         navigationGuard.remove(this.navigationCallback!);
         escapeGuard.remove(this.escapeCallback);

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

         // Close on back navigation
         this.navigationCallback = navigationGuard.register({
            hash: null,
            callback: () => {
               hideComments();
               return false;
            },
         });

         // Close when escape is pressed
         this.escapeCallback = escapeGuard.register(() => {
            if (this.showingComments) this.toggleComments();
         });
      } else {
         hideComments();
      }
   }
}
customElements.define("ledit-post", PostView);
