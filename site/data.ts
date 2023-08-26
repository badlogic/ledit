import { assertNever } from "./utils";

export type PageIdentifier = string | "end" | null;

export type Page<T> = { items: T[]; nextPage: PageIdentifier };

export type Post<T> = {
   url: string;
   title: string;
   author: string | null;
   createdAt: number;
   feed: string;
   numComments: number | null;
   data: T
}

export type Comment<T> = {
   url: string;
   author: string;
   authorUrl: string;
   createdAt: number;
   content: string | ContentDom;
   replies: Comment<T>[];
   highlight: boolean;
   data: T;
}

export type SortingOption = {
   value: string;
   label: string;
}

export type ContentDom = {
   elements: Element[];
   toggles: Element[];
}

export abstract class Source<P, C> {
   constructor(public readonly hash: string) {}
   abstract getPosts(nextPage: PageIdentifier): Promise<Page<Post<P>> | Error>;
   abstract getComments(post: Post<P>): Promise<Comment<C>[] | Error>;
   abstract getMetaDom(post: Post<P>): HTMLElement[];
   abstract getContentDom(post: Post<P>): ContentDom;
   abstract getCommentMetaDom(comment: Comment<C>, opName: string | null): HTMLElement[];
   abstract getFeed(): string;
   abstract getSourcePrefix(): SourcePrefix;
   abstract getSortingOptions(): SortingOption[];
   abstract getSorting(): string;
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
