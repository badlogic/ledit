import "./styles.css";
import "./header";
import "./settings";
import "./posts";
import "./comments";
import { applySettings, getSettings } from "./settings";
import { navigate } from "./utils";
import { RedditSource } from "./reddit";
import { setSource } from "./data";

applySettings();

if (window.location.hash.length == 0) {
  navigate(getSettings().defaultSub);
} else {
  if (window.location.hash.startsWith("r/")) {
    setSource(new RedditSource());
  } else {
    setSource(new RedditSource());
  }

  window.addEventListener("hashchange", () => {
    window.location.reload();
  });

  document.body.innerHTML = `
  <ledit-header></ledit-header>
  <ledit-posts></ledit-posts>
  `
}