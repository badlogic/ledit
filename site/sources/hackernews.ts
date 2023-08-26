import { encodeHTML } from "entities";
import { Comment, Page, SortingOption, Source, SourcePrefix } from "./data";
import { dateToText, elements, onAddedToDOM, replaceLastHashFragment, setLinkTargetsToBlank } from "../utils";
// @ts-ignore
import { html } from "lit-html";
import { contentLoader, dom, makeCollapsible, renderOverlay, safeHTML } from "./utils";
// @ts-ignore
import commentIcon from "remixicon/icons/Communication/chat-4-line.svg";
// @ts-ignore
import replyIcon from "remixicon/icons/Business/reply-line.svg";
// @ts-ignore
import closeIcon from "remixicon/icons/System/close-circle-line.svg";
// @ts-ignore
import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { escapeGuard, navigationGuard } from "./guards";

interface HNRawPost {
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

interface HNRawComment {
   created_at_i: number;
   parent_id: number;
   objectID: string;
   comment_text: string;
   author: string;
   replies: HNRawComment[] | undefined;
}

interface HNPost {
   id: number;
   url: string;
   title: string;
   author: string;
   authorUrl: string;
   createdAt: number;
   numComments: number;
   points: number;
   content: string | null;
   raw: HNRawPost;
}

interface HNComment extends Comment {
   url: string;
   author: string;
   authorUrl: string;
   createdAt: number;
   content: string;
   raw: HNRawComment;
}

async function getHNItem(id: string): Promise<any> {
   const response = await fetch("https://hacker-news.firebaseio.com/v0/item/" + id + ".json");
   return await response.json();
}

export class HackerNewsSource extends Source<HNPost, HNComment> {
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

   async getPosts(after: string | null): Promise<Page<HNPost> | Error> {
      try {
         const response = await fetch("https://hacker-news.firebaseio.com/v0/" + this.getSortingUrl());
         const storyIds = (await response.json()) as number[];
         let startIndex = after ? Number.parseInt(after) : 0;
         const requests: Promise<HNRawPost>[] = [];
         for (let i = startIndex; i < Math.min(storyIds.length, startIndex + 25); i++) {
            requests.push(getHNItem(storyIds[i].toString()));
         }

         const hnPosts = await Promise.all(requests);
         const posts: HNPost[] = [];
         for (const hnPost of hnPosts) {
            posts.push({
               id: hnPost.id,
               url: hnPost.url ?? "https://news.ycombinator.com/item?id=" + hnPost.id,
               title: hnPost.title,
               author: hnPost.by,
               authorUrl: `https://news.ycombinator.com/user?id=${hnPost.by}`,
               createdAt: hnPost.time,
               numComments: hnPost.descendants ?? 0,
               points: hnPost.score,
               content: hnPost.text,
               raw: hnPost,
            });
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

   async getPostComments(postOrId: string | HNRawPost): Promise<HNComment[] | Error> {
      try {
         // Use algolia to get all comments in one go
         const hnPost = typeof postOrId === "string" ? ((await getHNItem(postOrId)) as HNRawPost) : postOrId;
         let response = await fetch("https://hn.algolia.com/api/v1/search?tags=comment,story_" + hnPost.id + "&hitsPerPage=" + hnPost.descendants);
         const data = await response.json();
         const hits: HNRawComment[] = [...data.hits];
         const lookup = new Map<string, HNRawComment>();

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
         const roots: HNRawComment[] = [];
         if (hnPost.kids) {
            for (const rootId of hnPost.kids) {
               const root = lookup.get(rootId.toString());
               if (root) roots.push(root);
            }
         }

         // Next, we traverse the comment tree. Any comment with more than 1 reply
         // gets its replies re-ordered based on the official API response.
         const sortReplies = async (hnComment: HNRawComment) => {
            if (!hnComment.replies) return;
            if (hnComment.replies.length > 1) {
               const info = (await getHNItem(hnComment.objectID)) as { kids: number[] | undefined };
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

         const convertComment = (hnComment: HNRawComment) => {
            const comment: HNComment = {
               url: `https://news.ycombinator.com/item?id=${hnComment.objectID}`,
               author: hnComment.author,
               authorUrl: `https://news.ycombinator.com/user?id=${hnComment.author}`,
               createdAt: hnComment.created_at_i,
               content: encodeHTML("<p>" + hnComment.comment_text),
               replies: [] as HNComment[],
               raw: hnComment,
            };
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

   async getComments(post: HNPost): Promise<HNComment[] | Error> {
      return this.getPostComments(post.raw);
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

export function renderHnPost(post: HNPost) {
   const domain = new URL(post.url).host;
   const date = dateToText(post.createdAt * 1000);

   const postDom = dom(html`
      <article class="post gap-1">
         <a href="${post.url}" class="font-bold text-lg text-color">${post.title}</a>
         <section class="flex gap-1 text-sm items-center">
            <span class="flex items-center text-color/50">${post.points} pts</span>
            <span class="flex items-center text-color/50">•</span>
            <a href="https://${domain}" class="text-primary/90">${domain}</a>
            <span class="flex items-center text-color/50">•</span>
            <a href="${post.authorUrl}" class="text-primary/90">${post.author}</a>
            <span class="flex items-center text-color/50">•</span>
            <span class="flex items-center text-color/50">${date}</span>
            <span class="flex items-center text-color/50">•</span>
         </section>
         ${post.content ? html`<section x-id="contentDom" class="rss-content">${safeHTML(post.content)}</section>` : ""}
         <section class="flex items-flex-start gap-4">
            <span class="flex items-center cursor-pointer gap-2 h-[2em]" x-id="comments">
               <i class="w-5 h-5 icon">${unsafeHTML(commentIcon)}</i>
               <span>${post.numComments}</span>
            </span>
            <a href="https://news.ycombinator.com/item?id=${post.id}" class="flex items-center h-[2em]"
               ><i class="w-5 h-5 mr-1 icon">${unsafeHTML(replyIcon)}</i></a
            >
         </section>
      </article>
   `);
   setLinkTargetsToBlank(postDom[0]);
   const { contentDom, comments } = elements<{ contentDom: HTMLElement; comments: HTMLElement }>(postDom[0]);
   if (post.content) {
      onAddedToDOM(postDom[0], () => {
         makeCollapsible(contentDom, 10);
      });
   }

   comments.addEventListener("click", () => {
      window.location.hash = `#hn/comments/${post.id}`;
   });

   return postDom;
}

export async function renderHnComments(source: HackerNewsSource, postId: string) {
   const header = dom(html`
      <div class="header cursor-pointer">
         <span class="font-bold text-primary text-ellipsis overflow-hidden">${location.hash.substring(1)}</span>
         <i class="font-bold fixed right-0 w-6 h-6 mr-2">${unsafeHTML(closeIcon)}</i>
      </div>`);
   const content = dom(html`<div class="hn-comments bg-background min-h-full"></div>`)[0];
   const loader = dom(contentLoader)[0];
   content.append(loader);
   renderOverlay(header, [content]);
   const comments = await source.getPostComments(postId);
   loader.remove();
}
