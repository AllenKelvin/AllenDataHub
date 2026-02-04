import { z } from 'zod';
import { insertUserSchema, insertProductSchema, insertOrderSchema, userResponseSchema, productResponseSchema, orderResponseSchema } from './schema';

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductResponse = z.infer<typeof productResponseSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderResponse = z.infer<typeof orderResponseSchema>;

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    register: {
      method: 'POST' as const,
      path: '/api/register',
      input: insertUserSchema,
      responses: {
        201: z.object({
          user: userResponseSchema,
          accessToken: z.string(),
        }),
        400: errorSchemas.validation,
      },
    },
    login: {
      method: 'POST' as const,
      path: '/api/login',
      // Accept `identifier` which can be username or email
      input: z.object({ identifier: z.string(), password: z.string() }),
      responses: {
        200: z.object({
          user: userResponseSchema,
          accessToken: z.string(),
        }),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.array(userResponseSchema),
        403: errorSchemas.unauthorized,
      },
    },
  },
  users: {
    listUnverifiedAgents: {
      method: 'GET' as const,
      path: '/api/users/agents/unverified',
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
        403: errorSchemas.unauthorized,
      },
    },
    verifyAgent: {
      method: 'PATCH' as const,
      path: '/api/users/:id/verify',
      responses: {
        200: userResponseSchema,
        404: errorSchemas.notFound,
      },
    },
  },
  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products',
      responses: {
        200: z.array(productResponseSchema),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products',
      input: insertProductSchema,
      responses: {
        201: productResponseSchema,
        403: errorSchemas.unauthorized,
      },
    },
  },
  orders: {
    create: {
      method: 'POST' as const,
      path: '/api/orders',
      input: insertOrderSchema,
      responses: {
        201: orderResponseSchema,
        400: errorSchemas.validation,
      },
    },
    listMyOrders: {
      method: 'GET' as const,
      path: '/api/orders/mine',
      responses: {
        200: z.array(orderResponseSchema),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}