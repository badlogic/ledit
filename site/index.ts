import { Post, Comment, Posts, dateToText, getComments, getSubreddit, htmlDecode, onVisibleOnce, queryReddit, scrollToElement } from "./utils";

function renderHeader() {
  const header = document.querySelector("#header-subreddit")!;
  header.innerHTML = "/r/" + getSubreddit();
  const input = document.querySelector("#header-input") as HTMLInputElement;
  header.addEventListener("click", () => {
    header.classList.add("hidden");
    input.classList.remove("hidden");
    input.value = getSubreddit();
    input.focus();
    input.select();
    input.addEventListener("keypress", function (event) {
      if (event.keyCode === 13 || event.which === 13) {
        event.preventDefault();
        window.location.hash = input.value;
        header.classList.remove("hidden");
        input.classList.add("hidden");
      }
    });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      header.classList.remove("hidden");
      input.classList.add("hidden");
    }
  });
}

function renderPosts(listing: Posts) {
  const posts = document.querySelector("#posts")! as HTMLElement;
  if ((!listing || !listing.data || !listing.data.children) && posts.children.length == 0) {
    const div = document.createElement("div");
    div.innerHTML = `Subreddit ${getSubreddit()} doesn't exist.`
    posts.append(div);
    return;
  }

  for (let i = 0; i < listing.data.children.length; i++) {
    const post = listing.data.children[i];
    const postDiv = renderPost(post);
    posts.append(postDiv);
  }

  const loadingDiv = showLoading();
  onVisibleOnce(loadingDiv, async () => {
    try {
      const result = await queryReddit(listing.data.after);
      renderPosts(result);
    } catch (e) {
      alert(JSON.stringify(e, null, 2));
    } finally {
      hideLoading();
    }
  });
}

const missingThumbnailTags = new Set<String>(["self", "nsfw", "default", "image", "spoiler"]);
function renderMedia(post: Post) {
  if (post.data.is_self) {
    return `<div class="post-self-preview">${htmlDecode(post.data.selftext_html)}</div>`;
  }

  if (post.data.secure_media && post.data.secure_media.reddit_video) {
    const embed = post.data.secure_media.reddit_video;
    const postsWidth = document.querySelector("#posts")!.clientWidth;
    const embedWidth = postsWidth;
    const embedHeight = Math.floor((embed.height / embed.width) * postsWidth);
    return `<div class="post-media"><video src="${embed.fallback_url}" controls loop></img></div>`;
  }

  if (post.data.secure_media_embed && post.data.secure_media_embed.media_domain_url) {
    const embed = post.data.secure_media_embed;
    const postsWidth = document.querySelector("#posts")!.clientWidth;
    const embedWidth = postsWidth;
    const embedHeight = Math.floor((embed.height / embed.width) * postsWidth);
    if (embed.content.includes("iframe")) {
      const embedUrl = htmlDecode(
        embed.content
          .replace(`width="${embed.width}"`, `width="${embedWidth}"`)
          .replace(`height="${embed.height}"`, `height="${embedHeight}"`)
          .replace("position:absolute;", "")
      );
      return `<div class="post-media" style="width: ${embedWidth}px; height: ${embedHeight}px;">${embedUrl}</div>`;
    } else {
      return `<div class="post-media" style="width: ${embedWidth}px; height: ${embedHeight}px;"><iframe width="${embedWidth}" height="${embedHeight}" src="${embed.media_domain_url}"></iframe></div>`;
    }
  }

  if (post.data.url.endsWith(".gif")) {
    return `<div class="post-media"><img src="${post.data.url}"></img></div>`;
  }

  if (post.data.preview && post.data.preview.images && post.data.preview.images.length > 0) {
    const postsWidth = document.querySelector("#posts")!.clientWidth;
    let image: { url: string; width: number; height: number } | null = null;
    let bestWidth = 10000000;
    for (const img of post.data.preview.images[0].resolutions) {
      if (!image) {
        image = img;
        bestWidth = Math.abs(postsWidth - image.width);
      } else {
        const width = Math.abs(postsWidth - img.width);
        if (width < bestWidth) {
          image = img;
          bestWidth = width;
        }
      }
    }
    if (!image) return "";
    if (!post.data.preview.reddit_video_preview?.fallback_url) return `<div class="post-media"><img src="${image.url}"></img></div>`;
    return `<div class="post-media"><video src="${post.data.preview.reddit_video_preview.fallback_url}" controls loop></img></div>`;
  }

  if (post.data.thumbnail && !missingThumbnailTags.has(post.data.thumbnail)) {
    return `<div class="post-media"><img src="${post.data.thumbnail}"></img></div>`;
  }
  return "";
}

async function renderComments(post: Post, container: HTMLElement) {
  const loadingDiv = document.createElement("div");
  loadingDiv.innerHTML = "Loading comments";
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
            <span class="comment-author"><a href="https://www.reddit.com/u/${comment.data.author}">${comment.data.author}</a></span>
            <span class="comment-data">${dateToText(comment.data.created_utc * 1000)}</span>
            <span class="comment-points">${comment.data.score} pts</span>
        </div>
        <div class="comment-text">
            ${htmlDecode(comment.data.body_html)}
        </div>
        <div class="comment-reply"><a href="https://www.reddit.com/${comment.data.permalink}" target="_blank">Reply</a></div>
    `;
  commentDiv.classList.add("comment");
  commentDiv.style.marginLeft = level * 0.5 + "em";
  container.append(commentDiv);
  if (comment.data.replies && (comment.data.replies as any) != "") {
    for (const reply of comment.data.replies.data.children) {
      renderComment(reply, level + 1, container);
    }
  }
}

function renderPost(post: Post) {
  let entryDiv = document.createElement("div");
  entryDiv.classList.add("post");
  entryDiv.innerHTML = `
        <div class="post-title"><a href="${post.data.url}" target="_blank">${post.data.title}</a></div>
        <div class="post-meta">
            <span class="post-points">${post.data.score} pts</span>
            <span class="post-date">${dateToText(post.data.created_utc * 1000)}</span>
            <span class="post-author">by <a href="https://www.reddit.com/u/${post.data.author}" target="_blank">${post.data.author}</a></span>
            <span class="post-author">in <a href="https://www.reddit.com/r/${post.data.subreddit}" target="_blank">r/${post.data.subreddit}</a></span>
        </div>
        ${!post.data.is_self ? `<div class="post-url"><a href="">${new URL(post.data.url).host}</a></div>` : ""}
        ${renderMedia(post)}
        <div class="post-comments"><a href="">Comments (${post.data.num_comments})</a></div>
        <div class="post-comments-full"></div>
    `;
  const comments = entryDiv.querySelector(".post-comments")!;
  let isLoading = false;
  comments.addEventListener("click", async (event) => {
    event.preventDefault();
    if (comments.classList.contains("sticky")) {
      isLoading = false;
      comments.classList.remove("sticky");
      (entryDiv.querySelector(".post-comments-full")! as HTMLElement).innerHTML = "";
      requestAnimationFrame(() => {
        scrollToElement(comments, document.querySelector("#posts") as Element);
      });
    } else {
      if (isLoading) return;
      isLoading = true;
      if (entryDiv.querySelector(".post-self-preview")) {
        (entryDiv.querySelector(".post-self-preview") as HTMLElement).style.maxHeight = "100%";
      }
      await renderComments(post, entryDiv.querySelector(".post-comments-full")! as HTMLElement);
      comments.classList.add("sticky");
    }
  });
  return entryDiv;
}

function showLoading() {
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "loading";
  loadingDiv.classList.add("post-loading");
  const subreddit = "/r/" + getSubreddit();
  loadingDiv.innerText = `Loading ${subreddit}`;
  const postsDiv = document.querySelector("#posts");
  postsDiv?.appendChild(loadingDiv);
  return loadingDiv;
}

function hideLoading() {
  document.querySelector("#loading")?.remove();
}

async function load() {
  renderHeader();
  showLoading();
  let result = await queryReddit();
  hideLoading();
  renderPosts(result);
}

window.addEventListener("hashchange", () => {
  document.querySelector("#posts")!.innerHTML = "";
  load();
});

load();
