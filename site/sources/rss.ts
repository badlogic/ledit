// @ts-ignore
import { extractFromXml } from "@extractus/feed-extractor";
import { Page, SortingOption, Source, SourcePrefix } from "./data";
import { parse, isValid } from "date-fns";
import { dateToText, elements, onVisibleOnce, proxyFetch, removeTrailingEmptyParagraphs, setLinkTargetsToBlank } from "../utils";
// @ts-ignore
import { html } from "lit-html";
import { dom, makeCollapsible, safeHTML } from "./utils";

function parseFeedDate(dateString: string): Date {
   // Common RSS and Atom date formats (RFC 822 and RFC 3339)
   const possibleFormats = [
      "EEE, dd MMM yyyy HH:mm:ss 'GMT'",
      "EEE, dd MMM yyyy HH:mm:ss xx", // RFC 822
      "yyyy-MM-dd'T'HH:mm:ss.SSSxxx", // RFC 3339 with milliseconds
      "yyyy-MM-dd'T'HH:mm:ssxxx", // RFC 3339 without milliseconds
      "yyyy-MM-dd'T'HH:mm:ss'Z'", // RFC 3339 UTC format
   ];

   for (const format of possibleFormats) {
      try {
         const parsedDate = parse(dateString, format, new Date());
         if (isValid(parsedDate)) {
            return parsedDate;
         }
      } catch (error) {
         // Parsing failed with the current format, continue trying others
      }
   }

   console.error("Unable to parse feed date:", dateString);
   return new Date();
}

function getChannelImage(rss: Document) {
   const channelImageNode = rss.querySelector("channel > image > url");
   if (channelImageNode) {
      const imageUrl = channelImageNode.textContent;
      return imageUrl;
   } else {
      return null;
   }
}

export type RssPost = { url: string; title: string; createdAt: number; feed: string; channelImage: string | null; previewImage: string | null, content: string | null};
export type RssComment = { replies: [] };

export class RssSource extends Source<RssPost, RssComment> {
   public static async getRssPosts(url: string): Promise<RssPost[] | Error> {
      const options = {
         useISODateFormat: false,
         getExtraEntryFields: (feedEntry: any) => {
            const result: any = {};
            if (feedEntry.enclosure) {
               result["enclosure"] = {
                  url: feedEntry.enclosure["@_url"],
                  type: feedEntry.enclosure["@_type"],
                  length: feedEntry.enclosure["@_length"],
               };
            }
            if (feedEntry["media:content"]) {
               result["mediaContent"] = {
                  url: feedEntry["media:content"]["@_url"],
                  type: feedEntry["media:content"]["@_type"],
                  length: feedEntry["media:content"]["@_length"],
               };
            }
            if (feedEntry.content) {
               if (feedEntry.content["@_type"] == "html") {
                  result.html = feedEntry.content["#text"];
               }
            }
            if (feedEntry.description) {
               if (feedEntry.description.includes("<") && feedEntry.description.includes(">")) {
                  result.html = feedEntry.description;
               }
            }

            if (feedEntry["content:encoded"]) {
               if (feedEntry["content:encoded"].includes("<") && feedEntry["content:encoded"].includes(">")) {
                  result.html = feedEntry["content:encoded"];
               }
            }
            return result;
         },
      };

      try {
         const response = await proxyFetch(url);
         const text = await response.text();
         const rss = await new window.DOMParser().parseFromString(text, "text/xml");
         const channelImage = getChannelImage(rss);
         const result = extractFromXml(text, options);
         if (!result || !result.entries) return new Error(`Could not load entries for RSS feed ${url}`);

         const posts: RssPost[] = [];
         for (const entry of result.entries) {
            if (!entry.link || !entry.published) continue;
            let previewImage: string | null = null;
            const enclosure = (entry as any).enclosure;
            if (enclosure) previewImage = enclosure.url;
            const mediaContent = (entry as any).mediaContent;
            if (mediaContent) previewImage = mediaContent.url;
            posts.push({
               url: entry.link,
               title: entry.title!,
               createdAt: parseFeedDate(entry.published as any as string).getTime() / 1000,
               feed: url,
               channelImage,
               previewImage,
               content: (entry as any).html ? removeTrailingEmptyParagraphs((entry as any).html) : entry.description ?? null
            });
         }
         return posts;
      } catch (e) {
         console.error("Couldn't get RSS feed " + url, e);
         return new Error(`Could not load entries for RSS feed ${url}`);
      }
   }

   async getPosts(nextPage: string | null): Promise<Page<RssPost> | Error> {
      const urls = this.getFeed().split("+");
      const promises: Promise<RssPost[] | Error>[] = [];
      for (const url of urls) {
         promises.push(RssSource.getRssPosts(url));
      }

      const promisesResult = await Promise.all(promises);
      const posts: RssPost[] = [];
      for (const result of promisesResult) {
         if (result instanceof Error) continue;
         posts.push(...result);
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return { items: posts, nextPage: "end" };
   }

   async getComments(post: RssPost): Promise<RssComment[]> {
      throw new Error("Method not implemented.");
   }

   getSourcePrefix(): SourcePrefix {
      return "rss/";
   }

   getSortingOptions(): SortingOption[] {
      return [];
   }

   getSorting(): string {
      return "";
   }
}

export function renderRssPost(post: RssPost) {
   const domain = new URL(post.feed).host;
   const channelImage = post.channelImage;
   const date = dateToText(post.createdAt * 1000);
   const previewImage = post.previewImage;
   const content = post.content;

   const postDom = dom(html`
      <article class="post gap-1">
         <a href="${post.url}" class="font-bold text-lg text-color">${post.title}</a>
         <div class="flex gap-1 text-xs">
            <a href="https://${domain}" class="text-color/50"> ${channelImage ? html`<img src="${channelImage}" class="max-h-4" />` : domain} </a>
            <span class="flex items-center text-color/50">•</span>
            <span class="flex items-center text-color/50">${date}</span>
         </div>
         <section x-id="contentDom" class="rss-content">${previewImage ? html`<img src="${previewImage}" class="rss-content-image py-4" />` : ""}</section>
      </article>
   `);
   const { contentDom } = elements<{ contentDom: HTMLElement }>(postDom[0]);
   if (content) {
      onVisibleOnce(postDom[0], () => {
         let element: HTMLElement[] = typeof content === "string" ? dom(html`<div>${safeHTML(content)}</div>`) : content;
         contentDom.append(...element);
         makeCollapsible(contentDom, 10);
         setLinkTargetsToBlank(contentDom);
      });
   }
   return postDom;
}