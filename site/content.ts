import "./content.css";
import { View } from "./view";
import { Post, getSource } from "./data";

export class ContentView extends View {
   public readonly toggles: Element[] = [];
   constructor(private readonly post: Post<any>) {
      super();
      this.classList.add("content");
      this.render();
   }

   render() {
      const source = getSource();
      const content = source.getContentDom(this.post);
      content.elements.forEach((element) => element.querySelectorAll("script").forEach((script) => script.remove()));
      for (const element of content.elements) {
         this.append(element);
      }
      this.toggles.push(...content.toggles);
   }
}

customElements.define("ledit-content", ContentView);
