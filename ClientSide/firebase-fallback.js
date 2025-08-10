// firebase-fallback.js - Non-module version of firebase.js
// This script initializes Firebase and exposes the necessary functions globally

(function() {
  console.log('Initializing Firebase from firebase-fallback.js');
  
  // Check if Firebase is already initialized
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not found! Make sure to include the Firebase SDK scripts first.');
    return;
  }
  
  // Initialize Firebase if not already initialized
  if (!firebase.apps || firebase.apps.length === 0) {
    var firebaseConfig = {
      apiKey: "AIzaSyBAJr0JQgWRfGTmSXTK6P7Yn8fkHXG2YeE",
      authDomain: "lms-app-2b903.firebaseapp.com",
      projectId: "lms-app-2b903",
      storageBucket: "lms-app-2b903.appspot.com",
      messagingSenderId: "1046108373013",
      appId: "1:1046108373013:web:fc366db1d92b9c4b860e1c",
      measurementId: "G-WRMW9Z8867"
    };
    
    firebase.initializeApp(firebaseConfig);
    console.log('Firebase initialized by firebase-fallback.js');
  } else {
    console.log('Firebase already initialized');
  }
  
  // Make auth and db available globally
  window.firebaseAuth = firebase.auth();
  window.firebaseDb = firebase.firestore();
  
  // Expose Firestore functions globally
  window.collection = function(path) {
    return window.firebaseDb.collection(path);
  };
  
  window.doc = function(path) {
    return window.firebaseDb.doc(path);
  };
  
  window.getDoc = function(docRef) {
    return docRef.get();
  };
  
  window.getDocs = function(query) {
    return query.get();
  };
  
  window.query = function(collectionRef) {
    return collectionRef;
  };
  
  window.where = function(field, operator, value) {
    return { field, operator, value, apply: function(query) {
      return query.where(field, operator, value);
    }};
  };
  
  window.orderBy = function(field, direction) {
    return { field, direction, apply: function(query) {
      return query.orderBy(field, direction);
    }};
  };
  
  window.limit = function(n) {
    return { n, apply: function(query) {
      return query.limit(n);
    }};
  };
  
  window.onSnapshot = function(ref, callback) {
    return ref.onSnapshot(callback);
  };
  
  // Auth functions
  window.signInWithEmailAndPassword = function(email, password) {
    return window.firebaseAuth.signInWithEmailAndPassword(email, password);
  };
  
  window.createUserWithEmailAndPassword = function(email, password) {
    return window.firebaseAuth.createUserWithEmailAndPassword(email, password);
  };
  
  window.signOut = function() {
    return window.firebaseAuth.signOut();
  };
  
  window.getCurrentUser = function() {
    return window.firebaseAuth.currentUser;
  };
  
  window.onAuthStateChanged = function(callback) {
    return window.firebaseAuth.onAuthStateChanged(callback);
  };
  
  console.log('Firebase fallback initialization complete - global functions available');
})(); 