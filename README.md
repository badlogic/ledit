# ledit
A read-only Reddit/Hackernews/RSS client for people who don't like bells and whistles. Ideal for content and comment browsing and nothing else.

[Try it](https://marioslab.io/projects/ledit)

# Usage
ledit lets you browse Reddit, Hackernews, and RSS feeds in a desktop and mobile friendly way. It is aimed at consumption, not participation. Here's how you use it.

## Feeds
A feed is a subreddit, Hackernews, or an RSS feed. You can specify which feed you want to view in by clicking on the feed displayed in the site header:





1. In the browser address bar, append `#r/subreddit`, `#hn/`, or `#rss/https://example.com/rss`.
2. Click the source name in the header of the site and enter a new source, e.g. `r/all`, or `rss/http://example.com/rss``.

In case of Reddit, you can view multi-subreddits by simply concatenating the subreddit names with a `+`. E.g. `r/pics+videos+science` will show you posts from these 3 subreddits in a single stream.

In case of RSS, you can view multiple feeds by simply concatenating their URLs with a `+`. E.g. `rss/https://news.site.com/rss+https://othernews.uk/rss` will show you posts from both RSS feeds in a single stream.

Use the bookmark button in the header to bookmark the currently viewed source.

To access your bookmarks and settings, click the icon in the top left corner of the site header.

You can open a bookmark by simply clicking it. You can make a bookmark the default by clicking its checkmark. You can remove a bookmark by clicking `-`.

You can choose between the `Light` and `Dark` theme in the settings and toggle whether to collapse already seen posts. The `Hide seen posts` option is experimental. It will load content from the currently selected source until it finds posts that you have not yet seen.

Finally, each source offers sorting options via the select box in the top right corner of the site header. Play around with them.


# Development
You'll need [Node.js](https://nodejs.org/en) for development. Assuming you have Node installed:

```
git clone https://github.com/badlogic/ledit && cd ledit
npm install
npm run dev
```

This will start a local web server that serves the files in `site/` on http://localhost:8080. If you make changes to the sources, the browser automatically reloads.

If you use VS Code (you should), then open the `ledit/` folder and run the `ledit` launch configuration. A browser window will open, showing what's served on http://localhost:8080. You can then set breakpoints, change code and save in VS Code, and see your changes applied instantly.

# Deployment
```
npm install
npm run build
```

Copy the contents of the `site/` folder to a web server. That's it.
