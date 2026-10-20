import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
})

export const requestEmailCodeSchema = loginSchema.extend({
  returnTo: z.string().optional(),
  invite: z.string().optional(),
  name: z.string().optional(),
  quantity: z.string().optional(),
  category: z.string().optional(),
  store: z.string().optional(),
})
