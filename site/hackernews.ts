import { encodeHTML } from "entities";
import { Comment, Post, Posts, SortingOption, Source } from "./data";

interface HNPost {
   by: string,
   descendants: number,
   id: number,
   kids: number[],
   score: number,
   time: number,
   title: string,
   type: string,
   url: string
}

interface HNComment {
   created_at_i: number,
   parent_id: number,
   objectID: string,
   comment_text: string,
   author: string,
   replies: HNComment[] | undefined
}

async function getHNItem(id: string): Promise<any> {
   const response = await fetch("https://hacker-news.firebaseio.com/v0/item/" + id + ".json");
   return await response.json();
}

export class HackerNewsSource implements Source {
   async getPosts(after: string | null): Promise<Posts> {
      const response = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
      const storyIds = await response.json() as number[];
      let startIndex = after ? Number.parseInt(after) : 0;
      const requests: Promise<HNPost>[] = [];
      for (let i = startIndex; i < Math.min(storyIds.length, startIndex + 25); i++) {
         requests.push(getHNItem(storyIds[i].toString()));
      }

      const hnPosts = await Promise.all(requests);
      const posts: Post[] = [];
      for (const hnPost of hnPosts) {
         posts.push({
            url: hnPost.url ?? "https://news.ycombinator.com/item?id=" + hnPost.id,
            title: hnPost.title,
            isSelf: false,
            isGallery: false,
            numGalleryImages: 0,
            author: hnPost.by,
            authorUrl: "https://news.ycombinator.com/user?id=" + hnPost.by,
            createdAt: hnPost.time,
            sub: "",
            score: hnPost.score,
            numComments: hnPost.descendants ?? 0,
            hnPost
         } as any)
      }

      return {
         posts,
         after: (startIndex + 25).toString()
      }
   }

   async getComments(post: Post): Promise<Comment[]> {
      // Use algolia to get all comments in one go
      const hnPost = (post as any).hnPost as HNPost;
      let response = await fetch("https://hn.algolia.com/api/v1/search?tags=comment,story_" + hnPost.id + "&hitsPerPage=" + hnPost.descendants)
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
            const info = (await getHNItem(hnComment.objectID)) as { kids: number[] | undefined};
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
      }

      const promises = []
      for (const root of roots) {
         promises.push(sortReplies(root));
      }
      await Promise.all(promises);

      const convertComment = (hnComment: HNComment) => {
         const comment = {
            url: `https://news.ycombinator.com/item?id=${hnComment.objectID}`,
            author: hnComment.author,
            authorUrl: `https://news.ycombinator.com/user?id=${hnComment.author}`,
            createdAt: hnComment.created_at_i,
            score: 0,
            html: encodeHTML(hnComment.comment_text),
            replies: [] as Comment[],
         } as Comment;
         if (hnComment.replies) {
            for (const reply of hnComment.replies) {
               comment.replies.push(convertComment(reply));
            }
         }

         return comment as Comment;
      };
      const comments = roots.map((root) => convertComment(root));
      return comments;
   }

   getMediaDom(post: Post): Element[] {
      return [];
   }
   getSub(): string {
      return "";
   }
   getSubPrefix(): string {
      return "hackernews/";
   }
   getSortingOptions(): SortingOption[] {
      return [];
   }
   getSorting(): string {
      return "";
   }
   isSingleSource(): boolean {
      return true;
   }

}