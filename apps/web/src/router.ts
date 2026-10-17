import { createRouter, createWebHistory } from 'vue-router';
import { setSessionExpiredHandler, useSession } from './session';
import HomeView from './views/HomeView.vue';
import ListingView from './views/ListingView.vue';
import AuthView from './views/AuthView.vue';
import OwnerView from './views/OwnerView.vue';
import AdminReviewView from './views/AdminReviewView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/listings/:id', component: ListingView },
    { path: '/login', component: AuthView },
    { path: '/owner', component: OwnerView, meta: { requiresAuth:true, role:'OWNER' } },
    { path: '/admin', component: AdminReviewView, meta: { requiresAuth:true, role:'ADMIN' } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
setSessionExpiredHandler(()=>void router.replace({path:'/login',query:{expired:'1',redirect:'/owner'}}));
router.beforeEach(async to=>{
  const session=useSession();
  if((to.meta.requiresAuth||to.path==='/login')&&['unknown','loading','error'].includes(session.status.value)){
    try{await session.restore();}
    catch{if(to.meta.requiresAuth)return {path:'/login',query:{unavailable:'1',redirect:to.fullPath}};}
  }else if(session.status.value==='unknown'){
    // Public content stays navigable while the cookie session restores the header.
    void session.restore().catch(()=>{});
  }
  if(to.meta.requiresAuth&&!session.isAuthenticated.value)return {path:'/login',query:{redirect:to.fullPath}};
  if(to.meta.role&&session.role.value!==to.meta.role)return '/';
  if(to.path==='/login'&&session.isAuthenticated.value)return session.role.value==='OWNER'?'/owner':'/admin';
});
