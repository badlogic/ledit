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
      const response = await fetch("http://marioslab.io/proxy?url=" + encodeURI(url));
      const text = await response.text();
      console.log(text);
      const rss = await new window.DOMParser().parseFromString(text, "text/xml");
      const channelImageUrl = this.extractChannelImage(rss);
      const xmlItems = rss.querySelectorAll("item");
      const posts: Post[] = [];
      xmlItems.forEach((item) => {
         try {
            const title = item.querySelector("title")?.textContent;
            if (!title) return;
            const url = (item.querySelector("link") as any).textContent;
            if (!url) return;
            let date = new Date().toUTCString();
            if (item.querySelector("pubDate")) {
               date = (item.querySelector("pubDate") as any).textContent;
            } else if (item.getElementsByTagName("dc:date").length > 0) {
               date = (item.getElementsByTagName("dc:date")[0] as any).textContent;
            }
            if (!date) return;
            posts.push({
               url,
               title,
               isSelf: true,
               isGallery: false,
               numGalleryImages: 0,
               author: "",
               authorUrl: "",
               createdAt: new Date(date).getTime() / 1000,
               sub: `${
                  channelImageUrl
                     ? `<img src="${channelImageUrl}" style="max-height: calc(var(--ledit-font-size) * 1);"></img>`
                     : new URL(url).hostname
               }`,
               score: -1,
               numComments: -1,
               xmlItem: item,
            } as Post);
         } catch (e) {
            console.error("Couldn't parse rss item", e);
         }
      });
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
      const xmlItem = (post as any).xmlItem;
      if (!xmlItem) return [];
      if (!xmlItem.querySelector("description")) return [];
      const description = xmlItem.querySelector("description").textContent;
      if (!description) return [];
      let imageUrl = null;
      const enclosure = xmlItem.querySelector("enclosure");
      if (enclosure) {
         if (enclosure.getAttribute("type") && enclosure.getAttribute("type").startsWith("image")) {
            imageUrl = enclosure.getAttribute("url");
         }
      }
      const mediaContent = xmlItem.querySelector("media\\:content");
      if (mediaContent) {
         if (mediaContent.getAttribute("type") && mediaContent.getAttribute("type").startsWith("image")) {
            imageUrl = mediaContent.getAttribute("url");
         }
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
      })

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
