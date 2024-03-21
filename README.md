# Example - Apigee as SAML Idp Facade on top of Google Cloud Identity Platform

## Summary

This is an example Apigee API proxy that acts as a SAML IdP, using Google Cloud
Identity platform as the back-end. This specifically works with the Apigee
Integrated Developer Portal.  This has been tested in Apigee X.

For a video overview, see [here](https://youtu.be/O5oDMCbIT0I).

## Background

Security Assertion Markup Language (SAML) is an XML-based open data format for
exchanging authentication and authorization data between parties, in particular,
between an identity provider (IdP) and a service provider (SP). An example of an
Identity Provider would be something like Microsoft Entra ID or Ping Identity; an
example of a service provider is a website. SAML would allow a website to trust
the identity of a user that signed in to the Identity Provider. Find the v2.0
specification for SAML
[here](https://docs.oasis-open.org/security/saml/v2.0/saml-core-2.0-os.pdf), and
find a technical overview of SAML
[here](https://docs.oasis-open.org/security/saml/Post2.0/sstc-saml-tech-overview-2.0.html)

SAML defines multiple ways for the Idp and SP to interact. One option is for the
SP to request an authentication; the IdP then authenticates the user, generates
what is known as a "SAML Token" - a digitally-signed XML document that presents a
set of "assertions" about the authenticated user; and sends that token to the SP.
The assertions in the token might be the user's email address, a group or role
affiliation, the time the user authenticated, and more. If the SP trusts the IdP,
then the SP can trust the assertions about the authenticated user.

## Problem Statement

Some people would like to use Google Cloud Identity as the identity provider for a
service that accepts SAML tokens.

Google Cloud Identity Platform, the enterprise variant of "Firebase
Authentication", provides secure, high-scale identity services for any app or
system. It is supported by a handy JavaScript library that can be used to embed
authentication easily into any webapp or mobile app. But, Identity Platform does
not (currently?) expose a SAML IdP interface. It is possible to federate an
existing SAML IdP into Identity Platform - essentially Identity Platform would use
the SAML IdP as a "back end" for identity. But Identity Platform alone cannot act
as a SAML IdP.

Using the built-in policies in Apigee, it is possible to construct a _restricted_, _limited_ SAML IdP
facade on top of Google Cloud Identity Platform. By "_restricted_", I mean that it implements the SP-initiated flow, with `HTTP-POST` binding.  It is not a general-purpose SAML IdP.

The attached API proxy here shows how that can be done.

## Disclaimer

This example is not an official Google product, nor is it part of an official Google product.

## License

This material is copyright 2024, Google LLC.
and is licensed under the Apache 2.0 license. See the [LICENSE](LICENSE) file.

This code is open source but you don't need to compile it in order to use it.

## Installation & Configuration

There are some manual steps required to set up this example.

### Pre-requisites

* the openssl tool
* a current version of node and npm
* [apigeecli](https://github.com/apigee/apigeecli/blob/main/docs/apigeecli.md)
* access to [Google Cloud console](https://console.cloud.google.com)

### Steps

1. create a key and certificate that the Apigee SAML IdP facade will use to sign assertions.
   First create the key:
   ```
   openssl genpkey  -algorithm rsa -pkeyopt  rsa_keygen_bits:2048 -out privatekey.pem
   ```

   Then, create a certificate signing request:
   ```
   openssl req -key privatekey.pem -new -out domain.csr
   ```
   Finally, produced the self-signed certificate:
   ```
   openssl x509 -req -days 3650 -in domain.csr -signkey privatekey.pem -out domain.cert
   ```


2. install that key and cert into Apigee
   ```
   KEYSTORE_NAME=20240320
   ALIAS=saml-1
   TOKEN=$(gcloud auth print-access-token)
   ORG=my-org
   ENV=my-apigee-environment
   apigeecli keystores create -n ${KEYSTORE_NAME} -e $ENV o $ORG -t $TOKEN
   apigeecli keyaliases create --key ${KEYSTORE_NAME} \
       --cert-filepath ./domain.cert \
       --key-filepath privatekey.pem --format keycertfile \
       --alias "${ALIAS}" \
       -o $ORG -e $ENV -t $TOKEN
   ```

3. Sign into console.cloud.google.com , and set up your Google Cloud Identity
   Platform as desired, with the providers you want (for example, Google signin,
   Okta, username/password, etc.).

   Remember the APIKey and Auth Domain (eg `PROJECT-NAME.firebaseapp.com`) for
   this Identity Platform setup.  You will need this in the next step.


4. Modify the settings file
   ([settings.properties](./apiproxy/resources/properties/settings.properties))
   for your API Proxy, inserting the values from above:

   | setting |  value |
   | ------ | ------ |
   | `saml_keystore` | the keystore name you selected in step 2 |
   | `saml_keystore` | the key alias you selected in step 2 (suggested: `saml-1`) |
   | `fbase_apiKey`  | the Firebase API Key |
   | `fbase_authDomain`  | the Firebase Auth domain (eg `PROJECT-NAME.firebaseapp.com`) |


5. Build the web app.

   The SAML IdP depends on a simple webapp to support signin from the browser. The
   structure and logic for the webapp is in the [signin-webapp](./signin-webapp)
   diretory. It gets served from the signin Proxy endpoint. (More about that
   later)

   To get the HTML, CSS, and JS that the webapp uses, into the API proxy,
   follow the instructions in [the README for the webapp](./signin-webapp/README.md).
   Then, return here.

5. Deploy the API Proxy:
   ```
   apigeecli apis create bundle -f apiproxy --name apigee-saml-idp -o $ORG --token $TOKEN
   apigeecli apis deploy --wait --name apigee-saml-idp --ovr --org $ORG --env $ENV --token $TOKEN
   ```

6. Create or select an API Developer Portal in Apigee

7. For the Developer portal, Enable SAML Authentication. Provide the following:

   | setting |  value |
   | ------ | ------ |
   | login endpoint | the endpoint where the API Proxy will be reached, including the proxy basepath, with `/login` appended.  Eg `https://my-apigee.com/apigee-saml-idp/login` |
   | Entity ID | The login endpoint, dropping the `/login` suffix.  Eg, `https://my-apigee.com/apigee-saml-idp` |
   | certificate  | upload the certificate you created earlier. |


## Using it

Visit your Portal page, and click Sign-in.  You should see the SAML Sign in option.
Click it, and you should be permitted to signin with Google Cloud Identity.


## Implementation Details

I won't go into great detail decribing the implementation of the API Proxy. You
can examine it to figure it out.  But I will offer some highlights to get you
oriented.

1. The API proxy has two proxy endpoints. The idp endpoint offers `/login` and
   `/logout` flows. This is the essense of the _restricted_ SAML IdP. The second
   endpoint, signin-webapp, produces the signin experience. It serves HTML and
   Javascript - a webapp - from the Apigee-managed endpoint. While in general this
   is not a good idea, in this limited use case it makes sense. With Google Cloud
   Identity, it's necessary for YOU to provide the signin experience. In this
   implementation, it's a simple webapp that relies on the Firebase Auth SDK.

2. The general flow is, when the idp endpoint receives a `/login` request, it
   validates the inbound request, and then responds with a 302 redirect pointing
   to the signin-webapp endpoint. The browser then requests the `/signin` web
   page, which is a simple web form. that launches the Google Cloud Identity
   authentication flow.

3. After that completes, the webapp loads an `/auth-complete` flow, which is
   provided by the idp endpoint.  This flow simply constructs the SAML Response (a
   signed XML document), and encodes it into a web form. It returns the webform to
   the browser.

4. The browser loads this form, and the form auto-submits, posting the SAML
   Response back to the integrated developer portal, to complete the
   authentication.


## Limitations

1. This has been tested only with the Apigee integrated developer portal.  This
   proxy MAY work with other Service Providers.

2. Apigee Integrated Developer portal apparently does not call `/logout` on the
   SAML IdP when the user clicks "sign out" on the portal. The `/logout` flow has
   not been tested.


## Support

This is open source software. It is officially unsupported. You may ask
questions or request assistance by posting to the [Apigee community
site](https://www.googlecloudcommunity.com/gc/Apigee/bd-p/cloud-apigee).
