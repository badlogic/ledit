import { Comment, Post, Posts, SortingOption, Source, SourcePrefix } from "./data";
import { RssSource } from "./rss";
import { dom, proxyFetch } from "./utils";

export class YoutubeSource implements Source {

   async getYoutubeChannel(url: string): Promise<Post[]> {
      const response = await proxyFetch(url);
      const text = await response.text();
      const channelIdIdx = text.indexOf("vnd.youtube://www.youtube.com/channel/");
      if (channelIdIdx == -1) return [];
      const channelIdEnd = text.indexOf('"', channelIdIdx);
      if (channelIdEnd == -1) return [];
      const channelId = text.substring(channelIdIdx + "vnd.youtube://www.youtube.com/channel/".length, channelIdEnd);
      return RssSource.getRssPosts("https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId);
   }

   async getPosts(after: string | null): Promise<Posts> {
      const channels = this.getFeed().split("+");
      const promises: Promise<Post[]>[] = [];
      for (const channel of channels) {
         promises.push(this.getYoutubeChannel("https://www.youtube.com/@" + channel));
      }

      const promisesResult = await Promise.all(promises);
      const posts: Post[] = [];
      for (let i = 0; i < channels.length; i++) {
         const result = promisesResult[i];
         const channel = channels[i];
         for (const post of result) {
            post.author = channel;
            post.authorUrl = "https://youtube.com/@" + channel;
         }
         posts.push(...result);
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return { posts, after: null };
   }

   async getComments(post: Post): Promise<Comment[]> {
      return [];
   }

   getMediaDom(post: Post): Element[] {
      const url = post.url.split("=");
      if (url.length != 2) return [];
      return dom(`<iframe src="https://www.youtube.com/embed/${url[1]}?feature=oembed&amp;enablejsapi=1" style="width: 100%; aspect-ratio: 16/9;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="" title="Russ Abbot in Married for Life"></iframe>`);
   }

   getFeed(): string {
      const hash = window.location.hash;
      if (hash.length == 0) {
         return "";
      }
      let slashIndex = hash.indexOf("/");
      if (slashIndex == -1) return "";
      return decodeURIComponent(hash.substring(slashIndex + 1));
   }

   getSourcePrefix(): SourcePrefix {
      return "yt/";
   }

   getSortingOptions(): SortingOption[] {
      return [];
   }

   getSorting(): string {
      return "";
   }
}