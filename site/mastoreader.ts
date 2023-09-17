import { LitElement, PropertyValueMap, html } from "lit";
import { map } from "lit-html/directives/map.js";
import { customElement, query, state } from "lit/decorators.js";
import { commentIcon, mastodonIcon, reblogIcon, starIcon } from "./icons";
import { getAccountName, getComments, renderMastodonMedia, renderMastodonPost, replaceEmojis } from "./mastodon";
import { MastodonPost } from "./mastodon-api";
import { dom, renderContentLoader, renderErrorMessage } from "./partials";
import { globalStyles } from "./styles";
import { addCommasToNumber, dateToText, setLinkTargetsToBlank } from "./utils";

document.documentElement.setAttribute("data-theme", "dark");

@customElement("masto-reader")
export class MastoReader extends LitElement {
   static styles = globalStyles;

   @state()
   url: string | null;

   @state()
   loading = false;

   @state()
   error: Error | null;

   @state()
   thread: MastodonPost[] | undefined;

   @state()
   copied = false;

   @query("#url")
   urlField?: HTMLInputElement;

   @query("#error-text")
   errorText?: HTMLElement;

   constructor() {
      super();
      const queryParams = new URLSearchParams(window.location.search);
      this.url = queryParams.get("url");
      this.error = null;
      if (this.url) {
         this.loading = true;
         this.load();
      }
   }

   protected createRenderRoot(): Element | ShadowRoot {
      return this;
   }

   async load() {
      try {
         const instance = new URL(this.url!).host;
         const postId = this.url!.split("/").pop()!;
         const result = await getComments(postId, instance);
         if (result instanceof Error) {
            this.error = result;
            return;
         }
         const thread: MastodonPost[] = [];
         thread.push(result.root.post);
         let curr = result.root;
         while (true) {
            if (curr.replies.length == 0) break;

            let found = false;
            for (const reply of curr.replies) {
               if (reply.post.account.id == result.root.post.account.id) {
                  thread.push(reply.post);
                  curr = reply;
                  found = true;
               }
            }
            if (!found) break;
         }
         this.thread = thread;
         this.loading = false;
      } catch (e) {
         if (e instanceof Error) this.error = e;
         else this.error = new Error("Couldn't fetch thread");
      }
   }

   protected updated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
      setLinkTargetsToBlank(this);
   }

   copyToClipboard(text: string): void {
      navigator.clipboard.writeText(text).then(() => {
         this.copied = true;
      });
   }

   render() {
      const baseUrl = location.href.replace(location.search, "");
      const header = html`<h1 class="m-auto mt-4 flex items-center gap-2"><i class="icon">${mastodonIcon}</i><a href="${baseUrl}" class="text-color">Masto Reader</a></h1>`;

      if (this.loading) {
         return html` <div class="flex flex-col gap-4 px-4">
            ${header}
            <div class="text-center">Loading <a href="${this.url}">${this.url}</a></div>
            ${renderContentLoader()}
         </div>`;
      }

      if (this.error) {
         return html`
            <div class="flex flex-col gap-4 px-4">
               ${header}
               <a href="${this.url}">${this.url}</a>
               ${renderErrorMessage(`Sorry, couldn't render the thread at ${this.url}`, this.error)}
            </div>
         `;
      }

      if (this.thread) {
         const postToView = this.thread[0];
         return html`<div class="flex flex-col gap-4 pb-4">
            ${header}
            <button @click=${() => this.copyToClipboard(location.href)} class="m-auto">Share</button>
            <div class="${this.copied ? "" : "hidden"} m-auto text-sm text-color/50">Copied sharable URL to clipboard</div>
            <div class="flex items-center gap-2 px-4">
               <a href="${postToView.account.url}" class="flex items-center gap-2">
                  <img class="w-[2.5em] h-[2.5em] rounded-full cursor-pointer" src="${postToView.account.avatar_static}" />
                  <div class="flex inline-block flex-col text-sm text-color overflow-hidden cursor-pointer">
                     <span class="font-bold overflow-hidden text-ellipsis">${getAccountName(postToView.account)}</span>
                     <span class="text-color/60 overflow-hidden text-ellipsis">${postToView.account.username + "@" + new URL(postToView.account.url).host}</span>
                  </div>
               </a>
               <a href="${postToView.url}" class="ml-auto text-xs self-start">${dateToText(new Date(postToView.created_at).getTime())}</a>
            </div>
            <div class="flex justify-between gap-4 mx-auto !mb-[-0.5em]">
               <a href="${this.url}" class="self-link flex items-center gap-1 h-[2em] cursor-pointer">
                  <i class="icon fill-color/60">${commentIcon}</i>
                  <span class="text-color/60">${addCommasToNumber(postToView.replies_count)}</span>
               </a>
               <a href="${this.url}" class="flex items-center gap-1 h-[2em]">
                  <i class="icon ${postToView.reblogged ? "fill-primary" : "fill-color/60"}">${reblogIcon}</i>
                  <span class="${postToView.reblogged ? "text-primary" : "text-color/60"}">${addCommasToNumber(postToView.reblogs_count)}</span>
               </a>
               <a href="${this.url}" class="flex items-center gap-1 h-[2em]">
                  <i class="icon ${postToView.favourited ? "fill-primary" : "fill-color/60"}">${starIcon}</i>
                  <span class="${postToView.favourited ? "text-primary" : "text-color/60"}">${addCommasToNumber(postToView.favourites_count)}</span>
               </a>
            </div>
            <div class="flex flex-col">
               ${map(this.thread, (post, index) => {
                  const contentDom = dom(html` <a href="${post.url}" class="content text-color hover:border hover:border-border/50 hover:rounded px-4 py-2">
                     <div class="content-text">${replaceEmojis(post.content, post.emojis)}</div>
                  </a>`)[0];
                  renderMastodonMedia(post, contentDom, true);
                  setLinkTargetsToBlank(contentDom);
                  return contentDom;
               })}
               <div></div>
            </div>
         </div>`;
      }

      return html`
         <div class="flex flex-col gap-4 px-4">
            ${header}
            <div class="flex gap-2 mt-4">
               <input id="url" class="flex-1" placeholder="URL of Mastodon status" />
               <button @click=${() => this.unrollClicked()} id="unroll">Unroll</button>
            </div>
            <div id="error-text" class="text-sm" style="color: red;"></div>
         </div>
      `;
   }

   unrollClicked() {
      const url = this.urlField!.value.trim();
      if (url.length == 0) {
         this.errorText!.innerText = "Please enter a URL";
         this.requestUpdate();
         return;
      }
      location.search = "url=" + encodeURIComponent(url);
   }
}
