# ledit
A read-only reddit client for people who don't like bells and whistles. Ideal for content and comment browsing and nothing else.

[Try it](https://marioslab.io/projects/ledit)

# Usage
In the browser url bar, append the `#<sub-redit-name>` to visit a specific subreddit. By default, `r/all` is shown. E.g.

[https://marioslab.io/projects/ledit/#images](https://marioslab.io/projects/ledit/#images)
[https://marioslab.io/projects/ledit/#aww](https://marioslab.io/projects/ledit/#aww)

# Roadmap
* Favorite subreddits and be able to select them from a list
* Optionally hide already seen posts

# Development
You'll need [Node.js](https://nodejs.org/en) for development. Assuming you have Node installed:

```
git clone https://github.com/badlogic/ledit && cd ledit
npm install
npm run dev
```

This will start a local web server that serves the files in `site/` on http://localhost:8080. If you make changes to the sources, the browser automatically reloads.

If you use VS Code (you should), then open the `ledit/` folder and run the `ledit` launch configuration. A browser window will open, you can set breakpoints, change code and save, and see your changes applied instantly.

Files you might be interested in:

* [site/utils.ts](site/utils.ts): interface definitions for the JSON data Reddit returns and utility functions.
* [site/index.ts](site/index.ts): all of the app "logic" and rendering.
* [site/styles.css]: Minimal CSS.

# Deployment
```
npm run build
```

Copy the contents of the `site/` folder to a web server. That's it.