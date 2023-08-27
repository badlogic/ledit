import { Page, SortingOption, Source, SourcePrefix } from "./data";
import { RssSource, RssPost } from "./rss";
import { dateToText, elements, intersectsViewport, onVisibleOnce, proxyFetch, setLinkTargetsToBlank } from "../utils";
import { dom, safeHTML } from "./utils";
// @ts-ignore
import { html } from "lit-html";

const channelIds = localStorage.getItem("youtubeCache") ? JSON.parse(localStorage.getItem("youtubeCache")!) : {};

export interface YoutubePost extends RssPost {
   author: string,
   authorUrl: string
}

export class YoutubeSource extends Source<YoutubePost> {
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

   async getPosts(nextPage: string | null): Promise<Page<YoutubePost> | Error> {
      const channels = this.getFeed().split("+");

      const promises: Promise<RssPost[] | Error>[] = [];
      for (const channel of channels) {
         promises.push(this.getYoutubeChannel(channel));
      }

      const promisesResult = await Promise.all(promises);
      const posts: YoutubePost[] = [];
      for (let i = 0; i < channels.length; i++) {
         const rssPosts = promisesResult[i];
         if (rssPosts instanceof Error) continue;
         for (const rssPost of rssPosts) {
            posts.push({
               ...rssPost,
               author: channels[i],
               authorUrl: "https://www.youtube.com/@" + channels[i]
            });
         }
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return { items: posts, nextPage: "end" };
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

export function renderYoutubePost(post: YoutubePost): HTMLElement[] {
   const date = dateToText(post.createdAt * 1000);

   const postDom = dom(html`
      <article class="post youtube-post gap-1">
         <a href="${post.url}" class="font-bold text-lg text-color">${post.title}</a>
         <div class="flex gap-1 text-xs">
            <a href="${post.authorUrl}" class="text-color/50">${post.author}</a>
            <span class="flex items-center text-color/50">•</span>
            <span class="flex items-center text-color/50">${date}</span>
         </div>
         <section x-id="contentDom" class="content px-0 w-full aspect-video"></section>
      </article>
   `);
   const { contentDom } = elements<{ contentDom: HTMLElement }>(postDom[0]);
   onVisibleOnce(postDom[0], () => {
      console.log("Rendering video " + post.title);
      const url = post.url.split("=");
      if (url.length != 2) return {elements: [], toggles: []};

      const videoDom = dom(safeHTML(`<iframe src="https://www.youtube.com/embed/${url[1]}?feature=oembed&amp;enablejsapi=1" class="youtube-embed w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen=""></iframe>`))[0];
      contentDom.append(videoDom);
      document.addEventListener("scroll", () => {
         if (!intersectsViewport(videoDom)) {
            (videoDom as HTMLIFrameElement).contentWindow?.postMessage('{"event":"command","func":"' + "pauseVideo" + '","args":""}', "*");
         }
      });
   });
   return postDom;
}