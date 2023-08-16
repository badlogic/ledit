// @ts-ignore
import "./post-editor.css";
import { svgClose, svgImages, svgLoader } from "./svg";
import { escapeGuard, navigationGuard, onAddedToDOM } from "./utils";
import { View } from "./view";

export class PostEditor extends View {
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
   }

   render() {
      this.innerHTML = /*html*/ `
      <div x-id="container" class="post-editor-container">
          <div x-id="editor" class="post-editor">
            <div x-id="close" class="post-editor-close"><span class="svg-icon color-fill">${svgClose}</span></div>
            <div x-id="headerRow" class="post-editor-header"></div>
            <textarea x-id="text" class="post-editor-textarea"></textarea>
            <div class="post-editor-buttons">
               <button x-id="addMedia" class="post-editor-button svgIcon color-fill" style="font-size: var(--ledit-font-size-big)">${svgImages}</button>
               <div x-id="charCount" style="margin-left: auto">${this.text?.length ?? 0}/${this.maxChars}</div>
               <button x-id="publish" class="post-editor-button">Publish</button>
               <div x-id="progress" class="svgIcon color-fill hidden">${svgLoader}</div>
            </div>
         </div>
      </div>
      `;

      const elements = this.elements<{
         container: Element;
         editor: Element;
         headerRow: Element
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
         elements.charCount.innerHTML = `<span ${maxCharsExceeded ? `style="color: red;"` : ""}>${elements.text.value.length}/${this.maxChars}</span>`
         if (maxCharsExceeded) {
            elements.publish.setAttribute("disabled", "");
         } else {
            elements.publish.removeAttribute("disabled");
         }
      })

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
      elements.container.addEventListener("click", () => {
         this.close();
      });

      // Close when close button is clicked
      elements.close.addEventListener("click", () => {
         this.close();
      });

      // Close when escape is pressed
      escapeGuard.push();
      escapeGuard.registerCallback(() => {
         this.close();
         escapeGuard.pop();
      })

      // Close on back navigation
      const navListener = () => {
         navigationGuard.removeCallback(navListener);
         this.close();
         return false;
      };
      navigationGuard.push();
      navigationGuard.registerCallback(navListener);

      // Prevent underlying posts from scrolling
      elements.container.addEventListener("wheel", (event) => {
         if ((event.target as HTMLElement).classList.contains("post-editor-container")) {
            event.preventDefault();
            event.stopPropagation();
            this.scrollTop -= (event as any).deltaY;
         }
      });
   }

   close() {
      this.remove();
      navigationGuard.pop();
   }
}
customElements.define("ledit-post-editor", PostEditor);
