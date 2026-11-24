# Publishing

Text for every field is in [listing.md](listing.md). Packages come from the [latest release](https://github.com/iammarxg/fringeless/releases/latest). The stores require the first upload by hand; later versions go out on their own once connected.

## First upload

| Store | Where | Cost | Upload |
|---|---|---|---|
| Chrome | https://chrome.google.com/webstore/devconsole | One-time fee, 2-step verification | `fringeless-x.y.z-chrome.zip` |
| Firefox | https://addons.mozilla.org/developers/addon/submit/ | Free | `fringeless-x.y.z-firefox.zip` and the sources zip |
| Edge | https://partner.microsoft.com/dashboard/microsoftedge | Free | `fringeless-x.y.z-chrome.zip` |
| Opera | https://addons.opera.com/developer/ | Free | `fringeless-x.y.z-chrome.zip` |

Optional all-sites access can lengthen the Chrome review.

## Connect a store for automatic updates

Set the variables under Settings, **Secrets and variables**, Actions, **Variables**. Set the secrets under Settings, **Environments**, `stores`. A store without its variable is skipped. Add a required reviewer to the environment to approve each submission by hand.

| Store | Variables | Secrets | How to get them |
|---|---|---|---|
| Chrome | `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID` | `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`, `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY` | [Create a service account](https://developer.chrome.com/docs/webstore/service-accounts), then add its email in the developer dashboard under Account |
| Firefox | `FIREFOX_READY` = `true` | `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET` | [API keys](https://addons.mozilla.org/developers/addon/api/key/) |
| Edge | `EDGE_PRODUCT_ID` | `EDGE_CLIENT_ID`, `EDGE_API_KEY` | Partner Center, Microsoft Edge, **Publish API** |

Opera has no supported upload API; upload by hand.

Type secrets into GitHub yourself; never commit them.

## Pictures

`npm run e2e:build && npm run images` remakes everything in `images` and `docs/images` from the real extension (Windows with Chrome).
