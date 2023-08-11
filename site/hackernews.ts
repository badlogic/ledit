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
      const hnPost = (post as any).hnPost as HNPost;
      let response = await fetch("https://hn.algolia.com/api/v1/search?tags=comment,story_" + hnPost.id + "&hitsPerPage=" + hnPost.descendants)
      const data = await response.json();
      const hits: HNComment[] = [...data.hits];
      const lookup = new Map<string, HNComment>();
      for (const hit of hits) {
         lookup.set(hit.objectID, hit);
      }
      for (const hit of hits) {
         const parent = lookup.get(hit.parent_id.toString());
         if (!parent) continue;
         if (!parent.replies) parent.replies = [];
         parent.replies.push(hit);
      }

      const convertComment = (hnComment: HNComment) => {
         const comment = {
            url: `https://news.ycombinator.com/item?id=${hnComment.objectID}`,
            author: hnComment.author,
            authorUrl: `https://news.ycombinator.com/user?id=${hnComment.author}`,
            createdAt: hnComment.created_at_i,
            score: 0,
            html: hnComment.comment_text,
            replies: [] as Comment[],
         } as Comment;
         if (hnComment.replies) {
            for (const reply of hnComment.replies) {
               comment.replies.push(convertComment(reply));
            }
         }

         return comment as Comment;
      };
      const comments = hits.filter((hit) => hit.parent_id == hnPost.id).map((hit) => convertComment(hit));
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