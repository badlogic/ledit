import "./styles.css";
import "./header";
import "./settings";
import "./posts";
import "./comments";
import { applySettings } from "./settings";

applySettings();

window.addEventListener("hashchange", () => {
   window.location.reload();
 });
