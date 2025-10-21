import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";

export const geoLinkClicksTable = sqliteTable("geo_link_clicks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
  country: text("country").notNull(),
  time: integer("time").notNull(),
});