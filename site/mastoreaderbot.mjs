import generator from "megalodon";

const access_token = process.env.MASTOREADER_TOKEN;
const client = generator.default("mastodon", "wss://streaming.mastodon.social", access_token);
const poster = generator.default("mastodon", "https://mastodon.social", access_token);

const stream = client.userSocket();
stream.on("connect", () => {
   console.log("Connected Masto Reader bot");
});

stream.on("notification", (notification) => {
   try {
      if (notification.type == "mention" && notification.status.content.toLowerCase().includes("unroll")) {
         const url = "https://mastoreader.io?url=" + encodeURIComponent(notification.status.url);
         poster.postStatus("@" + notification.status.account.acct + "here's the unrolled thread: " + url, { in_reply_to_id: notification.status.id });
         console.log("Unrolled " + url);
      }
   } catch (e) {
      console.error(e);
   }
});

stream.on("close", () => {
   console.log("closing stream of Masto Reader bot");
});
