class BaseGuard<T> {
   protected callbacks: T[] = [];

   register(callback: T): T {
      this.callbacks.push(callback);
      return callback;
   }

   remove(callback: T | undefined) {
      if (!callback) return;
      this.callbacks = this.callbacks.filter((cb) => cb !== callback);
   }

   protected getTop(): T | undefined {
      return this.callbacks[this.callbacks.length - 1];
   }
}

export type NavigationCallback = () => void;

class NavigationGuard extends BaseGuard<NavigationCallback> {
   private popStateListener;
   private inPopState = false;
   call = true;
   private lastLocation = "";

   constructor() {
      super();
      history.scrollRestoration = "manual";

      this.popStateListener = (event: PopStateEvent) => {
         this.inPopState = true;
         console.log(window.history.state + ", " + event.state);
         if (location.href != this.lastLocation) {
            if (this.call) {
               const callback = this.getTop();
               if (callback) callback();
            } else {
               this.call = true;
            }
         }
         this.inPopState = false;
      };
      window.addEventListener("popstate", this.popStateListener);
   }

   counter = 0;
   register(callback: NavigationCallback): NavigationCallback {
      this.lastLocation = location.href;
      window.history.replaceState(this.counter++, "", null);
      const result = super.register(callback);
      return result;
   }

   remove(callback: NavigationCallback) {
      super.remove(callback);
      this.counter--;
      if (!this.inPopState) {
         this.call = false;
         history.back();
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
         const callback = this.getTop();
         if (callback) callback();
      }
   }
}

export const escapeGuard = new EscapeGuard();
