import { createApp } from 'vue';                // Import Vue 3
import App from './App.vue';                    // Root component
import store from './store';                    // Import your Vuex store
import { createRouter, createWebHistory } from 'vue-router';  // Import Vue Router
import './assets/styles.css';                  // Import global styles

// 1. Define routes for the application
const routes = [
  { path: '/', component: () => import('./components/Dashboard.vue') },
  { path: '/reservations', component: () => import('./components/ReservationManagement.vue') },
  { path: '/room-management', component: () => import('./components/RoomManagement.vue') },
  { path: '/billing', component: () => import('./components/Billing.vue') },
  { path: '/settings', component: () => import('./components/Settings.vue') },
  { path: '/reports', component: () => import('./components/Reports.vue') },
  // Add more routes as needed
];

// 2. Create the Vue Router instance
const router = createRouter({
  history: createWebHistory(),
  routes
});

// 3. Create and mount the Vue app
const app = createApp(App);

// Use Vuex store for state management
app.use(store);

// Use Vue Router for page navigation
app.use(router);

// Mount the Vue app to the DOM
app.mount('#app');
