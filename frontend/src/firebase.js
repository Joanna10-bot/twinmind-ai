import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC69aeShNSWf3v-Y0ffQU1rRjzkYaRvKcM",
  authDomain: "twinmind-ai-3e035.firebaseapp.com",
  projectId: "twinmind-ai-3e035",
  storageBucket: "twinmind-ai-3e035.firebasestorage.app",
  messagingSenderId: "89658308359",
  appId: "1:89658308359:web:26c5ea37ac4045a771b7a2",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);