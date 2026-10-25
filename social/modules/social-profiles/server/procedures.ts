import { z } from "zod";
import { eq, sql } from "drizzle-orm";

import { db } from "@/social/db";
import { socialProfiles, users } from "@/social/db/schema";
import {
  baseProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/social/trpc/init";
import { SOCIAL_CATEGORIES } from "@/social/modules/explore/constants";

import { GENDER_OPTIONS, MIN_INTERESTS } from "../constants";

const interestSlugs = SOCIAL_CATEGORIES.map((category) => category.slug) as [
  string,
  ...string[],
];

/**
 * Seidou Social onboarding: basic information, then interests.
 *
 * Answers live in social_profiles, never the shared commerce users table. The
 * one exception is the username, which is written to users.display_name — the
 * social column every channel, comment and video card already shows.
 */
export const socialProfilesRouter = createTRPCRouter({
  /**
   * Read by the feed's server page to decide whether to redirect into
   * onboarding. Signed-out viewers browse freely, so they never need it.
   */
  getOnboardingStatus: baseProcedure.query(async ({ ctx }) => {
    if (!ctx.authUserId) return { required: false };

    const [row] = await db
      .select({
        userId: users.id,
        onboardedAt: socialProfiles.onboardedAt,
      })
      .from(users)
      .leftJoin(socialProfiles, eq(socialProfiles.userId, users.id))
      .where(eq(users.id, ctx.authUserId))
      .limit(1);

    // No profile row at all: protectedProcedure would reject every write
    // anyway, so sending them to onboarding would only dead-end.
    if (!row) return { required: false };

    return { required: !row.onboardedAt };
  }),

  /** Prefills the form when someone comes back to onboarding. */
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const [profile] = await db
      .select({
        gender: socialProfiles.gender,
        country: socialProfiles.country,
        interests: socialProfiles.interests,
      })
      .from(socialProfiles)
      .where(eq(socialProfiles.userId, ctx.user.id))
      .limit(1);

    return {
      username: ctx.user.name,
      gender: profile?.gender ?? null,
      country: profile?.country ?? null,
      interests: profile?.interests ?? [],
    };
  }),

  completeOnboarding: protectedProcedure
    .input(
      z.object({
        username: z.string().trim().min(2).max(30),
        gender: z.enum(GENDER_OPTIONS),
        // ISO 3166-1 alpha-2, e.g. "NG".
        country: z.string().regex(/^[A-Z]{2}$/),
        acceptedTerms: z.literal(true),
        interests: z
          .array(z.enum(interestSlugs))
          .min(MIN_INTERESTS)
          .max(interestSlugs.length),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const interests = [...new Set(input.interests)];

      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ name: input.username, updatedAt: new Date() })
          .where(eq(users.id, ctx.user.id));

        await tx
          .insert(socialProfiles)
          .values({
            userId: ctx.user.id,
            gender: input.gender,
            country: input.country,
            interests,
            termsAcceptedAt: sql`now()`,
            onboardedAt: sql`now()`,
          })
          .onConflictDoUpdate({
            target: socialProfiles.userId,
            set: {
              gender: input.gender,
              country: input.country,
              interests,
              termsAcceptedAt: sql`now()`,
              onboardedAt: sql`now()`,
              updatedAt: sql`now()`,
            },
          });
      });

      return { success: true };
    }),
});
