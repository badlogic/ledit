// @ts-ignore
import { FeedEntry } from "@extractus/feed-extractor";
import { Comment, ContentDom, Page, Post, SortingOption, Source, SourcePrefix } from "./data";
import { RssSource } from "./rss";
import { dateToText, dom, intersectsViewport, proxyFetch } from "./utils";

const channelIds = localStorage.getItem("youtubeCache") ? JSON.parse(localStorage.getItem("youtubeCache")!) : {};

export class YoutubeSource implements Source<FeedEntry, void> {

   async getYoutubeChannel(channel: string): Promise<Post<FeedEntry>[] | Error> {
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
         console.log(`Cached channel id ${channelId} for channel ${channel}`);
      }
      console.log(`Fetching recent videos for channel ${channel}, id: ${channelId}`);
      return RssSource.getRssPosts("https://www.youtube.com/feeds/videos.xml?channel_id=" + channelId);
   }

   async getPosts(nextPage: string | null): Promise<Page<Post<FeedEntry>>> {
      const channels = this.getFeed().split("+");

      const promises: Promise<Post<FeedEntry>[] | Error>[] = [];
      for (const channel of channels) {
         promises.push(this.getYoutubeChannel(channel));
      }

      const promisesResult = await Promise.all(promises);
      const posts: Post<FeedEntry>[] = [];
      for (let i = 0; i < channels.length; i++) {
         const result = promisesResult[i];
         if (result instanceof Error) continue;
         const channel = channels[i];
         for (const post of result) {
            post.author = channel;
         }
         posts.push(...result);
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return { items: posts, nextPage: "end" };
   }

   async getComments(post: Post<FeedEntry>): Promise<Comment<void>[]> {
      return [];
   }

   getMetaDom(post: Post<FeedEntry>): HTMLElement[] {
      return dom(/*html*/ `
      <a href="${"https://youtube.com/@" + post.author}">${post.author}</a>
      <span>•</span>
      <span>${dateToText(post.createdAt * 1000)}</span>
   `);
   }

   getContentDom(post: Post<FeedEntry>): ContentDom {
      const url = post.url.split("=");
      if (url.length != 2) return {elements: [], toggles: []};

      const videoDom = dom(`<iframe src="https://www.youtube.com/embed/${url[1]}?feature=oembed&amp;enablejsapi=1" class="youtube-embed" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen="" title="Russ Abbot in Married for Life"></iframe>`)[0];
      document.addEventListener("scroll", () => {
         if (!intersectsViewport(videoDom)) {
            (videoDom as HTMLIFrameElement).contentWindow?.postMessage('{"event":"command","func":"' + "pauseVideo" + '","args":""}', "*");
         }
      });
      return {elements: [videoDom], toggles: []};
   }

   getCommentMetaDom(comment: Comment<void>, opName: string): HTMLElement[] {
      return [];
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