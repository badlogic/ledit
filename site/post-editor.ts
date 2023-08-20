import { svgImages, svgLoader } from "./svg";
import { dom, onAddedToDOM } from "./utils";
import { OverlayView } from "./view";

export class PostEditor extends OverlayView {
   constructor(
      public readonly header: Element,
      public readonly text: string | null,
      public readonly placeholder: string,
      public readonly maxChars: number,
      public readonly allowMedia: boolean,
      public readonly onSave: (text: string) => Promise<boolean>,
      public readonly onMediaAdded: (name: string, bytes: ArrayBuffer) => void,
      public readonly onMediaRemoved: (name: string) => void
   ) {
      super();
      this.renderContent();
   }

   renderContent() {
      const editorDom = dom(/*html*/ `
         <div x-id="headerRow"></div>
         <textarea x-id="text"></textarea>
         <div class="overlay-buttons">
            <button x-id="addMedia" class="overlay-button color-fill" style="font-size: var(--ledit-font-size-big)">${svgImages}</button>
            <div x-id="charCount" style="margin-left: auto; font-size: var(--ledit-font-size-small)">${this.text?.length ?? 0}/${this.maxChars}</div>
            <button x-id="publish" class="overlay-button">Publish</button>
            <div x-id="progress" class="color-fill hidden">${svgLoader}</div>
         </div>
      `);
      this.content.style.gap = "0.5em";
      this.content.append(...editorDom);

      const elements = this.elements<{
         headerRow: Element;
         text: HTMLTextAreaElement;
         charCount: Element;
         publish: Element;
         progress: Element;
      }>();

      elements.headerRow.append(this.header);
      elements.text.value = this.text ?? "";
      elements.text.placeholder = this.placeholder;
      onAddedToDOM(elements.text, () => elements.text.focus());

      // Update char count and disable publish button if necessary
      elements.text.addEventListener("input", (event) => {
         const maxCharsExceeded = elements.text.value.length > this.maxChars;
         elements.charCount.innerHTML = `<span ${maxCharsExceeded ? `style="color: red;"` : ""}>${elements.text.value.length}/${
            this.maxChars
         }</span>`;
         if (maxCharsExceeded) {
            elements.publish.setAttribute("disabled", "");
         } else {
            elements.publish.removeAttribute("disabled");
         }
      });

      // Publish
      elements.publish.addEventListener("click", async (event) => {
         event.stopPropagation();
         event.stopImmediatePropagation();
         event.preventDefault();
         const text = elements.text.value.trim();
         if (text.length == 0) {
            alert("Please add some text to your post.");
            return;
         }

         elements.text.setAttribute("disabled", "");
         elements.publish.setAttribute("disabled", "");
         elements.progress.classList.remove("hidden");
         const success = await this.onSave(text);
         if (!success) {
            alert("Something went wrong.");
            elements.text.removeAttribute("disabled");
            elements.publish.removeAttribute("disabled");
            elements.progress.classList.add("hidden");
         } else {
            this.close();
         }
      });
   }
}
customElements.define("ledit-post-editor", PostEditor);
