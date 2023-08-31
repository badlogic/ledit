import { encodeHTML } from "entities";
import { LitElement } from "lit";
import { TemplateResult, html, nothing } from "lit-html";
import { map } from "lit-html/directives/map.js";
import { customElement, property } from "lit/decorators.js";
import { renderComments } from "./comments";
import { Page, PageIdentifier, SortingOption, Source } from "./data";
import { commentIcon, replyIcon } from "./icons";
import { Overlay } from "./overlay";
import { dom, makeCollapsible, renderContentLoader, renderErrorMessage, renderInfoMessage, renderPosts, safeHTML } from "./partials";
import { addCommasToNumber, dateToText, elements, htmlDecode, onAddedToDOM, setLinkTargetsToBlank } from "./utils";

interface HnRawPost {
   by: string;
   descendants: number;
   id: number;
   kids: number[];
   score: number;
   time: number;
   title: string;
   type: string;
   url: string;
   text: string;
}

interface HnRawComment {
   created_at_i: number;
   parent_id: number;
   objectID: string;
   comment_text: string;
   author: string;
   replies: HnRawComment[] | undefined;
}

interface HnPost {
   id: number;
   url: string;
   title: string;
   author: string;
   authorUrl: string;
   createdAt: number;
   numComments: number;
   points: number;
   content: string | null;
   raw: HnRawPost;
}

interface HnComment {
   url: string;
   author: string;
   authorUrl: string;
   createdAt: number;
   content: string;
   replies: HnComment[];
   raw: HnRawComment;
}

async function getHnItem(id: string): Promise<any> {
   const response = await fetch("https://hacker-news.firebaseio.com/v0/item/" + id + ".json");
   return await response.json();
}

function rawToHnPost(rawPost: HnRawPost) {
   return {
      id: rawPost.id,
      url: rawPost.url ?? "https://news.ycombinator.com/item?id=" + rawPost.id,
      title: rawPost.title,
      author: rawPost.by,
      authorUrl: `https://news.ycombinator.com/user?id=${rawPost.by}`,
      createdAt: rawPost.time,
      numComments: rawPost.descendants ?? 0,
      points: rawPost.score,
      content: rawPost.text ? htmlDecode(encodeHTML("<p>" + rawPost.text)) : "",
      raw: rawPost,
   } as HnPost;
}

function rawToHnComment(rawComment: HnRawComment) {
   return {
      url: `https://news.ycombinator.com/item?id=${rawComment.objectID}`,
      author: rawComment.author,
      authorUrl: `https://news.ycombinator.com/user?id=${rawComment.author}`,
      createdAt: rawComment.created_at_i,
      content: htmlDecode(encodeHTML("<p>" + rawComment.comment_text)) ?? "",
      replies: [] as HnComment[],
      raw: rawComment,
   } as HnComment;
}

export class HackerNewsSource extends Source<HnPost> {
   constructor(feed: string) {
      super(feed);

      window.addEventListener("hashchange", async () => {
         const hash = window.location.hash;
         // FIXME show error if the hash can't be parsed
         if (!hash.startsWith("#hn/")) return;
         const tokens = hash.split("/");
         if (tokens.length < 3) return;
         if (tokens[1] != "comments") return;
         const id = tokens[2];
         await renderHnComments(this, id);
      });
   }

   private getSortingUrl() {
      const sorting = this.getSorting();
      if (sorting == "news") return "topstories.json";
      if (sorting == "newest") return "newstories.json";
      if (sorting == "ask") return "askstories.json";
      if (sorting == "show") return "showstories.json";
      if (sorting == "jobs") return "jobstories.json";
      return "topstories.json";
   }

   async getPosts(after: string | null): Promise<Page<HnPost> | Error> {
      try {
         const response = await fetch("https://hacker-news.firebaseio.com/v0/" + this.getSortingUrl());
         const storyIds = (await response.json()) as number[];
         let startIndex = after ? Number.parseInt(after) : 0;
         const requests: Promise<HnRawPost>[] = [];
         for (let i = startIndex; i < Math.min(storyIds.length, startIndex + 25); i++) {
            requests.push(getHnItem(storyIds[i].toString()));
         }

         const hnPosts = await Promise.all(requests);
         const posts: HnPost[] = [];
         for (const hnPost of hnPosts) {
            posts.push(rawToHnPost(hnPost));
         }

         return {
            items: posts,
            nextPage: posts.length == 0 ? "end" : (startIndex + 25).toString(),
         };
      } catch (e) {
         console.error(e);
         return new Error("Couldn't load Hackernews posts.");
      }
   }

   async getComments(post: HnPost): Promise<HnComment[] | Error> {
      try {
         // Use algolia to get all comments in one go
         const rawPost = post.raw;
         let response = await fetch("https://hn.algolia.com/api/v1/search?tags=comment,story_" + rawPost.id + "&hitsPerPage=" + rawPost.descendants);
         const data = await response.json();
         const hits: HnRawComment[] = [...data.hits];
         const lookup = new Map<string, HnRawComment>();

         // Build up the comment tree
         for (const hit of hits) {
            lookup.set(hit.objectID, hit);
         }
         for (const hit of hits) {
            const parent = lookup.get(hit.parent_id.toString());
            if (!parent) continue;
            if (!parent.replies) parent.replies = [];
            parent.replies.push(hit);
         }

         // Use the "official" API to get the sorting for each fucking node and reorder the
         // replies.
         //
         // We used the official API to get the post. It's kids are in order. We build up
         // the root of the true again based on that order.
         const roots: HnRawComment[] = [];
         if (rawPost.kids) {
            for (const rootId of rawPost.kids) {
               const root = lookup.get(rootId.toString());
               if (root) roots.push(root);
            }
         }

         // Next, we traverse the comment tree. Any comment with more than 1 reply
         // gets its replies re-ordered based on the official API response.
         const sortReplies = async (hnComment: HnRawComment) => {
            if (!hnComment.replies) return;
            if (hnComment.replies.length > 1) {
               const info = (await getHnItem(hnComment.objectID)) as { kids: number[] | undefined };
               hnComment.replies = [];
               if (info.kids) {
                  for (const kid of info.kids) {
                     const kidComment = lookup.get(kid.toString());
                     if (kidComment) hnComment.replies.push(kidComment);
                  }
               }
            }
            for (const reply of hnComment.replies) {
               await sortReplies(reply);
            }
         };

         const promises = [];
         for (const root of roots) {
            promises.push(sortReplies(root));
         }
         await Promise.all(promises);

         const convertComment = (hnComment: HnRawComment) => {
            const comment: HnComment = rawToHnComment(hnComment);
            if (hnComment.replies) {
               for (const reply of hnComment.replies) {
                  comment.replies.push(convertComment(reply));
               }
            }

            return comment;
         };
         const comments = roots.map((root) => convertComment(root));
         return comments;
      } catch (e) {
         console.error("Could not load comments.", e);
         return new Error("Could not load comments");
      }
   }

   async renderMain(main: HTMLElement) {
      const loader = renderContentLoader();
      main.append(loader);
      const page = await this.getPosts(null);
      loader.remove();
      renderPosts(main, page, renderHnPost, (nextPage: PageIdentifier) => {
         return this.getPosts(nextPage);
      });
   }

   getSortingOptions(): SortingOption[] {
      return [
         { value: "news", label: "News" },
         { value: "newest", label: "Newest" },
         { value: "ask", label: "Ask" },
         { value: "show", label: "Show" },
         { value: "jobs", label: "Jobs" },
      ];
   }

   getSorting(): string {
      if (this.feed.length == 0) {
         return "news";
      }
      const tokens = this.feed.substring(1).split("/");
      if (tokens.length < 2) return "news";
      if (["news", "newest", "ask", "show", "jobs"].some((sorting) => sorting == tokens[1])) {
         return tokens[1];
      } else {
         return "news";
      }
   }
}

export function renderHnPost(post: HnPost, showActionButtons = true) {
   const domain = new URL(post.url).host;
   const date = dateToText(post.createdAt * 1000);

   const postDom = dom(html`
      <article class="post gap-1">
         <a href="${post.url}" class="font-bold text-lg text-color">${post.title}</a>
         <div class="flex gap-1 text-xs items-center">
            <span class="flex items-center text-color/50">${post.points} pts</span>
            <span class="flex items-center text-color/50">•</span>
            <a href="https://${domain}" class="text-color/50">${domain}</a>
            <span class="flex items-center text-color/50">•</span>
            <a href="${post.authorUrl}" class="text-color/50">${post.author}</a>
            <span class="flex items-center text-color/50">•</span>
            <span class="flex items-center text-color/50">${date}</span>
         </div>
         ${post.content ? html`<section x-id="contentDom" class="content">${safeHTML(post.content)}</section>` : ""}
         ${showActionButtons
            ? html`
                 <div class="flex items-flex-start gap-4">
                    <a href="#hn/comments/${post.id}" class="self-link flex items-center gap-1 h-[2em]">
                       <i class="icon">${commentIcon}</i>
                       <span class="text-primary">${addCommasToNumber(post.numComments)}</span>
                    </span>
                    <a href="https://news.ycombinator.com/item?id=${post.id}" class="flex items-center gap-1 h-[2em]">
                       <i class="icon">${replyIcon}</i> Reply
                    </a>
                 </div>
              `
            : ""}
      </article>
   `);
   setLinkTargetsToBlank(postDom[0]);
   const { contentDom } = elements<{ contentDom: HTMLElement }>(postDom[0]);
   if (post.content) {
      onAddedToDOM(postDom[0], () => {
         makeCollapsible(contentDom, 10);
      });
   }

   return postDom;
}

@customElement("ledit-hn-comments")
export class HnCommentsView extends LitElement {
   static styles = Overlay.styles;

   @property()
   post?: HnPost;

   @property()
   comments?: HnComment[];

   @property()
   error?: Error;

   render() {
      return html`<ledit-overlay headerTitle="${location.hash.substring(1)}" .sticky=${true} .closeCallback=${() => this.remove()}>
         <div slot="content" class="w-full overflow-auto">
            <div class="comments">
               ${this.post ? renderHnPost(this.post, false) : this.error ? nothing : renderContentLoader()}
               ${this.post
                  ? renderInfoMessage(
                       html` <div class="flex flex-row items-center gap-4 px-4">
                          <div class="flex items-center gap-1"><i class="icon fill-color">${commentIcon}</i><span>${addCommasToNumber(this.post.numComments)}</span></div>
                          <div class="flex items-flex-start gap-4">
                             <a href="https://news.ycombinator.com/item?id=${this.post.id}" target="_blank" class="flex items-center h-[2em] text-color">
                                <i class="icon fill-color">${replyIcon}</i> Reply
                             </a>
                          </div>
                       </div>`
                    )
                  : nothing}
               ${this.comments && this.post
                  ? renderComments(this.comments, renderHnComment, {
                       op: this.post.author,
                       isReply: false,
                    })
                  : this.post
                  ? renderContentLoader()
                  : nothing}
               ${this.error ? renderErrorMessage("Could not load comments", this.error) : nothing}
            </div>
         </div>
      </ledit-overlay>`;
   }
}

export async function renderHnComments(source: HackerNewsSource, postId: string) {
   const commentsView = new HnCommentsView();
   document.body.append(commentsView);
   const post = rawToHnPost((await getHnItem(postId)) as HnRawPost);
   if (post instanceof Error) {
      commentsView.error = post;
      return;
   } else {
      commentsView.post = post;
   }
   const comments = await source.getComments(post);
   if (comments instanceof Error) {
      commentsView.error = comments;
   } else {
      commentsView.comments = comments;
   }
}

export function renderHnComment(comment: HnComment, state: { op: string; isReply: boolean }): TemplateResult {
   const date = dateToText(comment.createdAt * 1000);
   return html`
      <div class="comment ${state.isReply ? "reply" : ""}">
         <div class="flex gap-1 text-sm items-center text-color/50">
            <a href="${comment.authorUrl}" class="${state?.op == comment.author ? "" : "text-color"} font-bold">${comment.author}</a>
            <span class="flex items-center">•</span>
            <span class="flex items-center">${date}</span>
            <span class="flex items-center">•</span>
            <div class="comment-buttons">
               <a href="https://news.ycombinator.com/item?id=${comment.raw.objectID}" class="flex items-center gap-1 text-sm text-color/50"
                  ><i class="icon fill-color/50">${replyIcon}</i> Reply</a
               >
            </div>
         </div>
         <div class="content">${safeHTML(comment.content)}</div>
         ${comment.replies.length > 0 ? html` <div class="replies">${map(comment.replies, (reply) => renderHnComment(reply, { op: state?.op, isReply: true }))}</div> ` : ""}
         </div>
      </div>
   `;
}
