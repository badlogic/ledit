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
    num_comments: number;
    over_18: boolean;
    permalink: string;
    selftext_html: string;
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
        hls_url: string,
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
        width: number,
        height: number,
        dash_url: string,
        hls_url: string
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

export function dateToText(utcTimestamp: number): string {
  const now = Date.now();
  const timeDifference = now - utcTimestamp;

  const seconds = Math.floor(timeDifference / 1000);
  if (seconds < 60) {
    return seconds == 1 ? `${seconds} second ago` : `${seconds} seconds ago`;
  }

  const minutes = Math.floor(timeDifference / (1000 * 60));
  if (minutes < 60) {
    return minutes == 1 ? `${minutes} minute ago` : `${minutes} minutes ago`;
  }

  const hours = Math.floor(timeDifference / (1000 * 60 * 60));
  if (hours < 24) {
    return hours == 1 ? `${hours} hour ago` : `${hours} hours ago`;
  }

  const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
  if (days < 30) {
    return days == 1 ? `${days} day ago` : `${days} days ago`;
  }

  const months = Math.floor(timeDifference / (1000 * 60 * 60 * 24 * 30));
  if (months < 12) {
    return months == 1 ? `${months} months ago` : `${months} months ago`;
  }

  const years = Math.floor(timeDifference / (1000 * 60 * 60 * 24 * 365));
  return years == 1 ? `${years} years ago` : `${years} years ago`;
}

export async function queryReddit(after: string | null = null): Promise<Posts> {
  const hash = "/r/" + getSubreddit() + "/.json" + (after ? "?after=" + after : "");
  const url = "https://www.reddit.com" + (!hash.startsWith("/") ? "/" : "") + hash;
  const response = await fetch(url);
  return (await response.json()) as Posts;
}

export async function getComments(post: Post) {
  const response = await fetch("https://www.reddit.com/" + post.data.permalink + "/.json");
  const data = await response.json();
  if (data.length < 2) return null;
  return data[1] as Comments;
}

export function getSubreddit() {
  const hash = window.location.hash;
  if (hash.length == 0) {
    return "all";
  }
  return hash.substring(1, hash.indexOf("/") > 0 ? hash.indexOf("/") : hash.length);
}

export function onVisibleOnce(target: HTMLElement, callback: () => void) {
  let isTargetVisible = false;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target === target && entry.isIntersecting) {
        if (!isTargetVisible) {
          isTargetVisible = true;
          callback();
        }
        observer.unobserve(target);
      }
    });
  });
  observer.observe(target);
}

export function htmlDecode(input) {
  var doc = new DOMParser().parseFromString(input, "text/html");
  return doc.documentElement.textContent;
}
