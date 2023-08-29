import { assertNever } from "../utils";

export type PageIdentifier = string | "end" | null;

export type Page<T> = { items: T[]; nextPage: PageIdentifier };

export type SortingOption = {
   value: string;
   label: string;
}

export abstract class Source<P> {
   constructor(public readonly feed: string) {}
   abstract renderMain(main: HTMLElement): void;
   abstract getSortingOptions(): SortingOption[];

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
