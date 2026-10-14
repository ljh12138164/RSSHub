import type { Context } from 'hono';

import type { Route } from '@/types';

import { handler, route as leaderboardRoute } from './index';

export const route: Route = {
    ...leaderboardRoute,
    path: '/details/:view?',
    name: 'Leaderboard with instructions',
    example: '/skills-sh/details/trending',
    description: 'Includes complete SKILL.md snapshots when available. Use the built-in JSON Feed output to read the original Markdown and structured metadata.',
    handler: detailsHandler,
};

function detailsHandler(ctx: Context) {
    return handler(ctx, true);
}
