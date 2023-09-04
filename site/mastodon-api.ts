import { Page, PageIdentifier } from "./data";

export interface MastodonAccount {
   acct: string;
   avatar: string | null;
   avatar_static: string | null;
   bot: boolean;
   created_at: string;
   discoverable: boolean;
   display_name: string | null;
   followers_count: number;
   following_count: number;
   header: string | null;
   header_static: string | null;
   id: string;
   last_status_at: string;
   locked: boolean;
   noindex: boolean;
   note: string | null;
   statuses_count: number;
   url: string;
   username: string;
   emojis: MastodonEmoji[];
   instance: string;
   fields: { name: string; value: string; verified_at: string | null }[];
}

export interface MastodonRelationship {
   id: string;
   following: boolean;
   showing_reblogs: boolean;
   notifying: boolean;
   followed_by: boolean;
   blocking: boolean;
   blocked_by: boolean;
   muting: boolean;
   muting_notifications: boolean;
   requested: boolean;
   domain_blocking: boolean;
   endorsed: boolean;
   note: string;
}

export interface MastodonMention {
   acct: string;
   id: string;
   url: string;
   username: string;
}

export interface MastodonMedia {
   id: string;
   type: "image" | "gifv" | "video" | "audio";
   url: string;
   meta: {
      original:
         | {
              width: number;
              height: number;
              aspect: number;
           }
         | undefined;
   };
}

export interface MastodonEmoji {
   shortcode: string;
   url: string;
   static_url: string;
}

export interface MastodonCard {}

export interface MastodonPoll {
   options: { title: string; votes_count: number }[];
   voters_count: number;
   votes_count: number;
}

export interface MastodonPost {
   account: MastodonAccount;
   content: string;
   card: MastodonCard;
   created_at: string;
   edited_at: string | null;
   favourited: boolean;
   favourites_count: number;
   id: string;
   in_reply_to_account_id: string | null;
   in_reply_to_id: string | null;
   in_reply_to_post: MastodonPost | null;
   media_attachments: MastodonMedia[];
   metions: MastodonMention;
   poll: MastodonPoll;
   reblog: MastodonPost | null;
   reblogged: boolean;
   reblogs_count: number;
   replies_count: number;
   sensitive: boolean;
   spoiler_text: string;
   uri: string;
   url: string;
   visibility: string;
   userInfo: MastodonUserInfo | undefined;
   emojis: MastodonEmoji[];
   instance: string;
}

export interface MastodonNotification {
   id: string;
   type: "mention" | "status" | "reblog" | "follow" | "follow_request" | "favourite" | "poll" | "update";
   created_at: string;
   account: MastodonAccount;
   status: MastodonPost | null;
}

export interface MastodonPostContext {
   ancestors: MastodonPost[];
   descendants: MastodonPost[];
}

export type MastodonUserInfo = { username: string; instance: string; bearer: string | null };

export class MastodonApi {
   static getAuthHeader(userInfo: MastodonUserInfo): RequestInit {
      return !userInfo.bearer
         ? {}
         : {
              headers: { Authorization: `Bearer ${userInfo.bearer}` },
           };
   }

   static async resolvePost(postUrl: string, userInfo: MastodonUserInfo): Promise<MastodonPost | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v2/search/?q=${postUrl}&resolve=true`, options);
         if (response.status != 200) return new Error(`Could not resolve post. Server responded with status code ${response.status}`);
         const searchResult = (await response.json()) as { statuses: MastodonPost[] };
         if (searchResult.statuses.length == 0) return new Error(`Post ${postUrl} could not be found.`);
         const post = searchResult.statuses[0];
         const instance = userInfo.instance;
         post.instance = instance;
         post.account.instance = instance;
         if (post.reblog) {
            post.reblog.instance = instance;
            post.reblog.account.instance = instance;
         }
         return post;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getPost(postId: string, instance: string, userInfo?: MastodonUserInfo): Promise<MastodonPost | Error> {
      try {
         const options = userInfo && userInfo.instance == instance ? this.getAuthHeader(userInfo) : {};
         const response = await fetch(`https://${instance}/api/v1/statuses/${postId}`, options);
         if (response.status != 200) return new Error(`Could not load post. Server responded with status code ${response.status}`);
         const post = (await response.json()) as MastodonPost;
         post.instance = instance;
         post.account.instance = instance;
         if (post.reblog) {
            post.reblog.instance = instance;
            post.reblog.account.instance = instance;
         }
         return post;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getPostContext(postId: string, instance: string, userInfo?: MastodonUserInfo): Promise<MastodonPostContext | Error> {
      try {
         const options = userInfo && userInfo.instance == instance ? this.getAuthHeader(userInfo) : {};
         const response = await fetch(`https://${instance}/api/v1/statuses/${postId}/context`, options);
         if (response.status != 200) return new Error(`Could not load post context. Server responded with status code ${response.status}`);
         const context = (await response.json()) as MastodonPostContext;
         for (const post of context.ancestors) {
            post.instance = instance;
            post.account.instance = instance;
            if (post.reblog) {
               post.reblog.instance = instance;
               post.reblog.account.instance = instance;
            }
         }
         for (const post of context.descendants) {
            post.instance = instance;
            post.account.instance = instance;
            if (post.reblog) {
               post.reblog.instance = instance;
               post.reblog.account.instance = instance;
            }
         }
         return context;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async lookupAccount(userName: string, instance: string): Promise<MastodonAccount | Error> {
      try {
         const response = await fetch("https://" + instance + "/api/v1/accounts/lookup?acct=" + userName);
         if (response.status != 200) return new Error(`Could not look up account. Server responded with status code ${response.status}`);
         const account = (await response.json()) as MastodonAccount;
         account.instance = instance;
         return account;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async resolveAccount(accountUrl: string, userInfo: MastodonUserInfo): Promise<MastodonAccount | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v2/search/?q=${accountUrl}&resolve=true`, options);
         if (response.status != 200) return new Error(`Could not resolve account. Server responded with status code ${response.status}`);
         const searchResult = (await response.json()) as { accounts: MastodonAccount[]; statuses: MastodonPost[] };
         if (searchResult.accounts.length == 0) return new Error(`Account ${accountUrl} could not be found.`);
         searchResult.accounts[0].instance = userInfo.instance;
         return searchResult.accounts[0];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getAccountPosts(accountId: string, instance: string, maxId: string | null, userInfo?: MastodonUserInfo): Promise<Page<MastodonPost> | Error> {
      try {
         const options = userInfo && userInfo.instance == instance ? this.getAuthHeader(userInfo) : {};
         const response = await fetch(`https://${instance}/api/v1/accounts/${accountId}/statuses?limit=20${maxId ? maxId : ""}`, options);
         if (response.status != 200) return new Error(`Could not get posts for account. Server responded with status code ${response.status}`);
         const posts = (await response.json()) as MastodonPost[];
         for (const post of posts) {
            post.instance = instance;
            post.account.instance = instance;
            if (post.reblog) {
               post.reblog.instance = instance;
               post.reblog.account.instance = instance;
            }
         }
         return { nextPage: posts.length > 0 ? "&max_id=" + posts[posts.length - 1].id : "end", items: posts };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getRelationship(otherAccountId: string, userInfo: MastodonUserInfo): Promise<MastodonRelationship | Error> {
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch("https://" + userInfo.instance + "/api/v1/accounts/relationships?id[]=" + otherAccountId, options);
         if (response.status != 200) return new Error(`Could not load relationship. Server responded with status code ${response.status}`);
         return (await response.json())[0] as MastodonRelationship;
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getFollowing(account: MastodonAccount, instance: string, nextPage: PageIdentifier, userInfo?: MastodonUserInfo): Promise<Page<MastodonAccount> | Error> {
      try {
         const following: MastodonAccount[] = [];
         if (!nextPage) nextPage = `https://${instance}/api/v1/accounts/${account.id}/following`;
         const response = await fetch(nextPage, userInfo && instance == userInfo.instance ? this.getAuthHeader(userInfo) : undefined);
         if (response.status != 200) return new Error(`Could not get following list for account. Server responded with status code ${response.status}`);
         const result = (await response.json()) as MastodonAccount[];
         if (result.length == 0) return { items: [], nextPage: "end" };
         following.push(...result);
         for (const follow of following) follow.instance = instance;
         nextPage = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
         return { items: following, nextPage: nextPage ?? "end" };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getFollowers(account: MastodonAccount, instance: string, nextPage: string | null, userInfo?: MastodonUserInfo): Promise<Page<MastodonAccount> | Error> {
      try {
         const following: MastodonAccount[] = [];
         if (!nextPage) nextPage = `https://${instance}/api/v1/accounts/${account.id}/followers`;
         const response = await fetch(nextPage, userInfo && instance == userInfo.instance ? this.getAuthHeader(userInfo) : undefined);
         if (response.status != 200) return new Error(`Could not get following list for account. Server responded with status code ${response.status}`);
         const result = (await response.json()) as MastodonAccount[];
         if (result.length == 0) return { items: [], nextPage: "end" };
         following.push(...result);
         for (const follow of following) follow.instance = instance;
         nextPage = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
         return { items: following, nextPage: nextPage ?? "end" };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getNotifications(nextPage: PageIdentifier, userInfo: MastodonUserInfo, sinceId: string | null = null): Promise<Page<MastodonNotification> | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      try {
         const options = this.getAuthHeader(userInfo);
         if (!nextPage) nextPage = `https://${userInfo.instance}/api/v1/notifications?limit=20${sinceId ? "&sinceId=" + sinceId : ""}}`;
         const response = await fetch(nextPage, options);
         if (response.status != 200) return new Error(`Could not get notifications for account. Server responded with status code ${response.status}`);
         const result = (await response.json()) as MastodonNotification[];
         if (result.length == 0) return { items: [], nextPage: "end" };
         const notifications: MastodonNotification[] = [];
         notifications.push(...result);
         for (const notification of notifications) {
            if (notification.account) notification.account.instance = userInfo.instance;
            if (notification.status) {
               const post = notification.status;
               const instance = userInfo.instance;
               post.instance = instance;
               post.account.instance = instance;
               if (post.reblog) {
                  post.reblog.instance = instance;
                  post.reblog.account.instance = instance;
               }
            }
         }
         nextPage = response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
         return { items: notifications, nextPage: nextPage ?? "end" };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async dismissNotifications(userInfo: MastodonUserInfo): Promise<boolean> {
      try {
         const url = `https://${userInfo.instance}/api/v1/notifications/clear`;
         const options = {
            method: "POST",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
         const response = await fetch(url, options);
         return response.status == 200;
      } catch (e) {
         return false;
      }
   }

   static async getHomeTimeline(maxId: string | null, userInfo: MastodonUserInfo): Promise<Page<MastodonPost> | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      try {
         const options = this.getAuthHeader(userInfo);
         const response = await fetch(`https://${userInfo.instance}/api/v1/timelines/home?limit=20${maxId ? maxId : ""}`, options);
         if (response.status != 200) return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         const posts = (await response.json()) as MastodonPost[];
         for (const post of posts) {
            const instance = userInfo.instance;
            post.instance = instance;
            post.account.instance = instance;
            if (post.reblog) {
               post.reblog.instance = instance;
               post.reblog.account.instance = instance;
            }
         }
         return { nextPage: posts.length > 0 ? "&max_id=" + posts[posts.length - 1].id : "end", items: posts };
      } catch (e) {
         return new Error("Networking error.");
      }
   }

   static async getLocalTimeline(maxId: string | null, instance: string, userInfo?: MastodonUserInfo): Promise<Page<MastodonPost> | Error> {
      try {
         const options = userInfo && userInfo.instance == instance ? this.getAuthHeader(userInfo) : {};
         const response = await fetch(`https://${instance}/api/v1/timelines/public?local=true&limit=20${maxId ? maxId : ""}`, options);
         if (response.status != 200) return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         const posts = (await response.json()) as MastodonPost[];
         for (const post of posts) {
            post.instance = instance;
            post.account.instance = instance;
            if (post.reblog) {
               post.reblog.instance = instance;
               post.reblog.account.instance = instance;
            }
         }
         return { nextPage: posts.length > 0 ? "&max_id=" + posts[posts.length - 1].id : "end", items: posts };
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async getEmojis(instance: string): Promise<MastodonEmoji[] | Error> {
      try {
         const response = await fetch(`https://${instance}/api/v1/custom_emojis`);
         if (response.status != 200) return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         return (await response.json()) as MastodonEmoji[];
      } catch (e) {
         return new Error("Network error.");
      }
   }

   static async publishPost(replyTo: MastodonPost | null, text: string, userInfo: MastodonUserInfo): Promise<MastodonPost | Error> {
      if (!userInfo.bearer) return new Error(`No access token given for ${userInfo.username}@${userInfo.instance}`);
      const resolvedPost = replyTo ? await this.resolvePost(replyTo.uri, userInfo) : null;
      if (resolvedPost instanceof Error) return new Error("Could not resolve post to reply to.");
      try {
         const response = await fetch(`https://${userInfo.instance}/api/v1/statuses`, {
            method: "POST",
            headers: {
               Authorization: `Bearer ${userInfo.bearer}`,
               "Content-Type": "application/json",
            },
            body: JSON.stringify(replyTo ? { status: text, in_reply_to_id: resolvedPost?.id } : { status: text }),
         });
         const json = await response.json();
         if (response.status != 200) {
            console.error(JSON.stringify(json));
            return new Error(`Could not load home timeline. Server responded with status code ${response.status}`);
         }
         const post = json as MastodonPost;
         post.instance = userInfo.instance;
         post.account.instance = userInfo.instance;
         return post;
      } catch (e) {
         console.error("Couldn't publish post.", e);
         return new Error("Network error.");
      }
   }

   static async reblogPost(post: MastodonPost, userInfo: MastodonUserInfo): Promise<boolean> {
      try {
         const resolvedPost = await this.resolvePost(post.uri, userInfo);
         if (resolvedPost instanceof Error) return false;
         const url = `https://${userInfo.instance}/api/v1/statuses/${resolvedPost.id}/${post.reblogged ? "reblog" : "unreblog"}`;
         const options = {
            method: "POST",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
         const response = await fetch(url, options);
         return response.status == 200;
      } catch (e) {
         return false;
      }
   }

   static async favouritePost(post: MastodonPost, userInfo: MastodonUserInfo): Promise<boolean> {
      try {
         const resolvedPost = await this.resolvePost(post.uri, userInfo);
         if (resolvedPost instanceof Error) return false;
         const url = `https://${userInfo.instance}/api/v1/statuses/${resolvedPost.id}/${post.favourited ? "favourite" : "unfavourite"}`;
         const options = {
            method: "POST",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
         const response = await fetch(url, options);
         return response.status == 200;
      } catch (e) {
         return false;
      }
   }

   static async followAccount(account: MastodonAccount, follow: boolean, userInfo: MastodonUserInfo): Promise<boolean> {
      try {
         const resolveAccount = await this.resolveAccount(account.url, userInfo);
         if (resolveAccount instanceof Error) return false;
         const url = `https://${userInfo.instance}/api/v1/accounts/${resolveAccount.id}/${follow ? "follow" : "unfollow"}`;
         const options = {
            method: "POST",
            headers: {
               Authorization: "Bearer " + userInfo.bearer,
            },
         };
         const response = await fetch(url, options);
         return response.status == 200;
      } catch (e) {
         return false;
      }
   }
}
