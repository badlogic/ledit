import { CommentView } from "./comments";
import { assertNever } from "./utils";

export interface Posts<T> {
   posts: Post<T>[];
   after: string | null;
}

export interface Post<T> {
   url: string;
   domain: string | null;
   title: string;
   isSelf: boolean;
   author: string | null;
   authorUrl: string | null;
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

export interface Source<POST_DATA, COMMENT_DATA> {
   getPosts(after: string | null): Promise<Posts<POST_DATA>>,
   getComments(post: Post<POST_DATA>): Promise<Comment<COMMENT_DATA>[]>,
   getMetaDom(post: Post<POST_DATA>): HTMLElement[],
   getContentDom(post: Post<POST_DATA>): ContentDom,
   getCommentMetaDom(comment: Comment<COMMENT_DATA>, opName: string): HTMLElement[],
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
