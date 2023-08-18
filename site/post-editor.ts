import { EscapeCallback, NavigationCallback, escapeGuard, navigationGuard } from "./guards";
import { svgClose, svgImages, svgLoader } from "./svg";
import { onAddedToDOM } from "./utils";
import { View } from "./view";

export class PostEditor extends View {
   escapeCallback: EscapeCallback | undefined;
   navigationCallback: NavigationCallback | undefined;

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
      this.render();
      this.classList.add("editor-container");
   }

   render() {
      this.innerHTML = /*html*/ `
          <div x-id="editor" class="editor">
            <div x-id="close" class="editor-close"><span class="svg-icon color-fill">${svgClose}</span></div>
            <div x-id="headerRow" class="editor-header"></div>
            <textarea x-id="text"></textarea>
            <div class="editor-buttons">
               <button x-id="addMedia" class="editor-button svgIcon color-fill" style="font-size: var(--ledit-font-size-big)">${svgImages}</button>
               <div x-id="charCount" style="margin-left: auto">${this.text?.length ?? 0}/${this.maxChars}</div>
               <button x-id="publish" class="editor-button">Publish</button>
               <div x-id="progress" class="svgIcon color-fill hidden">${svgLoader}</div>
            </div>
         </div>
      `;

      const elements = this.elements<{
         editor: Element;
         headerRow: Element;
         close: Element;
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

      // Prevent clicking in input elements to dismiss editor
      elements.editor.addEventListener("click", (event: Event) => {
         event.stopPropagation();
      });

      // Close when container is clicked
      this.addEventListener("click", () => {
         this.close();
      });

      // Close when close button is clicked
      elements.close.addEventListener("click", () => {
         this.close();
      });

      // Close when escape is pressed
      this.escapeCallback = escapeGuard.register(1000, () => {
         this.close();
      });

      // Close on back navigation
      this.navigationCallback = navigationGuard.register(1000, () => {
         this.close();
         return false;
      });

      // Prevent underlying posts from scrolling
      document.body.style.overflow = "hidden";
   }

   close() {
      this.remove();
      escapeGuard.remove(this.escapeCallback!);
      navigationGuard.remove(this.navigationCallback!);
      document.body.style.overflow = "";
   }
}
customElements.define("ledit-post-editor", PostEditor);
