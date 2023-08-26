import { assertNever } from "../utils";

export type PageIdentifier = string | "end" | null;

export type Page<T> = { items: T[]; nextPage: PageIdentifier };

export type SortingOption = {
   value: string;
   label: string;
}

export type Comment = { replies: Comment[] };

export abstract class Source<P, C extends Comment> {
   constructor(public readonly feed: string) {}
   abstract getPosts(nextPage: PageIdentifier): Promise<Page<P> | Error>;
   abstract getComments(post: P): Promise<C[] | Error>;
   abstract getSourcePrefix(): SourcePrefix;
   abstract getSortingOptions(): SortingOption[];
   abstract getSorting(): string;

   getFeed(): string {
      const feed = this.feed;
      if (feed.length == 0) {
         return "";
      }
      let slashIndex = feed.indexOf("/");
      if (slashIndex == -1) return "";
      return decodeURIComponent(feed.substring(slashIndex + 1));
   }
}

let source: Source<any, any> | null = null;

export function setSource(src: Source<any, any>) {
   source = src;
}

export function getSource(): Source<any, any> {
   if (!source) throw new Error("No source given.");
   return source;
}

export type SourcePrefix = "r/" | "hn/" | "rss/" | "yt/" | "m/";
export function sourcePrefixLabel(source: SourcePrefix) {
   switch(source) {
      case "r/": return "Reddit";
      case "hn/": return "Hackernews"
      case "rss/": return "RSS"
      case "yt/": return "YouTube"
      case "m/": return "Mastodon"
      default:
         assertNever(source);
   }
}
