import "./styles.css";
import "./header";
import "./settings";
import "./posts";
import "./comments";
import { applySettings, getSettings } from "./settings";
import { navigate } from "./utils";

applySettings();
if (window.location.hash.length == 0) {
  navigate(getSettings().defaultSubreddit);
}

window.addEventListener("hashchange", () => {
   window.location.reload();
 });
