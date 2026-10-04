import { z } from "zod";

/** An account as the API returns it. Unknown keys are stripped. */
export const AccountSchema: z.ZodObject<{
	id: z.ZodUUID;
	name: z.ZodNullable<z.ZodString>;
	logoUrl: z.ZodNullable<z.ZodString>;
	createdAt: z.ZodISODateTime;
}> = z.object({
	id: z.uuid(),
	name: z.string().nullable(),
	logoUrl: z.string().nullable(),
	createdAt: z.iso.datetime(),
});

/** The body of `GET /api/admin/accounts`. */
export const AccountListSchema: z.ZodArray<typeof AccountSchema> =
	z.array(AccountSchema);

/** An account id in a path. Checked before it is sent, so it can never change the route. */
export const AccountIdSchema: z.ZodUUID = z.uuid();

/** The body of `POST /api/admin/accounts`. Both fields are required, as the API requires them. */
export const CreateAccountRequestSchema: z.ZodObject<{
	name: z.ZodString;
	logoUrl: z.ZodURL;
}> = z.object({
	name: z.string().trim().min(1),
	logoUrl: z.url({ protocol: /^https?$/ }),
});

/** The body of `PATCH /api/admin/accounts/{id}`. Same rules as create. */
export const UpdateAccountRequestSchema: z.ZodObject<{
	name: z.ZodString;
	logoUrl: z.ZodURL;
}> = z.object({
	name: z.string().trim().min(1),
	logoUrl: z.url({ protocol: /^https?$/ }),
});

/** What the API sends for an update with no fields. */
const UpdateAccountNoopSchema: z.ZodObject<{
	success: z.ZodLiteral<true>;
}> = z.object({ success: z.literal(true) });

/** The body of `PATCH /api/admin/accounts/{id}`: the updated account, or the no op answer. */
export const UpdateAccountResultSchema: z.ZodUnion<
	[typeof AccountSchema, typeof UpdateAccountNoopSchema]
> = z.union([AccountSchema, UpdateAccountNoopSchema]);

/** The body of `DELETE /api/admin/accounts/{id}`. */
export const DeletedAccountSchema: z.ZodObject<{ id: z.ZodUUID }> = z.object({
	id: z.uuid(),
});
