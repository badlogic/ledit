import { encodeHTML } from "entities";
import { Page, SortingOption, Source, SourcePrefix } from "./data";
import { addCommasToNumber, dateToText, elements, htmlDecode, onAddedToDOM, setLinkTargetsToBlank } from "../utils";
// @ts-ignore
import { TemplateResult, html } from "lit-html";
import { dom, makeCollapsible, renderContentLoader, renderErrorMessage, renderHeaderButton, renderInfoMessage, renderOverlay, safeHTML } from "./utils";
// @ts-ignore
import commentIcon from "remixicon/icons/Communication/chat-4-line.svg";
// @ts-ignore
import replyIcon from "remixicon/icons/Business/reply-line.svg";
// @ts-ignore
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { renderComments } from "./comments";
// @ts-ignore
import { map } from "lit-html/directives/map.js";

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

   getFeed(): string {
      return "";
   }

   getSourcePrefix(): SourcePrefix {
      return "hn/";
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
                       <i class="icon">${unsafeHTML(commentIcon)}</i>
                       <span class="text-primary">${addCommasToNumber(post.numComments)}</span>
                    </span>
                    <a href="https://news.ycombinator.com/item?id=${post.id}" class="flex items-center gap-1 h-[2em]">
                       <i class="icon">${unsafeHTML(replyIcon)}</i> Reply
                    </a>
                 </div>
              `
            : ""}
      </article>
   `);
   setLinkTargetsToBlank(postDom[0]);
   const { contentDom, comments } = elements<{ contentDom: HTMLElement; comments: HTMLElement }>(postDom[0]);
   if (post.content) {
      onAddedToDOM(postDom[0], () => {
         makeCollapsible(contentDom, 10);
      });
   }

   return postDom;
}

export async function renderHnComments(source: HackerNewsSource, postId: string) {
   const content = dom(html`<div class="comments"></div>`)[0];
   const loader = renderContentLoader();
   content.append(loader);
   renderOverlay(location.hash.substring(1), [content]);

   const post = rawToHnPost((await getHnItem(postId)) as HnRawPost);
   if (post instanceof Error) {
      content.append(...renderErrorMessage("Could not load comments"));
   } else {
      loader.remove();
      content.append(...renderHnPost(post, false));
      content.append(
         ...renderInfoMessage(html`<div class="flex flex-row items-center gap-4">
            <span>${addCommasToNumber(post.numComments)} comments</span>
            <div class="flex items-flex-start gap-4">
               <a href="https://news.ycombinator.com/item?id=${post.id}" target="_blank" class="flex items-center h-[2em] text"
                  ><i class="icon mr-1">${unsafeHTML(replyIcon)}</i> Reply</a
               >
            </div>
         </div> `)
      );
      content.append(loader);
      const comments = await source.getComments(post);
      loader.remove();

      if (comments instanceof Error) {
         content.append(...renderErrorMessage("Could not load comments"));
         return;
      }
      const scrollWrapper = dom(html`<div class="pt-1 w-full overflow-auto"></div>`)[0];
      content.append(scrollWrapper);
      scrollWrapper.append(...renderComments(comments, renderHnComment, { op: post.author, isReply: false }));
   }
}

export function renderHnComment(comment: HnComment, state: { op: string; isReply: boolean }): TemplateResult {
   const date = dateToText(comment.createdAt * 1000);
   return html`
      <div class="comment ${state.isReply ? "reply" : ""}">
         <div class="flex gap-1 text-sm items-center text-color/50">
            <a href="${comment.authorUrl}" class="${state?.op == comment.author ? "" : "text-color"} font-bold">${comment.author}</a>
            <span class="flex items-center text-color/50">•</span>
            <span class="flex items-center text-color/50">${date}</span>
         </div>
         <div class="content">${safeHTML(comment.content)}</div>
         <div class="comment-buttons">
            <a href="https://news.ycombinator.com/item?id=${comment.raw.objectID}" class="flex items-center h-[2em] text"
               ><i class="icon mr-1">${unsafeHTML(replyIcon)}</i> Reply</a
            >
         </div>
         ${comment.replies.length > 0
            ? html` <div class="replies">${map(comment.replies, (reply) => renderHnComment(reply, { op: state?.op, isReply: true }))}</div> `
            : ""}
         </div>
      </div>
   `;
}
