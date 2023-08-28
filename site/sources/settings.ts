import { SourcePrefix } from "./data";

export interface Bookmark {
   source: SourcePrefix;
   label: string;
   ids: string[];
   isDefault: boolean;
   supplemental?: any;
}

export interface Settings {
   bookmarks: Bookmark[];
   seenIds: string[];
   theme: string;
   collapseSeenPosts: boolean;
}

let settings: Settings | null = null;

export function bookmarkToHash(bookmark: Bookmark) {
   return bookmark.source + bookmark.ids.join("+");
}

let defaultSettings: Settings;
export function getSettings(): Settings {
   if (settings) return settings;
   defaultSettings = {
      bookmarks: [
         // prettier-ignore
         { source: "r/", label: "ledit_mix", ids: ["AdviceAnimals","AskReddit","askscience","assholedesign","aww","battlestations","bestof","BetterEveryLoop","blackmagicfuckery","boardgames","BuyItForLife","Damnthatsinteresting","dataisbeautiful","DesignDesign","DIY","diyelectronics","DrugNerds","europe","explainlikeimfive","facepalm","fatFIRE","fightporn","Fitness","funny","Futurology","gadgets","gaming","GifRecipes","gifs","GiftIdeas","history","homeautomation","Hue","IAmA","IllegalLifeProTips","INEEEEDIT","instant_regret","interestingasfuck","InternetIsBeautiful","Jokes","JusticeServed","kitchens","LifeProTips","maybemaybemaybe","mildlyinfuriating","mildlyinteresting","mildlyvagina","movies","news","NintendoSwitch","nottheonion","oddlysatisfying","OldSchoolCool","pcmasterrace","photoshopbattles","pics","PoliticalHumor","ProgrammerHumor","PublicFreakout","rarepuppers","recipes","rickandmorty","RoomPorn","running","science","Showerthoughts","slatestarcodex","space","spicy","technology","technologyconnections","television","therewasanattempt","todayilearned","UnethicalLifeProTips","Unexpected","UpliftingNews","videos","watchpeoplealmostdie","Wellthatsucks","Whatcouldgowrong","whitepeoplegifs","woahdude","worldnews","WTF"], isDefault: true},
         { source: "r/", label: "all", ids: ["all"], isDefault: false },
         { source: "r/", label: "pics", ids: ["pics"], isDefault: false },
         { source: "r/", label: "videos", ids: ["videos"], isDefault: false },
         { source: "r/", label: "worldnews", ids: ["worldnews"], isDefault: false },
         { source: "r/", label: "science", ids: ["science"], isDefault: false },
         { source: "r/", label: "todayilearned", ids: ["todayilearned"], isDefault: false },
         { source: "hn/", label: "news", ids: [""], isDefault: false },
         {
            source: "rss/",
            label: "Tech News",
            ids: [
               "https://techcrunch.com/feed/",
               "https://www.theverge.com/rss/frontpage",
               "https://www.wired.com/feed/rss",
               "https://gizmodo.com/rss",
               "https://feeds.arstechnica.com/arstechnica/index",
            ],
            isDefault: false,
         },
      ],
      seenIds: [],
      theme: "light",
      collapseSeenPosts: false,
   } as Settings;
   settings = JSON.parse(JSON.stringify(defaultSettings));

   if (localStorage.getItem("ledit")) {
      const stored = JSON.parse(localStorage.getItem("ledit")!);
      for (const key of Object.keys(stored)) {
         (settings as any)[key] = stored[key];
      }
   }
   return settings!;
}

export function applySettings() {
   document.body.classList.remove("dark-theme");
   document.body.classList.remove("light-theme");
   document.body.classList.add(getSettings().theme.toLowerCase() + "-theme");
   document.documentElement.setAttribute("data-theme", getSettings().theme.toLowerCase());
}

export function saveSettings() {
   localStorage.setItem("ledit", JSON.stringify(getSettings()));
}

export function resetSettings() {
   settings = JSON.parse(JSON.stringify(defaultSettings));
   saveSettings();
}