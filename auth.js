// ================================================================
//  auth.js — StudySync Pro v3.0
//  Login · Signup · Password Reset
//  Firebase Auth (modular SDK)
// ================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ── Firebase Config ────────────────────────────────────────────
// Replace with your own project config if needed
const firebaseConfig = {
  apiKey:            "AIzaSyBWGC1pTihEYMqiGrpNsiRYr9FNOXaJ37I",
  authDomain:        "studysync-ca148.firebaseapp.com",
  projectId:         "studysync-ca148",
  storageBucket:     "studysync-ca148.firebasestorage.app",
  messagingSenderId: "934842820293",
  appId:             "1:934842820293:web:e6e519beea7c560b47b2ac"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ── If already logged in → redirect ───────────────────────────
onAuthStateChanged(auth, user => {
  if (user) window.location.href = "dashboard.html";
});

// ── Tab switching ──────────────────────────────────────────────
window.switchTab = function(tab) {
  document.getElementById("loginTab").classList.toggle("active",  tab === "login");
  document.getElementById("signupTab").classList.toggle("active", tab === "signup");
  document.getElementById("loginForm").classList.toggle("active",  tab === "login");
  document.getElementById("signupForm").classList.toggle("active", tab === "signup");
  clearErrors();
};

// ── Helpers ────────────────────────────────────────────────────
function clearErrors() {
  ["loginError", "signupError"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ""; el.classList.remove("show"); }
  });
}

function showMsg(id, msg, isSuccess = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  if (isSuccess) {
    el.style.background = "rgba(16,185,129,0.1)";
    el.style.color = "#6ee7b7";
    el.style.borderColor = "rgba(16,185,129,0.3)";
  } else {
    el.style.background = "";
    el.style.color = "";
    el.style.borderColor = "";
  }
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  const text   = btn.querySelector(".btn-text");
  const loader = btn.querySelector(".btn-loader");
  if (text)   text.classList.toggle("hidden", loading);
  if (loader) loader.classList.toggle("hidden", !loading);
}

function friendlyError(code) {
  const map = {
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/user-not-found":         "No account found with that email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/invalid-credential":     "Invalid email or password.",
    "auth/email-already-in-use":   "An account with this email already exists.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/too-many-requests":      "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ── Login ──────────────────────────────────────────────────────
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const email    = document.getElementById("loginEmail")?.value.trim();
  const password = document.getElementById("loginPassword")?.value;
  clearErrors();

  if (!email || !password) {
    return showMsg("loginError", "Please enter your email and password.");
  }

  setLoading("loginBtn", true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged handles redirect
  } catch (err) {
    setLoading("loginBtn", false);
    showMsg("loginError", friendlyError(err.code));
  }
});

// ── Sign Up ────────────────────────────────────────────────────
document.getElementById("signupBtn")?.addEventListener("click", async () => {
  const name     = document.getElementById("signupName")?.value.trim();
  const email    = document.getElementById("signupEmail")?.value.trim();
  const password = document.getElementById("signupPassword")?.value;
  clearErrors();

  if (!email || !password) {
    return showMsg("signupError", "Email and password are required.");
  }
  if (password.length < 6) {
    return showMsg("signupError", "Password must be at least 6 characters.");
  }

  setLoading("signupBtn", true);
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    if (name) localStorage.setItem("ss_displayName", name);
    // onAuthStateChanged handles redirect
  } catch (err) {
    setLoading("signupBtn", false);
    showMsg("signupError", friendlyError(err.code));
  }
});

// ── Password Reset ─────────────────────────────────────────────
document.getElementById("resetLink")?.addEventListener("click", async () => {
  const email = document.getElementById("loginEmail")?.value.trim();
  if (!email) return showMsg("loginError", "Enter your email address above first.");
  clearErrors();
  try {
    await sendPasswordResetEmail(auth, email);
    showMsg("loginError", "✅ Reset email sent! Check your inbox.", true);
  } catch (err) {
    showMsg("loginError", friendlyError(err.code));
  }
});

// ── Password visibility toggle ─────────────────────────────────
window.togglePass = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  // Swap icon inline
  const eyeOpen = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeOff  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  btn.innerHTML = isPassword ? eyeOff : eyeOpen;
};
