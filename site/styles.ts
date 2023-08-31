import { unsafeCSS } from "lit";

import "video.js/dist/video-js.min.css";
import "./styles-bundle.css";
// @ts-ignore
import globalCssTxt from "./styles-bundle.css.txt";

export const globalStyles = unsafeCSS(globalCssTxt);
