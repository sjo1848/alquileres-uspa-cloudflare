import { createRouter, createWebHistory } from 'vue-router';
import HomeView from './views/HomeView.vue';
import ListingView from './views/ListingView.vue';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/listings/:id', component: ListingView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
