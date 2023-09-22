import generator from "megalodon";

const access_token = process.env.MASTOREADER_TOKEN;
const client = generator.default("mastodon", "wss://streaming.mastodon.social", access_token);
const poster = generator.default("mastodon", "https://mastodon.social", access_token);

const stream = client.userSocket();
stream.on("connect", () => {
   console.log("Connected Masto Reader bot");
});

async function getParentPost(parentPostId) {
   try {
      const response = await fetch("https://mastodon.social/api/v1/statuses/" + parentPostId);
      if (response.status != 200) return new Error("Couldn't fetch status");
      return await response.json();
   } catch (e) {
      return new Error("Couldn't fetch status");
   }
}

async function getAccount(accountUrl) {
   try {
      const instance = new URL(accountUrl).host;
      const accountId = accountUrl.split("/").pop().replace("@", "");
      const response = await fetch(`https://${instance}/api/v1/accounts/lookup?acct=${accountId}`);
      if (response.status != 200) return new Error("Couldn't fetch account");
      return await response.json();
   } catch (e) {
      return new Error("Couldn't fetch account");
   }
}

stream.on("notification", async (notification) => {
   try {
      if (notification.type == "mention" && notification.status.content.toLowerCase().includes("unroll")) {
         const parentPost = await getParentPost(notification.status.in_reply_to_id);
         if (parentPost instanceof Error) {
            poster.postStatus(
               "@" + notification.status.account.acct + " Sorry, I couldn't fetch the account information of the user you replied to, which means I can not unroll their thread.",
               {
                  visibility: "direct",
                  in_reply_to_id: notification.status.id,
               }
            );
            return;
         }
         const account = await getAccount(parentPost.account.url);
         if (!(account instanceof Error) && account.note.includes("#<span>nobot</span>")) {
            poster.postStatus(
               "@" + notification.status.account.acct + " Sorry, user " + parentPost.account.display_name + " has #nobot in their profile. I'm not allowed to unroll their thread.",
               {
                  visibility: "direct",
                  in_reply_to_id: notification.status.id,
               }
            );
            return;
         }
         const isDirect = notification.status.visibility == "direct";
         const targetUrl = isDirect ? parentPost.url : notification.status.url;
         const url = "https://mastoreader.io?url=" + encodeURIComponent(targetUrl);
         const supplement = !isDirect
            ? "\n\nNext time, kindly set the visibility to 'Mentioned people only' and mention only me (@mastoreaderio@mastodon.social). This ensures we avoid spamming others' timelines and threads unless you intend for others to see the unrolled thread link as well.\n\n Thank you!"
            : "";
         poster.postStatus("@" + notification.status.account.acct + " here's the unrolled thread: " + url + supplement, {
            visibility: isDirect ? "direct" : "unlisted",
            in_reply_to_id: notification.status.id,
         });
         console.log("Unrolled " + url);
      }
   } catch (e) {
      console.error(e);
   }
});

stream.on("close", () => {
   console.log("closing stream of Masto Reader bot");
});
