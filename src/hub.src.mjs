import { getStore } from '@netlify/blobs';
import { handle } from '../lib/handler.mjs';
export const config = { path: '/api/*' };
export default async (req) => handle(req, getStore({ name: 'lbx-hub', consistency: 'strong' }), { HUB_KEY: Netlify.env.get('HUB_KEY') });
