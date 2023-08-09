import "video.js/dist/video-js.min.css";
import videojs from "video.js";
import Player from "video.js/dist/types/player";

import "./media.css";
import { Post } from "./reddit";
import { dom, htmlDecode, intersectsViewport, onAddedToDOM, onTapped } from "./utils";
import { View } from "./view";

export class MediaView extends View {
   constructor(private readonly post: Post) {
      super();
      this.render();
   }

   render() {
      const mediaElements = MediaView.renderMedia(this.post);
      for (const mediaElement of mediaElements) {
         this.append(mediaElement);
      }
   }

   static renderMedia(post: Post): Element[] {
      const postsWidth = document.querySelector(".posts")!.clientWidth; // account for padding in post

      // Self post, show text, dim it, cap vertical size, and make it expand on click.
      if (post.data.is_self) {
         let selfPost = dom(`<div class="post-self-preview">${htmlDecode(post.data.selftext_html)}</div>`)[0];
         selfPost.addEventListener("click", (event) => {
            if ((event.target as HTMLElement).tagName != "A") {
              selfPost.style.maxHeight = "100%";
              selfPost.style.color = "var(--ledit-color)";
            }
          });
          return [selfPost];
      }

      // Gallery
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
         const galleryDom = dom(/*html*/ `
            <div class="media-image-gallery">
               ${images.map((img, index) => `<img src="${img.u}" ${index > 0 ? 'class="hidden"' : ""}>`).join("")}
            </div>
         `);
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
         for (let i = 0; i < imagesDom.length; i++) {
            imagesDom[i].addEventListener("click", imageClickListener);
         }
         return galleryDom;
      }

      // Reddit hosted video
      if (post.data.secure_media && post.data.secure_media.reddit_video) {
         return [MediaView.renderVideo(post.data.secure_media.reddit_video)];
      }

      // External embed like YouTube Vimeo
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
            let embedDom = dom(`<div class="media" style="width: ${embedWidth}px; height: ${embedHeight}px;">${embedUrl}</div>`)[0];
            // Make YouTube videos stop if they scroll out of frame.
            if (embed.content.includes("youtube")) {
               // Pause when out of view
               document.addEventListener("scroll", () => {
                  const videoElement = embedDom.querySelector("iframe");
                  if (videoElement && !intersectsViewport(videoElement)) {
                     videoElement.contentWindow?.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*')
                  }
            });
            return [embedDom];
            }
         } else {
            return dom(
               `<div class="media" style="width: ${embedWidth}px; height: ${embedHeight}px;"><iframe width="${embedWidth}" height="${embedHeight}" src="${embed.media_domain_url}"></iframe></div>`
            );
         }
      }

      // Plain old .gif
      if (post.data.url.endsWith(".gif")) {
         return dom(`<div class="media"><img src="${post.data.url}"></img></div>`);
      }

      // Image, pick the one that's one size above the current posts width so pinch zooming
      // in shows more pixels.
      if (post.data.preview && post.data.preview.images && post.data.preview.images.length > 0) {
         let image: { url: string; width: number; height: number } | null = null;
         for (const img of post.data.preview.images[0].resolutions) {
            image = img;
            if (img.width > postsWidth) break;
         }
         if (!image) return [document.createElement("div")];
         if (!post.data.preview.reddit_video_preview?.fallback_url) return dom(`<div class="media"><img src="${image.url}"></img></div>`);
         return [MediaView.renderVideo(post.data.preview.reddit_video_preview)];
      }

      // Fallback to thumbnail which is super low-res.
      const missingThumbnailTags = new Set<String>(["self", "nsfw", "default", "image", "spoiler"]);
      const thumbnailUrl = post.data.thumbnail.includes("://") ? post.data.thumbnail : "";
      if (post.data.thumbnail && !missingThumbnailTags.has(post.data.thumbnail)) {
         return dom(`<div class="media"><img src="${thumbnailUrl}"></img></div>`);
      }
      return [document.createElement("div")];
   }

   static renderVideo(embed: { width: number; height: number; dash_url: string | null; hls_url: string | null; fallback_url: string }): Element {
      let videoDom = dom(/*html*/ `<div class="media">
          <video-js controls fluid class="video-js" style="width: 100%;" loop data-setup="{}">
              <source src="${embed.dash_url}">
              <source src="${embed.hls_url}">
              <source src="${embed.fallback_url}">
          </video-js>
        </div>`)[0];
      onAddedToDOM(videoDom, () => {
         const videoDiv = videoDom.querySelector("video-js");
         if (videoDiv) {
            const video = videojs(videoDiv);
            var videoElement = video.el().querySelector("video")!;

            // Toggle pause/play on click
            const togglePlay = function () {
               if (video.paused()) {
                  video.play();
               } else {
                  video.pause();
               }
            };
            videoElement.addEventListener("clicked", togglePlay);
            onTapped(videoElement, togglePlay);

            // Pause when out of view
            document.addEventListener("scroll", () => {
                 if (videoElement && videoElement === document.pictureInPictureElement) {
                   return;
                 }
                 if (!video.paused() && !intersectsViewport(videoElement)) {
                   video.pause();
                 }
             });
         }
      });
      return videoDom;
   }
}

customElements.define("ledit-media", MediaView);


