import { Page, SortingOption, Source, SourcePrefix } from "./data";
import { RssSource, RssPost, RssComment } from "./rss";
import { proxyFetch } from "../utils";

const channelIds = localStorage.getItem("youtubeCache") ? JSON.parse(localStorage.getItem("youtubeCache")!) : {};

export class YoutubeSource extends Source<RssPost, RssComment> {
   async getYoutubeChannel(channel: string): Promise<RssPost[] | Error> {
      let channelId: string | null = channelIds[channel];

      if (!channelId) {
         const url = "https://www.youtube.com/@" + channel;
         const response = await proxyFetch(url);
         const text = await response.text();
         const channelIdIdx = text.indexOf("vnd.youtube://www.youtube.com/channel/");
         if (channelIdIdx == -1) return [];
         const channelIdEnd = text.indexOf('"', channelIdIdx);
         if (channelIdEnd == -1) return [];
         channelId = text.substring(channelIdIdx + "vnd.youtube://www.youtube.com/channel/".length, channelIdEnd);
         channelIds[channel] = channelId;
         localStorage.setItem("youtubeCache", JSON.stringify(channelIds));
      }
      return RssSource.getRssPosts("https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId);
   }

   async getPosts(nextPage: string | null): Promise<Page<RssPost> | Error> {
      const channels = this.getFeed().split("+");

      const promises: Promise<RssPost[] | Error>[] = [];
      for (const channel of channels) {
         promises.push(this.getYoutubeChannel(channel));
      }

      const promisesResult = await Promise.all(promises);
      const posts: RssPost[] = [];
      for (let i = 0; i < channels.length; i++) {
         const result = promisesResult[i];
         if (result instanceof Error) continue;
         posts.push(...result);
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return { items: posts, nextPage: "end" };
   }

   async getComments(post: RssPost): Promise<RssComment[]> {
      return [];
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