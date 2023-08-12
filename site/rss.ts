import { FeedEntry, extractFromXml } from "@extractus/feed-extractor";
import { Comment, Post, Posts, SortingOption, Source, SourcePrefix } from "./data";
import { dom, limitElementHeight, removeTrailingEmptyParagraphs } from "./utils";

export class RssSource implements Source {
   extractChannelImage(rss: Document) {
      const channelImageNode = rss.querySelector("channel > image > url");
      if (channelImageNode) {
         const imageUrl = channelImageNode.textContent;
         return imageUrl;
      } else {
         return null;
      }
   }

   async getRssPosts(url: string): Promise<Post[]> {
      const options = {
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
            return result;
         },
      };

      const response = await fetch("http://marioslab.io/proxy?url=" + encodeURI(url));
      const text = await response.text();
      console.log(text);
      const rss = await new window.DOMParser().parseFromString(text, "text/xml");
      const channelImageUrl = this.extractChannelImage(rss);
      const result = extractFromXml(text, options);
      if (!result || !result.entries) return [];

      const posts: Post[] = [];
      for (const entry of result.entries) {
         if (!entry.link || !entry.published || !entry.title) continue;
         posts.push({
            url: entry.link,
            title: entry.title,
            isSelf: true,
            isGallery: false,
            numGalleryImages: 0,
            author: "",
            authorUrl: "",
            createdAt: new Date(entry.published).getTime() / 1000,
            sub: `${channelImageUrl ? `<img src="${channelImageUrl}" style="max-height: calc(1.5 * var(--ledit-font-size));"></img>` : new URL(url).hostname}`,
            score: -1,
            numComments: -1,
            xmlItem: entry,
         } as Post);
      }
      return posts;
   }

   async getPosts(after: string | null): Promise<Posts> {
      const urls = this.getSub().split("+");
      const promises: Promise<Post[]>[] = [];
      for (const url of urls) {
         promises.push(this.getRssPosts(url));
      }

      const promisesResult = await Promise.all(promises);
      const posts: Post[] = [];
      for (const result of promisesResult) {
         posts.push(...result);
      }
      posts.sort((a, b) => b.createdAt - a.createdAt);
      return { posts, after: null };
   }

   async getComments(post: Post): Promise<Comment[]> {
      throw new Error("Method not implemented.");
   }

   getMediaDom(post: Post): Element[] {
      const xmlItem = (post as any).xmlItem as FeedEntry;
      if (!xmlItem) return [];
      const description = xmlItem.description;
      if (!description) return [];
      let imageUrl = null;

      const enclosure = (xmlItem as any).enclosure;
      if (enclosure) {
         imageUrl = enclosure.url;
      }

      const mediaContent = (xmlItem as any).mediaContent;
      if (mediaContent) {
         imageUrl = mediaContent.url;
      }

      const postDiv = dom(
         `<div class="post-rss-preview">${
            imageUrl ? `<img src="${imageUrl}" class="post-rss-preview-image" style="flex: 0; max-width: 150px !important;">` : ""
         } <div>${removeTrailingEmptyParagraphs(description)}</div></div>`
      )[0];

      // Ensure links in self text open a new tab
      let links = postDiv.querySelectorAll("a")!;
      for (let i = 0; i < links.length; i++) {
         let link = links[i];
         link.setAttribute("target", "_blank");
      }

      requestAnimationFrame(() => {
         limitElementHeight(postDiv, 8);
      });
      return [postDiv];
   }

   getSub(): string {
      const hash = window.location.hash;
      if (hash.length == 0) {
         return "";
      }
      let slashIndex = hash.indexOf("/");
      if (slashIndex == -1) return "";
      return decodeURIComponent(hash.substring(slashIndex + 1));
   }

   getSubPrefix(): SourcePrefix {
      return "rss/";
   }

   getSortingOptions(): SortingOption[] {
      return [];
   }

   getSorting(): string {
      return "";
   }
}
