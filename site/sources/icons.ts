// @ts-ignore
import settingsIconSvg from "remixicon/icons/System/settings-2-line.svg";
// @ts-ignore
import bookmarkIconSvg from "remixicon/icons/Business/bookmark-line.svg";
// @ts-ignore
import addIconSvg from "remixicon/icons/System/add-circle-line.svg";
// @ts-ignore
import closeIconSvg from "remixicon/icons/System/close-circle-line.svg";
// @ts-ignore
import loaderIconSvg from "../svg/loader.svg";
// @ts-ignore
import commentIconSvg from "remixicon/icons/Communication/chat-4-line.svg";
// @ts-ignore
import replyIconSvg from "remixicon/icons/Business/reply-line.svg";
// @ts-ignore
import starIconSvg from "remixicon/icons/System/star-line.svg";
// @ts-ignore
import reblogIconSvg from "remixicon/icons/Media/repeat-line.svg";
// @ts-ignore
import imageIconSvg from "remixicon/icons/Media/image-line.svg";
// @ts-ignore
import checkmarkIconSvg from "remixicon/icons/System/check-line.svg";
// @ts-ignore
import githubIconSvg from "remixicon/icons/Logos/github-line.svg";
// @ts-ignore
import heartIconSvg from "remixicon/icons/Health & Medical/heart-line.svg";
// @ts-ignore
import sunIconSvg from "remixicon/icons/Weather/sun-line.svg";
// @ts-ignore
import moonIconSvg from "remixicon/icons/Weather/moon-line.svg";
// @ts-ignore
import rssIconSvg from "remixicon/icons/Device/rss-line.svg";
// @ts-ignore
import youtubeIconSvg from "remixicon/icons/Logos/youtube-line.svg";
// @ts-ignore
import redditIconSvg from "remixicon/icons/Logos/reddit-line.svg";
// @ts-ignore
import mastodonIconSvg from "remixicon/icons/Logos/mastodon-fill.svg";
// @ts-ignore
import hackernewsIconSvg from "../svg/hackernews.svg";
// @ts-ignore
import editIconSvg from "remixicon/icons/Design/edit-line.svg";
// @ts-ignore
import loaderIconSvg from "../svg/loader.svg";

import { unsafeHTML } from "lit-html/directives/unsafe-html.js";
import { SourcePrefix } from "./data";
import { assertNever } from "../utils";

export const settingsIcon = unsafeHTML(settingsIconSvg);
export const bookmarkIcon = unsafeHTML(bookmarkIconSvg);
export const addIcon = unsafeHTML(addIconSvg);
export const closeIcon = unsafeHTML(closeIconSvg);
export const loaderIcon = unsafeHTML(loaderIconSvg);
export const commentIcon = unsafeHTML(commentIconSvg);
export const replyIcon = unsafeHTML(replyIconSvg);
export const starIcon = unsafeHTML(starIconSvg);
export const reblogIcon = unsafeHTML(reblogIconSvg);
export const imageIcon = unsafeHTML(imageIconSvg);
export const checkmarkIcon = unsafeHTML(checkmarkIconSvg);
export const githubIcon = unsafeHTML(githubIconSvg);
export const heartIcon = unsafeHTML(heartIconSvg);
export const sunIcon = unsafeHTML(sunIconSvg);
export const moonIcon = unsafeHTML(moonIconSvg);
export const rssIcon = unsafeHTML(rssIconSvg);
export const youtubeIcon = unsafeHTML(youtubeIconSvg);
export const redditIcon = unsafeHTML(redditIconSvg);
export const mastodonIcon = unsafeHTML(mastodonIconSvg);
export const hackernewsIcon = unsafeHTML(hackernewsIconSvg);
export const editIcon = unsafeHTML(editIconSvg);

export function getIconForSource(source: SourcePrefix) {
   switch (source) {
      case "r/":
         return redditIcon;
      case "hn/":
         return hackernewsIcon;
      case "rss/":
         return rssIcon;
      case "yt/":
         return youtubeIcon;
      case "m/":
         return mastodonIcon;
      default:
         assertNever(source);
   }
}
