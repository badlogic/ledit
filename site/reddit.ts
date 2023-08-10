let count = 0;
export interface Posts {
  kind: "listing";
  data: {
    after: string;
    children: Post[];
  };
}

export interface Post {
  data: {
    author: string;
    created_utc: number;
    domain: string;
    is_created_from_ads_ui: boolean;
    is_reddit_media_domain: boolean;
    is_video: boolean;
    is_self: boolean;
    is_gallery: boolean;
    id: string,
    num_comments: number;
    over_18: boolean;
    permalink: string;
    selftext_html: string;
    gallery_data: {
      items: {media_id: string, id: number}[],
    },
    media_metadata: {
      [key: string]: {
        status: string;
        p: {
          x: number;
          y: number;
          u: string;
        }[];
      };
    };
    preview: {
      enabled: boolean;
      images: {
        resolutions: {
          url: string;
          width: number;
          height: number;
        }[];
      }[];
      reddit_video_preview: {
        dash_url: string;
        hls_url: string;
        fallback_url: string;
        is_gif: boolean;
        width: number;
        height: number;
      } | null;
      source: {
        url: string;
        width: number;
        height: number;
      };
    };
    secure_media: {
      reddit_video: {
        fallback_url: string;
        width: number;
        height: number;
        dash_url: string;
        hls_url: string;
      };
    };
    secure_media_embed: {
      content: string;
      width: number;
      height: number;
      media_domain_url: string;
    };
    score: number;
    subreddit: string;
    subreddit_id: string;
    thumbnail: string;
    title: string;
    ups: number;
    downs: number;
    url: string;
  };
}

export interface Comment {
  data: {
    author: string;
    created_utc: number;
    body_html: string;
    score: number;
    permalink: string;
    replies: Comments | "" | undefined;
  };
  kind: "t1";
}

export interface Comments {
  data: {
    children: Comment[];
  };
  kind: "Listing";
}

/**
 * Gets the posts for the current subreddit and url encoded in `window.location.hash`.
 * E.g. `https://ledit.io/#austria/top-week` will fetch the data from
 * `https://www.reddit.com/austria/top/.json?t=week`.
 *
 * If `after` is given, then the page identifier by this token will be loaded instead
 * of the first page.
 */
export async function getPosts(after: string | null = null): Promise<Posts> {
  const sortFrag = getSortingFragment();
  const sortParam = getSortingParameter();
  const hash = "/r/" + getSubreddit() + "/" + sortFrag + "/.json?" + sortParam + "&" + (after ? "after=" + after : "");
  const url = "https://www.reddit.com" + (!hash.startsWith("/") ? "/" : "") + hash;
  const response = await fetch(url);
  return (await response.json()) as Posts;
}

/** Fetches the comments for a post. Returns null if no comments could be loaded. */
export async function getComments(post: Post) {
  const response = await fetch("https://www.reddit.com/" + post.data.permalink + "/.json");
  const data = await response.json();
  if (data.length < 2) return null;
  return data[1] as Comments;
}

/**
 * Extracts the subreddit name from `window.location.hash`, e.g.
 *`https://ledit.io/#austria/top-week` gives `austria`
 */
export function getSubreddit() {
  const hash = window.location.hash;
  if (hash.length == 0) {
    return "all";
  }
  const tokens = hash.substring(1).split("/");
  if (tokens.length == 0) return "all";
  return decodeURIComponent(tokens[0]);
}

/**
 * Extracts the subreddit name from `window.location.hash`, e.g.
 *`https://ledit.io/#austria/top-week` gives `top-week`.
 *
 * Returns `hot` if no sorting is given in the hash.
 */
export function getSorting() {
  const hash = window.location.hash;
  if (hash.length == 0) {
    return "hot";
  }
  const tokens = hash.substring(1).split("/");
  if (tokens.length < 2) return "hot";
  if (["hot", "new", "rising", "top-today", "top-week", "top-month", "top-year", "top-alltime"].some((sorting) => sorting == tokens[1])) {
    return tokens[1];
  } else {
    return "hot";
  }
}

/**
 * Takes our sorting, e.g. `top-week` and translates it to the first
 * part that needs to go into the reddit URL, e.g. the `top` part in
 * https://www.reddit.com/r/Austria/top/?t=week
 */
export function getSortingFragment() {
  return getSorting().split("-")[0];
}

/**
 * Takes our sorting, e.g. `top-week` and translates it to the first
 * part that needs to go into the reddit URL, e.g. the `t=week` part in
 * https://www.reddit.com/r/Austria/top/?t=week
 *
 * Returns an empty string if no sorting is given in the hash.
 */
export function getSortingParameter() {
  const tokens = getSorting().split("-");
  if (tokens.length != 2) return "";
  return "t=" + tokens[1];
}
