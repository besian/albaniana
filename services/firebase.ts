import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCH5uMkZqI2JLW_BzWIUV0zX7JskYRwl3w",
  authDomain: "albaniana-8900d.firebaseapp.com",
  projectId: "albaniana-8900d",
  storageBucket: "albaniana-8900d.firebasestorage.app",
  messagingSenderId: "715979361742",
  appId: "1:715979361742:web:072092b81a9de9d5f42f9f",
  measurementId: "G-ZPTDVJR4LY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();