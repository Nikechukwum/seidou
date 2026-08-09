import { db } from "@/social/db";
import { categories } from "@/social/db/schema";
import { baseProcedure, createTRPCRouter } from "@/social/trpc/init";

export const categoriesRouter = createTRPCRouter({
  getMany: baseProcedure.query(async () => {
    const data = await db.select().from(categories);

    return data;
  }),
});
