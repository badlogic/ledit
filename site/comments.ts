import { TemplateResult, html } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { dom } from "./partials";
import { setLinkTargetsToBlank } from "./utils";

export function renderComments<T, S>(comments: T[], renderComment: (comment: T, state: S) => TemplateResult, state: S): HTMLElement[] {
   const outerDom = dom(html` ${map(comments, (comment) => renderComment(comment, state))} `);
   const commentDoms: HTMLElement[] = [];
   for (const el of Array.from(outerDom)) {
      setLinkTargetsToBlank(el);
      commentDoms.push(el);
      commentDoms.push(...(Array.from(el.querySelectorAll(".comment")) as HTMLElement[]));
   }

   for (const commentDom of commentDoms) {
      const replies = commentDom.querySelector(".replies");
      if (!replies) continue;
      if (replies.children.length == 0) continue;
      const commentButtons = commentDom.querySelector(".comment-buttons");
      if (!commentButtons) continue;

      const toggle = dom(html`<div class="hidden text-sm text-color/50">${replies.children.length} ${replies.children.length == 1 ? "reply" : "replies"}</div>`)[0];
      commentButtons.append(toggle);
      commentDom.addEventListener("click", (event) => {
         const target = event.target as HTMLElement;
         if (!target) return;
         if (target.tagName == "A") return;
         let parent = target.parentElement;
         while (parent) {
            if (parent.classList.contains("comment-buttons")) return;
            if (parent.classList.contains("comment")) break;
            parent = parent.parentElement;
         }
         if (parent == commentDom) {
            event.preventDefault();
            event.stopPropagation();
            replies.classList.toggle("hidden");
            toggle.classList.toggle("hidden");
         }
      });
   }

   return outerDom;
}
