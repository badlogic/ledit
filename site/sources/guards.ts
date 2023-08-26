class BaseGuard<T> {
   private callbacks: T[] = [];

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

export type NavigationCallback = () => boolean;

type NavigationState = { hash: string; guardId: number; navStackIndex: number };

class NavigationGuard extends BaseGuard<{ hash: string | null; callback: NavigationCallback }> {
   private guardId = 0;
   private navStack: NavigationState[] = [];
   private popStateListener;
   private inPopState = false;
   private call = true;

   constructor() {
      super();
      // FIXME forward navigation is broken
      // when we forward navigate, the initial state is wrong as the hash
      // may contain overlay fragments, e.g. mario@mastodon.com/notifications.
      // when the state is popped, the fragment doesn't change from notifications,
      // even though the overlay gets dismissed.
      history.scrollRestoration = "manual";
      const navState: NavigationState = { hash: location.hash, guardId: this.guardId, navStackIndex: 0 };
      this.navStack.push(navState);
      history.replaceState(navState, "", null);

      this.popStateListener = (event: PopStateEvent) => {
         this.inPopState = true;
         if (this.call) {
            this.getTop()?.callback();
         } else {
            this.call = true;
         }
         this.inPopState = false;
      };
      window.addEventListener("popstate", this.popStateListener);
   }

   register(callback: { hash: string | null; callback: NavigationCallback }): { hash: string | null; callback: NavigationCallback } {
      const navState: NavigationState = {
         hash: callback.hash ? callback.hash : location.hash,
         guardId: this.guardId,
         navStackIndex: this.navStack.length,
      };
      this.navStack.push(navState);
      if (callback.hash) history.pushState(navState, "", hashToUrl(callback.hash));

      return super.register(callback);
   }

   remove(callback: { hash: string | null; callback: NavigationCallback }) {
      super.remove(callback);
      this.navStack.pop();
      if (!this.inPopState) {
         this.call = false;
         history.back();
      }
   }
}

function hashToUrl(hash: string) {
   const currentUrl = new URL(window.location.href);
   currentUrl.hash = hash;
   return currentUrl.toString();
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
