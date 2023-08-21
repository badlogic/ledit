import { CommentView } from "./comments";
import { assertNever } from "./utils";

export type PageIdentifier = string | "end" | null;

export type Page<T> = { items: T[]; nextPage: PageIdentifier };

export interface Post<T> {
   url: string;
   title: string;
   author: string | null;
   createdAt: number;
   feed: string;
   numComments: number | null;
   contentOnly: boolean;
   data: T
}

export interface Comment<T> {
   url: string;
   author: string;
   authorUrl: string;
   createdAt: number;
   score: number | null;
   content: string | ContentDom;
   replies: Comment<T>[];
   highlight: boolean;
   data: T;
}

export interface SortingOption {
   value: string;
   label: string;
}

export interface ContentDom {
   elements: Element[];
   toggles: Element[];
}

export interface Source<P, C> {
   getPosts(nextPage: PageIdentifier): Promise<Page<Post<P>> | Error>,
   getComments(post: Post<P>): Promise<Comment<C>[] | Error>,
   getMetaDom(post: Post<P>): HTMLElement[],
   getContentDom(post: Post<P>): ContentDom,
   getCommentMetaDom(comment: Comment<C>, opName: string | null): HTMLElement[],
   getFeed(): string,
   getSourcePrefix(): SourcePrefix,
   getSortingOptions(): SortingOption[],
   getSorting(): string,
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
