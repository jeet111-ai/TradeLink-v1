import { z } from 'zod';
import { insertTradeSchema, trades } from './schema';

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
};

export const api = {
  trades: {
    list: {
      method: 'GET' as const,
      path: '/api/trades',
      input: z.object({
        type: z.enum(["FUTURES", "EQUITY_INTRADAY", "LONG_TERM_HOLDING"]).optional(),
        status: z.enum(["OPEN", "CLOSED"]).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof trades.$inferSelect>()),
      },
    },
    stats: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          netPnL: z.number(),
          winRate: z.number(),
          profitFactor: z.number(),
          equityCurve: z.array(z.object({
            date: z.string(),
            cumulativePnL: z.number(),
          })),
          strategyBreakdown: z.array(z.object({
            name: z.string(),
            value: z.number(),
          })),
        }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/trades/:id',
      responses: {
        200: z.custom<typeof trades.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/trades',
      input: insertTradeSchema,
      responses: {
        201: z.custom<typeof trades.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/trades/:id',
      input: insertTradeSchema.partial(),
      responses: {
        200: z.custom<typeof trades.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/trades/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
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

export type InsertTrade = z.infer<typeof insertTradeSchema>;
