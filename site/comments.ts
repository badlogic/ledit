import "./comments.css";
import { Post, Comment, getSource } from "./data";
import { svgLoader } from "./svg";
import { dateToText, dom, htmlDecode } from "./utils";
import { View } from "./view";

const commentsCache = new Map<string, Comment[]>();

export class CommentsView extends View {
   private comments: Comment[] | null = null;
   private opName: string;

   constructor(post: Post, public readonly postView: Element) {
      super();
      this.render();
      this.classList.add("comments");
      this.opName = post.author;
      (async () => this.loadComments(post))();
   }

   async loadComments(post: Post) {
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
   constructor(private readonly comment: Comment, private readonly opName: string) {
      super();
      this.render();
      this.classList.add("comment");
   }

   render() {
      const comment = this.comment;

      this.innerHTML = /*html*/ `
         <div class="comment-meta">
               <span class="comment-author ${this.opName == comment.author ? "comment-author-op" : ""}">
                  <a href="${comment.authorUrl}" target="_blank">${comment.author}</a>
               </span>
               <span>• </span>
               <span class="comment-data">${dateToText(comment.createdAt * 1000)}</span>
               <span>• </span>
               <span class="comment-points">${comment.score} pts</span>
               <span>• </span>
               <a class="comment-reply" href="${comment.url}" target="_blank">Reply</a>
         </div>
         <div x-id="text" class="comment-text">
         </div>
         <div x-id="replies" class="comment-replies"></div>
         <div x-id="repliesCount" class="comment-replies-count hidden"></div>
      `;

      // Ensure links in comment text open a new tab
      let links = this.querySelector(".comment-text")!.querySelectorAll("a")!;
      for (let i = 0; i < links.length; i++) {
         let link = links[i];
         link.setAttribute("target", "_blank");
      }

      // Add replies and reply count. Setup expand/collapse.
      const elements = this.elements<{
         text: HTMLElement;
         replies: HTMLElement;
         repliesCount: HTMLElement;
      }>();

      elements.repliesCount.innerText = `${comment.replies.length == 1 ? "1 reply" : comment.replies.length + " replies"}`;
      for (const reply of comment.replies) {
         const replyDom = new CommentView(reply, this.opName);
         elements.replies.append(replyDom);
      }

      if (typeof comment.html === "string") {
         elements.text.innerHTML = htmlDecode(comment.html)!;
      } else {
         for (const el of comment.html as Element[]) {
            elements.text.append(el);
         }
      }

      const toggleCollapsed = (event: MouseEvent) => {
         if ((event.target as HTMLElement).tagName != "A") {
            event.stopPropagation();
            event.preventDefault();
            if (elements.replies.classList.contains("hidden")) {
               elements.replies.classList.remove("hidden");
               elements.repliesCount.classList.add("hidden");
            } else {
               elements.replies.classList.add("hidden");
               elements.repliesCount.classList.remove("hidden");
            }
         }
      };
      elements.text.addEventListener("click", toggleCollapsed);
      elements.repliesCount.addEventListener("click", toggleCollapsed);
   }
}
customElements.define("ledit-comment", CommentView);
