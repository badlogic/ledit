import { assertNever } from "./utils";

export interface Posts {
   posts: Post[];
   after: string | null;
}

export interface Post {
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
}

export interface Comment {
   url: string;
   author: string;
   authorUrl: string;
   createdAt: number;
   score: number | null;
   content: string | ContentDom;
   replies: Comment[];
   highlight: boolean;
}

export interface SortingOption {
   value: string;
   label: string;
}

export interface ContentDom {
   elements: Element[];
   toggles: Element[];
}

export interface Source {
   getPosts(after: string | null): Promise<Posts>,
   getComments(post: Post): Promise<Comment[]>,
   getContentDom(post: Post): ContentDom,
   getFeed(): string,
   getSourcePrefix(): SourcePrefix,
   getSortingOptions(): SortingOption[],
   getSorting(): string,
}

let source: Source | null = null;

export function setSource(src: Source) {
   source = src;
}

export function getSource(): Source {
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
