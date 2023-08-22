import { encodeHTML } from "entities";
import { Comment, ContentDom, Page, Post, SortingOption, Source, SourcePrefix } from "./data";
import { svgReply } from "./svg";
import { dateToText, dom, htmlDecode, makeCollapsible } from "./utils";

interface HNPost {
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

interface HNComment {
   created_at_i: number;
   parent_id: number;
   objectID: string;
   comment_text: string;
   author: string;
   replies: HNComment[] | undefined;
}

async function getHNItem(id: string): Promise<any> {
   const response = await fetch("https://hacker-news.firebaseio.com/v0/item/" + id + ".json");
   return await response.json();
}

export class HackerNewsSource implements Source<HNPost, HNComment> {
   private getSortingUrl() {
      const sorting = this.getSorting();
      if (sorting == "news") return "topstories.json";
      if (sorting == "newest") return "newstories.json";
      if (sorting == "ask") return "askstories.json";
      if (sorting == "show") return "showstories.json";
      if (sorting == "jobs") return "jobstories.json";
      return "topstories.json";
   }

   async getPosts(after: string | null): Promise<Page<Post<HNPost>> | Error> {
      try {
         const response = await fetch("https://hacker-news.firebaseio.com/v0/" + this.getSortingUrl());
         const storyIds = (await response.json()) as number[];
         let startIndex = after ? Number.parseInt(after) : 0;
         const requests: Promise<HNPost>[] = [];
         for (let i = startIndex; i < Math.min(storyIds.length, startIndex + 25); i++) {
            requests.push(getHNItem(storyIds[i].toString()));
         }

         const hnPosts = await Promise.all(requests);
         const posts: Post<HNPost>[] = [];
         for (const hnPost of hnPosts) {
            posts.push({
               url: hnPost.url ?? "https://news.ycombinator.com/item?id=" + hnPost.id,
               title: hnPost.title,
               author: hnPost.by,
               createdAt: hnPost.time,
               feed: "",
               numComments: hnPost.descendants ?? 0,
               contentOnly: false,
               data: hnPost,
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

   async getComments(post: Post<HNPost>): Promise<Comment<HNComment>[] | Error> {
      try {
         // Use algolia to get all comments in one go
         const hnPost = post.data;
         let response = await fetch("https://hn.algolia.com/api/v1/search?tags=comment,story_" + hnPost.id + "&hitsPerPage=" + hnPost.descendants);
         const data = await response.json();
         const hits: HNComment[] = [...data.hits];
         const lookup = new Map<string, HNComment>();

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
         const roots: HNComment[] = [];
         if (hnPost.kids) {
            for (const rootId of hnPost.kids) {
               const root = lookup.get(rootId.toString());
               if (root) roots.push(root);
            }
         }

         // Next, we traverse the comment tree. Any comment with more than 1 reply
         // gets its replies re-ordered based on the official API response.
         const sortReplies = async (hnComment: HNComment) => {
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

         const convertComment = (hnComment: HNComment) => {
            const comment: Comment<HNComment> = {
               url: `https://news.ycombinator.com/item?id=${hnComment.objectID}`,
               author: hnComment.author,
               authorUrl: `https://news.ycombinator.com/user?id=${hnComment.author}`,
               createdAt: hnComment.created_at_i,
               score: 0,
               content: encodeHTML("<p>" + hnComment.comment_text),
               replies: [] as Comment<HNComment>[],
               highlight: false,
               data: hnComment,
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

   getMetaDom(post: Post<HNPost>): HTMLElement[] {
      return dom(/*html*/ `
         <span>${post.data.score} pts</span>
         <span>•</span>
         <span>${dateToText(post.createdAt * 1000)}</span>
         <span>•</span>
         <a href="${"https://news.ycombinator.com/user?id=" + post.data.by}">${post.author}</a>
         <span>•</span>
         <span>${new URL(post.url).host}</span>
      `);
   }

   getContentDom(post: Post<HNPost>): ContentDom {
      const toggles: Element[] = [];
      toggles.push(dom(/*html*/ `<a href="https://news.ycombinator.com/item?id=${post.data.id}" class="fill-color margin-right-auto">${svgReply}</a>`)[0]);
      if (post.data.text) {
         let text = post.data.text;
         text = encodeHTML(text);
         let selfPost = dom(`<div class="content-text">${htmlDecode(text)}</div>`)[0];

         requestAnimationFrame(() => {
            makeCollapsible(selfPost, 4.5);
         });
         return { elements: [selfPost], toggles };
      }
      return { elements: [], toggles };
   }

   getCommentMetaDom(comment: Comment<HNComment>, opName: string | null): HTMLElement[] {
      return dom(/*html*/ `
         <span class="comment-author ${opName == comment.author ? "comment-author-op" : ""}">
         <a href="${comment.authorUrl}">${comment.author}</a>
         </span>
         <span>•</span>
         <span>${dateToText(comment.createdAt * 1000)}</span>
         <a href="${comment.url}" class="post-button fill-color">${svgReply}</a>
       `);
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
      const hash = window.location.hash;
      if (hash.length == 0) {
         return "news";
      }
      const tokens = hash.substring(1).split("/");
      if (tokens.length < 2) return "news";
      if (["news", "newest", "ask", "show", "jobs"].some((sorting) => sorting == tokens[1])) {
         return tokens[1];
      } else {
         return "news";
      }
   }
}
