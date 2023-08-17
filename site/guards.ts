import { getSource } from "./data";

class BaseGuard<T> {
   private callbacks: { [zIndex: number]: T[] } = {};

   register(zIndex: number, callback: T): T {
      if (!this.callbacks[zIndex]) {
         this.callbacks[zIndex] = [];
      }
      this.callbacks[zIndex].push(callback);
      return callback;
   }

   remove(callback: T | undefined) {
      if (!callback) return;
      for (const zIndex in this.callbacks) {
         this.callbacks[zIndex] = this.callbacks[zIndex].filter((cb) => cb !== callback);
         if (this.callbacks[zIndex].length == 0) {
            delete this.callbacks[zIndex];
         }
      }
   }

   protected getTop(): T[] {
      const topZIndex = this.getTopZIndex();
      const topCallbacks: T[] = [];
      if (topZIndex >= 0) {
         topCallbacks.push(...this.callbacks[topZIndex]);
      }
      return topCallbacks;
   }

   protected getTopZIndex(): number {
      const zIndices = Object.keys(this.callbacks)
         .map(Number)
         .sort((a, b) => b - a);
      if (zIndices.length == 0) return -1;
      return zIndices[0];
   }

   protected getZIndices() {
      return Object.keys(this.callbacks)
         .map(Number)
         .sort((a, b) => b - a);
   }
}

export type NavigationCallback = () => boolean;

class NavigationGuard extends BaseGuard<NavigationCallback> {
   private statePushed: { [zIndex: number]: boolean } = {};
   private preventDefault = false;

   constructor() {
      super();
      history.scrollRestoration = "manual";
      history.pushState(-1, "");
		history.pushState(0, "");
      let state = 0;
      window.addEventListener('popstate', (event: PopStateEvent) => {
         console.log(history.state);
			if(state = event.state){
            console.log(`Going ${state > 0 ? 'next' : 'previous'}`)
            if (!this.canNavigateBack()) {
               history.go(1);
            } else {
               history.go(-2);
            }
			}
		});
   }

   canNavigateBack(): boolean {
      const callbacks = this.getTop();
      let canNavigate = true;
      for (const callback of callbacks) {
         if (!callback()) {
            canNavigate = false;
         }
      }
      return canNavigate;
   }
}

export const navigationGuard = new NavigationGuard();

export type EscapeCallback = () => void;

export class EscapeGuard extends BaseGuard<EscapeCallback> {
   private listener;

   constructor() {
      super();
      this.listener = this.handleEscape.bind(this);
      document.addEventListener("keydown", this.listener);
   }

   private handleEscape(event: KeyboardEvent): void {
      if (event.keyCode == 27 || event.key == "Escape") {
         const callbacks = [...this.getTop()];
         for (const callback of callbacks) {
            callback();
         }
      }
   }
}

export const escapeGuard = new EscapeGuard();
