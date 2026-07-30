import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAwHP1TdLpeUUWn_wyU_e27XBJgUunJ2NU",
  authDomain: "bladeballspin.firebaseapp.com",
  projectId: "bladeballspin",
  storageBucket: "bladeballspin.firebasestorage.app",
  messagingSenderId: "383503271988",
  appId: "1:383503271988:web:266ea99181ae0aec3ca261"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
