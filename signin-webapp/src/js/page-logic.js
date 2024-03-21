// page-logic.js
// ------------------------------------------------------------------
//
// created: Mon Mar 18 15:40:30 2024
// last saved: <2024-March-20 18:48:15>

/* jshint esversion:9, node:true, strict:implied */
/* global process, console, identityPlatformConfig */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signOut,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";

const fbapp = initializeApp(identityPlatformConfig);
const fbauth = getAuth(fbapp);

const $sel = (query) => document.querySelector(query),
  $all = (query) => document.querySelectorAll(query);

const IdProvider = {
  Google: (() => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: "select_account",
      login_hint: "user@example.com"
    });
    return provider;
  })()
};

function setElementVisibility(discriminator, show) {
  const selectors = [`.when-${discriminator}`, `.when-no-${discriminator}`];
  const [toShow, toHide] = show ? selectors : selectors.reverse();

  [].forEach.call($all(toShow), (el) => {
    el.classList.toggle("hidden", false);
  });
  [].forEach.call($all(toHide), (el) => {
    el.classList.toggle("hidden", true);
  });
}

function decodeIdToken(idToken) {
  const parts = idToken.split(".", 3);
  const header = JSON.parse(atob(parts[0])),
    payload = JSON.parse(atob(parts[1]));
  return [header, payload];
}

async function getAndDecodeAuthResult(user) {
  if (!user) {
    return null;
  }
  const idToken = await user.getIdToken();
  const [header, payload] = decodeIdToken(idToken);
  return { idToken, header, payload };
}

function onClickSignin(event) {
  event.preventDefault();

  signInWithPopup(fbauth, IdProvider.Google)
    .then((_result) => {
      // const credential = GoogleAuthProvider.credentialFromResult(result);
    })
    .catch((_error) => {
      alert("failed to signin");
    });

  return false;
}

function onClickSignout(event) {
  event.preventDefault();
  signOut(fbauth);
  return false;
}

function addFirebaseAuthChangeListener() {
  fbauth.onAuthStateChanged(async (user) => {
    if (user) {
      // a user is Signed in.
      setElementVisibility("signedin", true);
      //debugger;
      const authResult = await getAndDecodeAuthResult(user);
      // on signin, change location to send back the token
      let sess = window.location.hash;
      sess = sess.substr(1, sess.length - 1);
      window.location.href = `/apigee-saml-idp/authcomplete?id=${authResult.idToken}&session=${sess}`;
    } else {
      // There is no user signed in.
      setElementVisibility("signedin", false);
    }
  });
}

const timerControl = {};
const ONE_CYCLE_WAIT = 200;

async function waitFor(predicate, action, options) {
  let { maxWaitCycles, uniquifier } = options || {};
  uniquifier = uniquifier || Math.random().toString(36).substring(2, 15);
  const marker = timerControl[uniquifier],
    found = await predicate();

  if (found) {
    action(found);
    if (marker) {
      clearInterval(marker.interval);
      delete timerControl[uniquifier];
    }
  } else {
    if (!marker) {
      timerControl[uniquifier] = {
        waited: 0,
        maxWaitCycles,
        interval: setInterval(function () {
          waitFor(predicate, action, uniquifier);
        }, ONE_CYCLE_WAIT)
      };
    } else {
      marker.waited++;
      if (marker.maxWaitCycles) {
        if (marker.waitCount >= marker.maxWaitCycles) {
          clearInterval(marker.interval);
          delete timerControl[uniquifier];
        }
      }
    }
  }
}

async function authIsReady() {
  const ready = await fbauth.authStateReady();
  return ready;
}

function maybeSubmitForm() {
  const user = fbauth.currentUser;
  const btn_id = $sel("form button").getAttribute("id");
  if (
    (user && btn_id.endsWith("signout")) ||
    (!user && btn_id.endsWith("signin"))
  ) {
    // auto-submit the form
    document.forms[0].submit();
  }
}

document.addEventListener("DOMContentLoaded", (_event) => {
  addFirebaseAuthChangeListener();
  // at first, both buttons hidden
  if ($sel("#btn-signin")) {
    $sel("#btn-signin").classList.toggle("hidden", true);
    $sel("#btn-signin").addEventListener("click", onClickSignin);
  }
  if ($sel("#btn-signout")) {
    $sel("#btn-signout").classList.toggle("hidden", true);
    $sel("#btn-signout").addEventListener("click", onClickSignout);
  }

  waitFor(authIsReady, maybeSubmitForm);
});
