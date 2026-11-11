import { getHunterDemo } from '$lib/server/demo';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, cookies }) => {
  const user = locals.user;
  const active = user?.enabled && user.status === 'ACTIVE' ? user : null;
  return {
    viewer: active ? { name: active.name, roles: active.roles } : null,
    demoMode: getHunterDemo(cookies, user)
  };
};
