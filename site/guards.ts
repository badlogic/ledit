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
      const zIndices = Object.keys(this.callbacks)
         .map(Number)
         .sort((a, b) => b - a);
      const topCallbacks: T[] = [];

      if (zIndices.length != 0) {
         topCallbacks.push(...this.callbacks[zIndices[0]]);
      }
      return topCallbacks;
   }
}

export type NavigationCallback = () => boolean;

class NavigationGuard extends BaseGuard<NavigationCallback> {
   private stack: NavigationCallback[][] = [[]];
   private listener;
   private statePushed = false;

   constructor() {
      super();
      history.scrollRestoration = "manual";
      this.listener = this.handlePopState.bind(this);
      window.addEventListener("popstate", this.listener);
   }

   register(zIndex: number, callback: NavigationCallback): NavigationCallback {
      super.register(zIndex, callback);
      if (!this.statePushed) {
         this.statePushed = true;
         history.pushState({}, "", null);
      }
      return callback;
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

   private handlePopState(event: PopStateEvent): void {
      if (!this.canNavigateBack()) {
         event.preventDefault();
         history.forward();
      } else {
         //
      }
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
