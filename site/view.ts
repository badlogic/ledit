export abstract class View extends HTMLElement {
    constructor() {
        super();
    }

    static elements<T>(view: HTMLElement): T {
        let elements = [...view.querySelectorAll("[x-id]")];
        elements = elements.filter((el) => {
            let parent = el.parentElement;
            while (parent != view) {
                if (parent instanceof View) return false;
                parent = parent ? parent.parentElement : null;
            }
            return true;
        });
        const result = {};
        elements.forEach((element) => {
            // @ts-ignore
            if (result[element.getAttribute("x-id")]) {
                console.log(`View - Duplicate element x-id ${element.getAttribute("x-id")} in ${view.localName}`);
            }
            // @ts-ignore
            result[element.getAttribute("x-id")] = element;
        });
        return result as T;
    }

    elements<T>(): T {
        return View.elements(this);
    }
}