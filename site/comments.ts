import "./comments.css";
import { Post, Comment, getSource } from "./data";
import { svgLoader, svgReply } from "./svg";
import { dateToText, dom, htmlDecode, onAddedToDOM, scrollToAndCenter } from "./utils";
import { View } from "./view";

const commentsCache = new Map<string, Comment<any>[]>();

export class CommentsView extends View {
   private comments: Comment<any>[] | null = null;

   constructor(post: Post<any>, public readonly opName: string, public readonly postView: Element) {
      super();
      this.render();
      this.classList.add("comments");
      (async () => this.loadComments(post))();
   }

   async loadComments(post: Post<any>) {
      const source = getSource();
      const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.append(loadingDiv);
      try {
         const commentsData = commentsCache.has(post.url) ? commentsCache.get(post.url)! : await source.getComments(post);
         if (!commentsData) return;
         commentsCache.set(post.url, commentsData);
         this.comments = commentsData;
         this.render();
      } catch (e) {
         this.showError("Could not load comments", e);
      } finally {
         loadingDiv.remove();
      }
   }

   render() {
      if (!this.comments) return;
      for (const comment of this.comments) {
         this.append(new CommentView(comment, this.opName));
      }
   }

   showError(message: string, e: any | null = null) {
      this.append(dom(`<div class="post-loading">${message}</div>`)[0]);
      if (e) console.error("An error occured: ", e);
   }
}
customElements.define("ledit-comments", CommentsView);

export class CommentView extends View {
   constructor(private readonly comment: Comment<any>, private readonly opName: string) {
      super();
      this.render();
      this.classList.add("comment");
   }

   prependReply(reply: Comment<any>) {
      const replyDiv = new CommentView(reply, this.opName);
      const elements = this.elements<{
         replies: HTMLElement;
      }>();
      if (elements.replies.children.length > 0) {
         elements.replies.insertBefore(replyDiv, elements.replies.children[0]);
      } else {
         elements.replies.append(replyDiv);
      }
   }

   render() {
      const comment = this.comment;

      this.innerHTML = /*html*/ `
         <div x-id="meta" class="comment-meta"></div>
         <div x-id="content" class="comment-content"></div>
         <div x-id="replies" class="comment-replies"></div>
         <div x-id="repliesCount" class="comment-replies-count hidden"></div>
      `;

      // Add meta, content, replies and reply count. Setup expand/collapse.
      const elements = this.elements<{
         meta: HTMLElement;
         content: HTMLElement;
         replies: HTMLElement;
         repliesCount: HTMLElement;
         reply: HTMLElement;
      }>();

      // Scroll to it if highlighted
      if (comment.highlight) {
         this.classList.add("comment-highlighted");
         onAddedToDOM(this, () => {
            scrollToAndCenter(elements.content);
         });
      }

      // Add meta
      for (const el of getSource().getCommentMetaDom(comment, this.opName)) {
         elements.meta.append(el);
      }

      // Create reply children recursively.
      elements.repliesCount.innerText = `${comment.replies.length == 1 ? "1 reply" : comment.replies.length + " replies"}`;
      for (const reply of comment.replies) {
         const replyDom = new CommentView(reply, this.opName);
         elements.replies.append(replyDom);
      }

      // Add content and toggle buttons
      const toggles: Element[] = [];
      if (typeof comment.content === "string") {
         elements.content.innerHTML = htmlDecode(comment.content)!;
      } else {
         const content = comment.content;
         for (const el of content.elements) {
            elements.content.append(el);
         }
         if (content.toggles.length > 0) {
            const togglesDiv = dom(/*html*/`<div style="display: flex; gap: 1em; margin-left: auto; margin-top: var(--ledit-padding); font-size: calc(var(--ledit-font-size) * 0.85)"></div>`)[0];
            for (const toggle of content.toggles) {
               togglesDiv.append(toggle);
            }
            this.insertBefore(togglesDiv, elements.replies);
         }
         toggles.push(...content.toggles);
      }

      // Ensure all links open a new tab.
      let links = elements.content.querySelectorAll("a")!;
      for (let i = 0; i < links.length; i++) {
         let link = links[i];
         link.setAttribute("target", "_blank");
      }

      // Collapse children on click
      const isLink = (element: HTMLElement) => {
         let el: HTMLElement | null = element;
         while (el) {
            if (el.tagName == "A") return true;
            if (el.classList.contains("content-image-gallery")) return true;
            if (toggles.indexOf(el) != -1) return true;
            el = el.parentElement;
         }
         return false;
      };
      const toggleCollapsed = (event: MouseEvent) => {
         if (!isLink(event.target as HTMLElement)) {
            event.stopPropagation();
            event.preventDefault();
            if (comment.replies.length == 0) return;
            if (elements.replies.classList.contains("hidden")) {
               elements.replies.classList.remove("hidden");
               elements.repliesCount.classList.add("hidden");
            } else {
               elements.replies.classList.add("hidden");
               elements.repliesCount.classList.remove("hidden");
            }
         }
      };
      elements.content.addEventListener("click", toggleCollapsed);
      elements.repliesCount.addEventListener("click", toggleCollapsed);
   }
}
customElements.define("ledit-comment", CommentView);
