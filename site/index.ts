import {
  Post,
  Comment,
  Posts,
  dateToText,
  getComments,
  getSubreddit,
  htmlDecode,
  onVisibleOnce,
  queryReddit,
  getSorting,
  intersectsViewport,
} from "./utils";
// @ts-ignore
import svgLoader from "./svg-loader.svg";
// @ts-ignore
import svgMenuExpanded from "./svg-menu-expanded.svg";
// @ts-ignore
import svgMenuMinus from "./svg-menu-minus.svg";
// @ts-ignore
import svgMenuPlus from "./svg-menu-plus.svg";
// @ts-ignore
import svgMenuCircle from "./svg-menu-circle.svg";
import videojs from "video.js";
import Player from "video.js/dist/types/player";

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    document.querySelector(".header-subreddit")!.classList.remove("hidden");
    document.querySelector(".header-subreddit-input")!.classList.add("hidden");
    document.querySelector(".settings-container")?.classList.add("hidden");
  }
});

function setURL(hash: string) {
  window.location.hash = hash;
}

function renderHeader() {
  const headerContainer = document.querySelector(".header-container")!;
  headerContainer.innerHTML = "";
  const header = dom(`
  <div class="header">
    <div class="header-menu svg-icon no-user-select"" style="padding-left: var(--ledit-padding);"></div>
    <div class="header-subreddit"></div>
    <input class="header-subreddit-input hidden"/>
    <select class="header-sorting" tabindex="-1" style="padding-right: var(--ledit-padding);">
      <option value="hot">Hot</option>
      <option value="new">New</option>
      <option value="rising">Rising</option>
      <option value="top-today">Top Today</option>
      <option value="top-week">Top Week</option>
      <option value="top-month">Top Month</option>
      <option value="top-year">Top Year</option>
      <option value="top-alltime">Top All time</option>
    </select>
    <span class="header-subreddit-add svg-icon" style="padding-right: var(--ledit-padding);"></span>
  </div>
  `)[0];
  headerContainer.append(header);

  const subreddit = getSubreddit();
  const settings = getSettings();

  const addButton = headerContainer.querySelector(".header-subreddit-add")!;
  if (!settings.subreddits.some((sub) => sub.toLowerCase() == subreddit.toLowerCase())) {
    addButton.innerHTML = svgMenuPlus;
    addButton.addEventListener("click", () => {
      settings.subreddits.push(subreddit);
      saveSettings(settings);
      renderHeader();
    });
  }

  const headerSubreddit = headerContainer.querySelector(".header-subreddit")!;
  headerSubreddit.innerHTML = "/r/" + subreddit;
  const input = headerContainer.querySelector(".header-subreddit-input") as HTMLInputElement;
  headerSubreddit.addEventListener("click", () => {
    headerSubreddit.classList.add("hidden");
    input.classList.remove("hidden");
    input.value = subreddit;
    input.select();
    input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === "Go" || event.keyCode === 13) {
        event.preventDefault();
        setURL(input.value);
        headerSubreddit.classList.remove("hidden");
        input.classList.add("hidden");
      }
    });
    input.addEventListener("blur", function () {
      headerSubreddit.classList.remove("hidden");
      input.classList.add("hidden");
    });
  });

  const menuButton = document.querySelector(".header-menu")!;
  menuButton.innerHTML = svgMenuExpanded;
  menuButton.addEventListener("click", () => {
    if (!document.querySelector(".settings-container")!.classList.contains("hidden")) {
      document.querySelector(".settings-container")?.classList.add("hidden");
    } else {
      document.querySelector(".settings-container")?.classList.remove("hidden");
      renderSettings();
    }
  });

  const sorting = document.querySelector(".header-sorting") as HTMLSelectElement;
  for (const option of sorting.children) {
    if ((option as HTMLOptionElement).value == getSorting()) {
      (option as HTMLOptionElement).selected = true;
    }
  }
  sorting.value = getSorting();
  sorting.addEventListener("change", () => {
    setURL(getSubreddit() + "/" + sorting.value);
    headerSubreddit.classList.remove("hidden");
    input.classList.add("hidden");
  });

  renderSettings();
}

interface Settings {
  subreddits: string[];
  theme: string;
}

function getSettings(): Settings {
  return localStorage.getItem("ledit")
    ? JSON.parse(localStorage.getItem("ledit")!)
    : {
        subreddits: ["all", "pics", "videos", "worldnews", "science", "todayilearned"],
        theme: "light",
      };
}

function saveSettings(settings: Settings) {
  localStorage.setItem("ledit", JSON.stringify(settings));
}

function renderSettings() {
  const settingsContainer = document.querySelector(".settings-container")!;
  settingsContainer.innerHTML = `
    <div class="settings">
    </div>
  `;
  const menuButton = document.querySelector(".header-menu")!;
  settingsContainer.addEventListener("click", (event) => {
    if (settingsContainer == event.target) {
      settingsContainer.classList.add("hidden");
    }
  });
  const settingsDiv = settingsContainer.querySelector(".settings")!;
  settingsContainer.addEventListener("click", (event) => {
    if (settingsDiv == event.target) {
      settingsContainer.classList.add("hidden");
    }
  });

  const render = () => {
    settingsDiv.innerHTML = "";
    const closeButton = dom(`<div class="settings-row-close">Close</div>`)[0];
    closeButton.addEventListener("click", () => {
      settingsContainer.classList.add("hidden");
    });
    settingsDiv.append(closeButton);
    settingsDiv.append(dom(`<div class="settings-row-header">Subreddits</div>`)[0]);
    const settings = getSettings();
    for (const subreddit of settings.subreddits) {
      const subredditDiv = dom(`
        <div class="settings-row">
          <a href="#${subreddit}" style="flex: 1">${subreddit}</a><span class="svg-icon">${svgMenuMinus}</span>
        </div>`)[0];
      subredditDiv.querySelector("a")!.addEventListener("click", () => {
        settingsContainer.classList.add("hidden");
      });
      subredditDiv.querySelector("span")!.addEventListener("click", () => {
        settings.subreddits = settings.subreddits.filter((sub) => sub != subreddit);
        saveSettings(settings);
        renderHeader();
      });
      settingsDiv.append(subredditDiv);
    }

    settingsDiv.append(dom(`<div class="settings-row-header">Theme</div>`)[0]);
    for (const theme of ["Dark", "Light"]) {
      const themeDiv = dom(`
      <div class="settings-row">
        <span style="flex: 1">${theme}</span><span class="svg-icon hidden">${svgMenuCircle}</span>
      </div>`)[0];
      if (settings.theme == theme.toLowerCase()) {
        themeDiv.querySelector(".svg-icon")?.classList.remove("hidden");
      }
      themeDiv.addEventListener("click", () => {
        document.body.classList.remove("dark-theme");
        document.body.classList.remove("light-theme");
        document.body.classList.add(theme.toLowerCase() + "-theme");
        settings.theme = theme;
        saveSettings(settings);
        render();
      });
      settingsDiv.append(themeDiv);
    }
  };
  render();
}

function renderPosts(listing: Posts) {
  const posts = document.querySelector(".posts")! as HTMLElement;
  if ((!listing || !listing.data || !listing.data.children) && posts.children.length == 0) {
    const div = document.createElement("div");
    div.innerHTML = `Subreddit ${getSubreddit()} doesn't exist.`;
    posts.append(div);
    return;
  }

  const videos: Player[] = [];
  for (let i = 0; i < listing.data.children.length; i++) {
    const post = listing.data.children[i];
    const postDiv = renderPost(post);
    posts.append(postDiv);
    const videoDiv = postDiv.querySelector("video-js");
    if (videoDiv) {
      const video = videojs(videoDiv);
      videos.push(video);
      var videoElement = video.el().querySelector("video")!;

      // Add a click event listener to the video element
      videoElement.addEventListener("touchend", function () {
        if (video.paused()) {
          video.play();
        } else {
          video.pause();
        }
      });
    }
  }

  document.addEventListener("scroll", () => {
    for (const video of videos) {
      const videoElement = video.el().querySelector("video");
      if (videoElement && videoElement === document.pictureInPictureElement) {
        continue;
      }
      if (!video.paused() && !intersectsViewport(videoElement)) {
        video.pause();
      }
    }
  });

  const loadingDiv = showLoading();
  loadingDiv.innerHTML = "Load more";
  const loadNext = async () => {
    try {
      loadingDiv.innerHTML = svgLoader;
      const result = await queryReddit(listing.data.after);
      renderPosts(result);
    } catch (e) {
      showError("Could not load more posts in r/" + getSubreddit(), e);
    } finally {
      loadingDiv.remove();
    }
  };
  onVisibleOnce(loadingDiv, loadNext);
  loadingDiv.addEventListener("click", loadNext);
}

function dom(dom: string) {
  const div = document.createElement("div");
  div.innerHTML = dom;
  const children: HTMLElement[] = [];
  for (const child of div.children) {
    children.push(child as HTMLElement);
  }
  return children;
}

const missingThumbnailTags = new Set<String>(["self", "nsfw", "default", "image", "spoiler"]);
function renderMedia(post: Post): HTMLElement[] {
  const postsWidth = document.querySelector(".posts")!.clientWidth - 32; // account for padding in post
  const thumbnailUrl = ""; // post.data.thumbnail.includes("://") ? post.data.thumbnail : "";

  if (post.data.is_self) {
    return dom(`<div class="post-self-preview">${htmlDecode(post.data.selftext_html)}</div>`);
  }

  if (post.data.is_gallery && post.data.media_metadata) {
    type image = { x: number; y: number; u: string };
    const images: image[] = [];
    for (const imageKey of Object.keys(post.data.media_metadata)) {
      if (post.data.media_metadata[imageKey].p) {
        let image: image | null = null;
        for (const img of post.data.media_metadata[imageKey].p) {
          image = img;
          if (img.x > postsWidth) break;
        }
        if (image) images.push(image);
      }
    }
    const galleryDom = dom(
      `<div class="post-media post-image-gallery">${images
        .map((img, index) => `<img src="${img.u}" ${index > 0 ? 'class="hidden"' : ""}>`)
        .join("")}</div><div class="post-image-gallery-count">Gallery (${images.length})</div>`
    );
    const imagesDom = galleryDom[0].querySelectorAll("img");
    const imageClickListener = () => {
      let scrolled = false;
      imagesDom.forEach((img, index) => {
        if (index == 0) return;
        if (img.classList.contains("hidden")) {
          img.classList.remove("hidden");
        } else {
          img.classList.add("hidden");
          if (scrolled) return;
          scrolled = true;
          if (imagesDom[0].getBoundingClientRect().top < 16 * 4) {
            window.scrollTo({ top: imagesDom[0].getBoundingClientRect().top + window.pageYOffset - 16 * 3 });
          }
        }
      });
    };
    for (const imageDom of imagesDom) {
      imageDom.addEventListener("click", imageClickListener);
    }
    galleryDom[1].addEventListener("click", imageClickListener);
    return galleryDom;
  }

  if (post.data.secure_media && post.data.secure_media.reddit_video) {
    return dom(renderVideoTag(post.data.secure_media.reddit_video, postsWidth, thumbnailUrl));
  }

  if (post.data.secure_media_embed && post.data.secure_media_embed.media_domain_url) {
    const embed = post.data.secure_media_embed;
    const embedWidth = postsWidth;
    const embedHeight = Math.floor((embed.height / embed.width) * embedWidth);
    if (embed.content.includes("iframe")) {
      const embedUrl = htmlDecode(
        embed.content
          .replace(`width="${embed.width}"`, `width="${embedWidth}"`)
          .replace(`height="${embed.height}"`, `height="${embedHeight}"`)
          .replace("position:absolute;", "")
      );
      return dom(`<div class="post-media" style="width: ${embedWidth}px; height: ${embedHeight}px;">${embedUrl}</div>`);
    } else {
      return dom(
        `<div class="post-media" style="width: ${embedWidth}px; height: ${embedHeight}px;"><iframe width="${embedWidth}" height="${embedHeight}" src="${embed.media_domain_url}"></iframe></div>`
      );
    }
  }

  if (post.data.url.endsWith(".gif")) {
    return dom(`<div class="post-media"><img src="${post.data.url}"></img></div>`);
  }

  if (post.data.preview && post.data.preview.images && post.data.preview.images.length > 0) {
    let image: { url: string; width: number; height: number } | null = null;
    for (const img of post.data.preview.images[0].resolutions) {
      image = img;
      if (img.width > postsWidth) break;
    }
    if (!image) return [document.createElement("div")];
    if (!post.data.preview.reddit_video_preview?.fallback_url) return dom(`<div class="post-media"><img src="${image.url}"></img></div>`);
    return dom(renderVideoTag(post.data.preview.reddit_video_preview, postsWidth, thumbnailUrl));
  }

  if (post.data.thumbnail && !missingThumbnailTags.has(post.data.thumbnail)) {
    return dom(`<div class="post-media"><img src="${post.data.thumbnail}"></img></div>`);
  }
  return [document.createElement("div")];
}

function renderVideoTag(
  embed: { width: number; height: number; dash_url: string | null; hls_url: string | null; fallback_url: string },
  postsWidth: number,
  thumbnail: string
) {
  const embedWidth = postsWidth;
  const embedHeight = Math.floor((embed.height / embed.width) * postsWidth);
  return `<div class="post-media">
      <video-js controls fluid class="video-js" style="width: 100%;" loop data-setup="{}">
          ${embed.dash_url ? `<source src="${embed.dash_url}"></source>` : ""}
          ${embed.hls_url ? `<source src="${embed.hls_url}"></source>` : ""}
          <source src="${embed.fallback_url}"></source>
      </video-js>
    </div>`;
}

async function renderComments(post: Post, container: HTMLElement) {
  const loadingDiv = document.createElement("div");
  loadingDiv.innerHTML = svgLoader;
  container.append(loadingDiv);

  try {
    const commentsData = await getComments(post);
    if (!commentsData) return;
    for (const comment of commentsData.data.children) {
      renderComment(comment, 0, container);
    }
  } finally {
    loadingDiv.remove();
  }
}

function renderComment(comment: Comment, level: number, container: HTMLElement) {
  if (comment.data.author == undefined) return;
  const commentDiv = document.createElement("div");
  commentDiv.innerHTML = `
        <div class="comment-meta">
            <span class="comment-author"><a href="https://www.reddit.com/u/${comment.data.author}" target="_blank">${comment.data.author}</a></span>
            <span class="comment-data">${dateToText(comment.data.created_utc * 1000)}</span>
            <span class="comment-points">${comment.data.score} pts</span>
            <a class="comment-reply" href="https://www.reddit.com/${comment.data.permalink}" target="_blank">Reply</a>
        </div>
        <div class="comment-text">
            ${htmlDecode(comment.data.body_html)}
        </div>
        <div class="comment-replies"></div>
        <div class="comment-replies-count hidden"></div>
    `;
  commentDiv.classList.add("comment");
  container.append(commentDiv);
  const text = commentDiv.querySelector(".comment-text")! as HTMLElement;
  for (const link of text.querySelectorAll("a")) {
    link.setAttribute("target", "_blank");
  }
  const replies = commentDiv.querySelector(".comment-replies")! as HTMLElement;
  const repliesCount = commentDiv.querySelector(".comment-replies-count") as HTMLElement;
  if (comment.data.replies && (comment.data.replies as any) != "") {
    for (const reply of comment.data.replies.data.children) {
      renderComment(reply, level + 1, replies);
    }
    const numReplies = comment.data.replies.data.children.length;
    repliesCount.innerText = `${numReplies == 1 ? "1 reply" : numReplies + " replies"}`;
    text.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).tagName != "A") {
        event.stopPropagation();
        event.preventDefault();
        if (replies.classList.contains("hidden")) {
          replies.classList.remove("hidden");
          repliesCount.classList.add("hidden");
        } else {
          replies.classList.add("hidden");
          repliesCount.classList.remove("hidden");
        }
      }
    });
  }
}

function renderPost(post: Post) {
  let postDiv = document.createElement("div");
  postDiv.classList.add("post");
  postDiv.innerHTML = `
        <div class="post-title"><a href="${post.data.url}" target="_blank">${post.data.title}</a></div>
        <div class="post-meta">
            <span class="post-points">${post.data.score} pts</span>
            ${
              getSubreddit().toLowerCase() != post.data.subreddit.toLowerCase()
                ? `<span class="post-subreddit"><a href="https://www.reddit.com/r/${post.data.subreddit}" target="_blank">r/${post.data.subreddit}</a></span>`
                : ""
            }
            <span class="post-date">${dateToText(post.data.created_utc * 1000)}</span>
            <span class="post-author">by <a href="https://www.reddit.com/u/${post.data.author}" target="_blank">${post.data.author}</a></span>
        </div>
        ${
          !post.data.is_self &&
          !post.data.url.includes("v.redd.it") &&
          !post.data.url.includes("i.redd.it") &&
          !post.data.url.includes("www.reddit.com")
            ? `<div class="post-url"><a href="">${
                new URL(post.data.url.startsWith("/r/") ? "https://www.reddit.com" + post.data.url : post.data.url).host
              }</a></div>`
            : ""
        }
        <div class="post-media-container"></div>
        <div class="post-comments"><a href="">Comments (${post.data.num_comments})</a></div>
        <div class="post-comments-full"></div>
    `;
  const comments = postDiv.querySelector(".post-comments")!;
  const mediaContainer = postDiv.querySelector(".post-media-container");
  for (const media of renderMedia(post)) {
    postDiv.insertBefore(media, mediaContainer);
  }
  mediaContainer?.remove();

  // Expand self posts on click
  postDiv.querySelector(".post-self-preview")?.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).tagName != "A") {
      (postDiv.querySelector(".post-self-preview") as HTMLElement).style.maxHeight = "100%";
      (postDiv.querySelector(".post-self-preview") as HTMLElement).style.color = "var(--ledit-color)";
    }
  });

  // Render comments on click
  let isLoading = false;
  let savedTop = 0;
  comments.addEventListener("click", async (event) => {
    event.preventDefault();
    if (comments.classList.contains("post-comments-sticky")) {
      isLoading = false;
      comments.classList.remove("post-comments-sticky");
      (postDiv.querySelector(".post-comments-full")! as HTMLElement).innerHTML = "";
      if (comments.getBoundingClientRect().top < 16 * 4) {
        window.scrollTo({ top: comments.getBoundingClientRect().top + window.pageYOffset - 16 * 3 });
      }
    } else {
      savedTop = window.pageYOffset;
      if (isLoading) return;
      isLoading = true;
      if (postDiv.querySelector(".post-self-preview")) {
        (postDiv.querySelector(".post-self-preview") as HTMLElement).style.maxHeight = "100%";
        (postDiv.querySelector(".post-self-preview") as HTMLElement).style.color = "var(--ledit-color)";
      }
      await renderComments(post, postDiv.querySelector(".post-comments-full")! as HTMLElement);
      comments.classList.add("post-comments-sticky");
    }
  });
  return postDiv;
}

function showLoading() {
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "loading";
  loadingDiv.classList.add("post-loading");
  loadingDiv.innerHTML = svgLoader;
  const postsDiv = document.querySelector(".posts");
  postsDiv?.appendChild(loadingDiv);
  return loadingDiv;
}

function showError(error: string, e: any) {
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "error";
  loadingDiv.classList.add("post-error");
  loadingDiv.innerText = error;
  const postsDiv = document.querySelector(".posts");
  postsDiv?.appendChild(loadingDiv);
  if (e.stack) console.log(e.stack);
  else if (e.toString) console.log(e.toString());
  return loadingDiv;
}

async function load() {
  renderHeader();
  let loadingDiv = showLoading();
  loadingDiv.innerHTML = svgLoader;
  try {
    let result = await queryReddit();
    renderPosts(result);
  } catch (e) {
    showError("Could not load r/" + getSubreddit(), e);
  } finally {
    loadingDiv.remove();
  }
}

window.addEventListener("hashchange", () => {
  window.location.reload();
});

let settings = getSettings();
document.body.classList.remove("dark-theme");
document.body.classList.remove("light-theme");
document.body.classList.add(settings.theme.toLowerCase() + "-theme");
load();
