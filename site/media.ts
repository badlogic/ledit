import "./media.css";
import { View } from "./view";
import { Post, getSource } from "./data";

export class MediaView extends View {
   constructor(private readonly post: Post) {
      super();
      this.render();
   }

   render() {
      const source = getSource();
      const mediaElements = source.getMediaDom(this.post);
      for (const mediaElement of mediaElements) {
         this.append(mediaElement);
      }
   }
}

customElements.define("ledit-media", MediaView);
