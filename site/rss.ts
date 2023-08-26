// @ts-ignore
import "./rss.css";

// @ts-ignore
import { FeedEntry, extractFromXml } from "@extractus/feed-extractor";
import { Comment, ContentDom, Page, Post, SortingOption, Source, SourcePrefix } from "./data";
import { dateToText, dom, makeCollapsible, proxyFetch, removeTrailingEmptyParagraphs } from "./utils";
import { parse, isValid } from "date-fns";

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

export type RssPostData = { channelImage: string | null, entry: FeedEntry }

export class RssSource extends Source<RssPostData, void> {
   public static async getRssPosts(url: string): Promise<Post<RssPostData>[] | Error> {
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

         const posts: Post<RssPostData>[] = [];
         for (const entry of result.entries) {
            if (!entry.link || !entry.published) continue;
            posts.push({
               url: entry.link,
               title: entry.title!,
               author: null,
               createdAt: parseFeedDate(entry.published as any as string).getTime() / 1000,
               feed: url,
               numComments: null,
               data: { channelImage, entry }
            });
         }
         return posts;
      } catch (e) {
         console.error("Couldn't get RSS feed " + url, e);
         return new Error(`Could not load entries for RSS feed ${url}`);
      }
   }

   async getPosts(nextPage: string | null): Promise<Page<Post<RssPostData>> | Error> {
      const urls = this.getFeed().split("+");
      const promises: Promise<Post<RssPostData>[] | Error>[] = [];
      for (const url of urls) {
         promises.push(RssSource.getRssPosts(url));
      }

      const promisesResult = await Promise.all(promises);
      const posts: Post<RssPostData>[] = [];
      for (const result of promisesResult) {
         if (result instanceof Error) continue;
         posts.push(...result);
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return { items: posts, nextPage: "end" };
   }

   async getComments(post: Post<RssPostData>): Promise<Comment<void>[]> {
      throw new Error("Method not implemented.");
   }

   getMetaDom(post: Post<RssPostData>): HTMLElement[] {
      return dom(/*html*/ `
         <a href="${new URL(post.url).host}">${post.feed}</a>
         <span>•</span>
         <span>${dateToText(post.createdAt * 1000)}</span>
      `);
   }

   getContentDom(post: Post<RssPostData>): ContentDom {
      const data = post.data;
      const xmlItem = data.entry;
      if (!xmlItem) return {elements: [], toggles: []};
      const description = (xmlItem as any).html ?? xmlItem.description;
      if (!description) return {elements: [], toggles: []};
      let imageUrl = null;

      const enclosure = (xmlItem as any).enclosure;
      if (enclosure) {
         imageUrl = enclosure.url;
      }

      const mediaContent = (xmlItem as any).mediaContent;
      if (mediaContent) {
         imageUrl = mediaContent.url;
      }

      const content = dom(
         `<div class="content rss-content">${
            imageUrl ? `<img src="${imageUrl}" class="rss-content-image">` : ""
         } <div>${removeTrailingEmptyParagraphs(description)}</div></div>`
      )[0];
      content.querySelectorAll("iframe").forEach((iframe) => iframe.remove());
      requestAnimationFrame(() => {
         makeCollapsible(content, 8);
      });
      return {elements: [content], toggles: []};
   }

   getCommentMetaDom(comment: Comment<void>, opName: string): HTMLElement[] {
      return [];
   }

   getFeed(): string {
      const hash = this.hash;
      if (hash.length == 0) {
         return "";
      }
      let slashIndex = hash.indexOf("/");
      if (slashIndex == -1) return "";
      return decodeURIComponent(hash.substring(slashIndex + 1));
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
