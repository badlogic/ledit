// @ts-ignore
import { TemplateResult, html } from "lit-html";
// @ts-ignore
import { map } from "lit-html/directives/map.js";
import { dom } from "./utils";
import { setLinkTargetsToBlank } from "../utils";

export function renderComments<T, S>(comments: T[], renderComment: (comment: T, state: S) => TemplateResult, state: S): HTMLElement[] {
   const outerDom = dom(html`
      ${map(comments, (comment) => renderComment(comment, state))}
   `);
   const commentDoms: HTMLElement[] = [];
   for (const el of Array.from(outerDom)) {
      setLinkTargetsToBlank(el);
      commentDoms.push(el);
      commentDoms.push(...Array.from(el.querySelectorAll(".comment")) as HTMLElement[]);
   }
   return outerDom;
}