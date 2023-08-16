import "./content.css";
import { View } from "./view";
import { Post, getSource } from "./data";

export class ContentView extends View {
   public readonly toggles: Element[] = [];
   constructor(private readonly post: Post) {
      super();
      this.render();
   }

   render() {
      const source = getSource();
      const content = source.getContentDom(this.post);
      for (const element of content.elements) {
         this.append(element);
      }
      this.toggles.push(...content.toggles);

      // Ensure all links open a new tab.
      let links = this.querySelectorAll("a")!;
      for (let i = 0; i < links.length; i++) {
         let link = links[i];
         link.setAttribute("target", "_blank");
      }
   }
}

customElements.define("ledit-content", ContentView);
