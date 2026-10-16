import { createRouter, createWebHistory } from 'vue-router';
import { setSessionExpiredHandler, useSession } from './session';
import HomeView from './views/HomeView.vue';
import ListingView from './views/ListingView.vue';
import AuthView from './views/AuthView.vue';
import OwnerView from './views/OwnerView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/listings/:id', component: ListingView },
    { path: '/auth/login', component: AuthView },
    { path: '/owner', component: OwnerView, meta: { requiresAuth:true, role:'OWNER' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
setSessionExpiredHandler(()=>void router.replace({path:'/auth/login',query:{expired:'1',redirect:'/owner'}}));
router.beforeEach(async to=>{
  const session=useSession();
  if((to.meta.requiresAuth||to.path==='/auth/login')&&session.status.value==='unknown'){
    try{await session.restore();}
    catch{if(to.meta.requiresAuth)return {path:'/auth/login',query:{unavailable:'1',redirect:to.fullPath}};}
  }
  if(to.meta.requiresAuth&&!session.isAuthenticated.value)return {path:'/auth/login',query:{redirect:to.fullPath}};
  if(to.meta.role&&session.role.value!==to.meta.role)return '/';
  if(to.path==='/auth/login'&&session.isAuthenticated.value)return session.role.value==='OWNER'?'/owner':'/';
});
