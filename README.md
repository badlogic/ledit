# ledit
A read-only reddit client for people who don't like bells and whistles. Ideal for content and comment browsing and nothing else.

[Try it](https://marioslab.io/projects/ledit)

# Development
You'll need [Node.js](https://nodejs.org/en) for development. Assuming you have Node installed:

```
git clone https://github.com/badlogic/ledit && cd ledit
npm install
npm run dev
```

This will start a local web server that serves the files in `site/` on http://localhost:8080. If you make changes to the sources, the browser automatically reloads.

If you use VS Code (you should), then open the `ledit/` folder and run the `ledit` launch configuration. A browser window will open, you can set breakpoints, change code and save, and see your changes applied instantly.

# Deployment
```
npm run build
```

Copy the contents of the `site/` folder to a web server. That's it.