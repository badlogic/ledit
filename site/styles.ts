import { unsafeCSS } from "lit";

import "video.js/dist/video-js.min.css";
import "./styles-bundle.css";
// @ts-ignore
import globalCssTxt from "./styles-bundle.css.txt";
// @ts-ignore
import videoJSCssTxt from "./video-js.min.css.txt";

export const globalStyles = [unsafeCSS(globalCssTxt), unsafeCSS(videoJSCssTxt)];
