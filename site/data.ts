export interface Posts {
   posts: Post[];
   after: string | null;
}

export interface Post {
   url: string;
   title: string;
   isSelf: boolean;
   isGallery: boolean;
   numGalleryImages: number;
   author: string;
   authorUrl: string;
   createdAt: number;
   sub: string;
   score: number;
   numComments: number;
}

export interface Comment {
   url: string;
   author: string;
   authorUrl: string;
   createdAt: number;
   score: number;
   html: string;
   replies: Comment[];
}

export interface SortingOption {
   value: string;
   label: string;
}

export interface Source {
   getPosts(after: string | null): Promise<Posts>,
   getComments(post: Post): Promise<Comment[]>,
   getMediaDom(post: Post): Element[],
   getSub(): string,
   getSubPrefix(): string,
   getSortingOptions(): SortingOption[],
   getSorting(): string,
   isSingleSource(): boolean
}

let source: Source | null = null;

export function setSource(src: Source) {
   source = src;
}

export function getSource(): Source {
   if (!source) throw new Error("No source given.");
   return source;
}
