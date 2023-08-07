# ledit
A read-only reddit client for people who don't like bells and whistles. Ideal for content and comment browsing and nothing else.

[Try it](https://marioslab.io/projects/ledit)

# Usage
By default, `r/all` is shown. Click on the subreddit name at the top and enter the name of another subreddit you want to visit.

[https://marioslab.io/projects/ledit/#images](https://marioslab.io/projects/ledit/#images)
[https://marioslab.io/projects/ledit/#aww](https://marioslab.io/projects/ledit/#aww)
[https://marioslab.io/projects/ledit/#videos](https://marioslab.io/projects/ledit/#videos)

You can expand all comments inline by clicking on the "Comments ()" link. You can collapse the comments by clicking `Comments ()` again.

You can also collapse/expand comments and their child comments by clicking their text.

If you absolutely need to reply to a comment, there's a tiny "reply" link in the header of each comment. It will open a new browser tab on
"real" Reddit, where you can reply if you're logged in. Don't reply.

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