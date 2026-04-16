import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/', component: () => import('../views/Home.vue') },
  { path: '/article/:slug', component: () => import('../views/Article.vue') },
  { path: '/category/:name', component: () => import('../views/Category.vue') },
  { path: '/admin/login', component: () => import('../views/admin/Login.vue') },
  {
    path: '/admin',
    component: () => import('../views/admin/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('../views/admin/Dashboard.vue') },
      { path: 'items', component: () => import('../views/admin/ItemList.vue') },
      { path: 'items/:slug', component: () => import('../views/admin/ItemDetail.vue') },
      { path: 'collector', component: () => import('../views/admin/Collector.vue') },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const auth = useAuthStore();
    if (!auth.isLoggedIn) return '/admin/login';
  }
});

export default router;
