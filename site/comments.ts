import "./comments.css";
import { Comment, Comments, Post, getComments } from "./reddit";
import { svgLoader } from "./svg";
import { dateToText, dom, htmlDecode } from "./utils";
import { View } from "./view";

const commentsCache = new Map<string, Comments>();

export class CommentsView extends View {
   private comments: Comment[] | null = null;
   private opName: string;

   constructor(post: Post, public readonly postView: Element) {
      super();
      this.render();
      this.classList.add("comments");
      this.opName = post.data.author;
      (async () => this.loadComments(post))();
   }

   async loadComments(post: Post) {
      const loadingDiv = dom(`<div class="post-loading">${svgLoader}</div>`)[0];
      this.append(loadingDiv);
      try {
         const commentsData = commentsCache.has(post.data.permalink) ? commentsCache.get(post.data.permalink)! : await getComments(post);
         if (!commentsData) return;
         commentsCache.set(post.data.permalink, commentsData);
         this.comments = commentsData.data.children;
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
         if (comment.data.author == undefined) continue;
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
      if (comment.data.author == undefined) return;

      this.innerHTML = /*html*/ `
         <div class="comment-meta">
               <span class="comment-author ${this.opName == comment.data.author ? "comment-author-op" : ""}"><a href="https://www.reddit.com/u/${comment.data.author}" target="_blank">${
         comment.data.author
      }</a></span>
               <span>• </span>
               <span class="comment-data">${dateToText(comment.data.created_utc * 1000)}</span>
               <span>• </span>
               <span class="comment-points">${comment.data.score} pts</span>
               <span>• </span>
               <a class="comment-reply" href="https://www.reddit.com/${comment.data.permalink}" target="_blank">Reply</a>
         </div>
         <div x-id="text" class="comment-text">
               ${htmlDecode(comment.data.body_html)}
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
         replies: HTMLElement,
         repliesCount: HTMLElement
      }>();

      if (comment.data.replies && (comment.data.replies as any) != "" && comment.data.replies.data.children) {
         const numReplies = comment.data.replies.data.children.length;
         elements.repliesCount.innerText = `${numReplies == 1 ? "1 reply" : numReplies + " replies"}`;
         for (const reply of comment.data.replies.data.children) {
            if (comment.data.author == undefined) continue;
            const replyDom = new CommentView(reply, this.opName);
            elements.replies.append(replyDom);
         }

         elements.text.addEventListener("click", (event) => {
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
          });
      }
   }
}
customElements.define("ledit-comment", CommentView);