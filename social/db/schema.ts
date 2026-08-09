import { relations } from "drizzle-orm";
import {
  foreignKey,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";

/**
 * Schema for Seidou Social.
 *
 * NOTE: this file must NOT be marked `server-only`. Two client components
 * import zod schemas from it (the studio edit form uses videoUpdateSchema,
 * the comment form uses commentInsertSchema). It pulls in pg-core and
 * drizzle-zod only — no database driver — so it is safe in the browser.
 */

export const reactionType = pgEnum("reaction_type", ["like", "dislike"]);

export const videoVisibility = pgEnum("video_visibility", [
  "private",
  "public",
]);

/**
 * Seidou's EXISTING users table — shared with the commerce app.
 *
 * Two things about this declaration are deliberate and load-bearing:
 *
 * 1. Every commerce column is declared even though social never reads them.
 *    drizzle-kit diffs the declared schema against the live database, so a
 *    partial declaration would make it generate
 *      ALTER TABLE users DROP COLUMN cash_balance, cart_items, ...
 *    and silently destroy commerce data on the next push.
 *
 * 2. The social columns keep the JS property names the ported code already
 *    uses (`name`, `imageUrl`) while pointing at Seidou-style column names
 *    (display_name, avatar_url). That keeps ~40 ported components unchanged.
 *
 * `id` has no defaultRandom(): it is the Supabase auth user id
 * (auth.users.id), assigned at signup, not generated here. That is also why
 * the clone's `clerk_id` column is gone entirely — id IS the identity.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),

  // --- social ---
  name: text("display_name").notNull(),
  imageUrl: text("avatar_url").notNull(),
  bannerUrl: text("banner_url"),
  bannerKey: text("banner_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),

  // --- commerce: declared only so drizzle-kit never proposes dropping them ---
  firstname: text("firstname"),
  lastname: text("lastname"),
  email: text("email"),
  gender: text("gender"),
  phone: text("phone"),
  dob: text("dob"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  state: text("state"),
  cashBalance: numeric("cash_balance"),
  biddingBalance: numeric("bidding_balance"),
  loyaltyRewards: jsonb("loyalty_rewards"),
  cartItems: jsonb("cart_items"),
  lastAwardedLoyaltyRewardTime: jsonb("last_awarded_loyalty_reward_time"),
});

/**
 * The only projection of `users` that may leave the server.
 *
 * Several procedures spread `getTableColumns(users)` straight into their
 * select and return it to the browser. Now that commerce columns are
 * declared above, that would serialize email, phone, dob and cash_balance
 * into the public video feed. Always select this instead.
 */
export const socialUserColumns = {
  id: users.id,
  name: users.name,
  imageUrl: users.imageUrl,
  bannerUrl: users.bannerUrl,
  bannerKey: users.bannerKey,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export const userRelations = relations(users, ({ many }) => ({
  videos: many(videos),
  videoViews: many(videoViews),
  videoReactions: many(videoReactions),
  subscriptions: many(subscriptions, {
    relationName: "subscriptions_viewer_id_fkey",
  }),
  subscribers: many(subscriptions, {
    relationName: "subscriptions_creator_id_fkey",
  }),
  comments: many(comments),
  commentReactions: many(commentReactions),
}));

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("name_idx").on(t.name)]);

// Upstream declared this over `users` rather than `categories` — a latent bug
// that would surface the moment anyone used the relational query API.
export const categoryRelations = relations(categories, ({ many }) => ({
  videos: many(videos),
}));

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  muxStatus: text("mux_status"),
  muxAssetId: text("mux_asset_id").unique(),
  muxUploadId: text("mux_upload_id").unique(),
  muxPlaybackId: text("mux_playback_id").unique(),
  muxTrackId: text("mux_track_id").unique(),
  muxTrackStatus: text("mux_track_status"),
  thumbnailUrl: text("thumbnail_url"),
  thumbnailKey: text("thumbnail_key"),
  previewUrl: text("preview_url"),
  previewKey: text("preview_key"),
  duration: integer("duration").default(0).notNull(),
  visibility: videoVisibility("visibility").default("private").notNull(),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "cascade",
  }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const videoSelectSchema = createSelectSchema(videos);
export const videoInsertSchema = createInsertSchema(videos);
export const videoUpdateSchema = createUpdateSchema(videos);

export const videoRelations = relations(videos, ({ one, many }) => ({
  user: one(users, {
    fields: [videos.userId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [videos.categoryId],
    references: [categories.id],
  }),
  views: many(videoViews),
  reactions: many(videoReactions),
  comments: many(comments),
}));

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  foreignKey({
    columns: [t.parentId],
    foreignColumns: [t.id],
    name: "comments_parent_id_fkey",
  }).onDelete("cascade"),
]);

export const commentSelectSchema = createSelectSchema(comments);
export const commentInsertSchema = createInsertSchema(comments);
export const commentUpdateSchema = createUpdateSchema(comments);

export const commentRelations = relations(comments, ({ one, many }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [comments.videoId],
    references: [videos.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comments_parent_id_fkey",
  }),
  reactions: many(commentReactions),
  replies: many(comments, {
    relationName: "comments_parent_id_fkey",
  }),
}));

export const commentReactions = pgTable("comment_reactions", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }).notNull(),
  type: reactionType("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "comment_reactions_pk",
    columns: [t.userId, t.commentId],
  }),
]);

export const commentReactionRelations = relations(commentReactions, ({ one }) => ({
  user: one(users, {
    fields: [commentReactions.userId],
    references: [users.id],
  }),
  comment: one(comments, {
    fields: [commentReactions.commentId],
    references: [comments.id],
  }),
}));

export const videoViews = pgTable("video_views", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "video_views_pk",
    columns: [t.userId, t.videoId],
  }),
]);

export const videoViewSelectSchema = createSelectSchema(videoViews);
export const videoViewInsertSchema = createInsertSchema(videoViews);
export const videoViewUpdateSchema = createUpdateSchema(videoViews);

export const videoViewRelations = relations(videoViews, ({ one }) => ({
  user: one(users, {
    fields: [videoViews.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoViews.videoId],
    references: [videos.id],
  }),
}));

export const videoReactions = pgTable("video_reactions", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  videoId: uuid("video_id").references(() => videos.id, { onDelete: "cascade" }).notNull(),
  type: reactionType("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "video_reactions_pk",
    columns: [t.userId, t.videoId],
  }),
]);

export const videoReactionSelectSchema = createSelectSchema(videoReactions);
export const videoReactionInsertSchema = createInsertSchema(videoReactions);
export const videoReactionUpdateSchema = createUpdateSchema(videoReactions);

export const videoReactionRelations = relations(videoReactions, ({ one }) => ({
  user: one(users, {
    fields: [videoReactions.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoReactions.videoId],
    references: [videos.id],
  }),
}));

export const subscriptions = pgTable("subscriptions", {
  viewerId: uuid("viewer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  creatorId: uuid("creator_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({
    name: "subscriptions_pk",
    columns: [t.viewerId, t.creatorId],
  }),
]);

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  viewer: one(users, {
    fields: [subscriptions.viewerId],
    references: [users.id],
    relationName: "subscriptions_viewer_id_fkey",
  }),
  creator: one(users, {
    fields: [subscriptions.creatorId],
    references: [users.id],
    relationName: "subscriptions_creator_id_fkey",
  }),
}));
