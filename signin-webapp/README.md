## Mini Web app for Signin

This directory contains the HTML, JavaScript, and CSS comprising a simple webapp to allow signin.

This webapp always and only gets deployed into the Apigee API proxy.

## Building

You should re-run the build any time you change the webapp files - for example,
if you change the CSS markup, or the HTML , or the JavaScript.

### Pre-requisites

node, npm

These are used only during the build. They are not involved in the runtime for this webapp.

### Steps

1. install the build tools

   ```
   npm install
   ```

   This takes a few moments. The instal will need to run some builds.
   While that is happening is a great time to enjoy a few cleansing breaths.


2. build the web app

   This will be very quick.

   ```
   npm run devbuild
   ```

   This latter step should use webpack (JS buid tool) to produce the distributable hTML, JS, and CSS.
   It will copy these assets into the API Proxy directory.
