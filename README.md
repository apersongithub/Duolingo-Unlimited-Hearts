# <img src="https://d35aaqx5ub95lt.cloudfront.net/images/max/9f30dad6d7cc6723deeb2bd9e2f85dd8.svg" width="30px"> Duolingo Max

![Chrome Extension Rating](https://img.shields.io/chrome-web-store/rating/jkcaeflmchplggcelmodjobeakgmhmdb?style=for-the-badge&label=Chrome%20Rating&logo=google-chrome&logoColor=white)
![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/jkcaeflmchplggcelmodjobeakgmhmdb?style=for-the-badge&label=USERS)
![Chrome Web Store Version](https://img.shields.io/chrome-web-store/v/jkcaeflmchplggcelmodjobeakgmhmdb?style=for-the-badge&label=VERSION)

![Firefox Extension Rating](https://img.shields.io/amo/rating/duolingo-unlimited-hearts?style=for-the-badge&label=Firefox%20Rating&logo=firefox&logoColor=white)
![Firefox Extension Users](https://img.shields.io/amo/users/duolingo-unlimited-hearts?style=for-the-badge&label=USERS)
![Firefox Extension Version](https://img.shields.io/amo/v/duolingo-unlimited-hearts?style=for-the-badge&label=VERSION)

<img width="700" height="400" alt="dm" src="https://github.com/user-attachments/assets/334621aa-e08c-4edf-b09e-49a6e90f29c9" />
<br>

> For **educational purposes** only, obviously.
> 
> ***Previously known as Duolingo Unlimited Hearts***
> 
> *Not affilliated with Duolingo*

> [!NOTE]  
> The **Chrome Web Store** is supported again, you can get the latest version! 🎉
> 
> Otherwise, the **Manual Installation** is still a good option.

## <img src="https://d35aaqx5ub95lt.cloudfront.net/images/leagues/7082c58e0bdbfbf9aec94191b704f549.svg" width="30px"> Gist
> [!IMPORTANT]
> 
> The following is accessed for patching Duolingo. Each serves a specific purpose:
>
> | **Domains**                          | **Reason**                                                               | **Duolingo's Server** |
> |-----------------------------------------|-------------------------------------------------------------------------|----------------------|
> | `duolingo.com` `duolingo.cn`                          | Needed to modify the website and apply the patch.                         | ✅ Yes               |
> | `d35aaqx5ub95lt.cloudfront.net`         | Hosts the original unpatched webpack chunk files. Ex: `app-*.js`; must modify requests for these (Cloudfront is Amazon's CDN).   | ✅ Yes               |
> | `raw.githubusercontent.com`             | Get's the [extension-version.json](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/blob/main/extension-version.json) which includes the version number, remote patch sync, update log, and external html for my buymeacoffee banner.         | ❌ No                |
>
> | **Permissions**                          | **Reason**                                                               
> |-----------------------------------------|-------------------------------------------------------------------------|
> | `storage`                          | Needed to store the patching mode and other settings.                         | 

## <img src="https://d35aaqx5ub95lt.cloudfront.net/images/goals/62bb241121ae018b28240eebffb9fc4a.svg" width="30px"> Installation Process
> [!NOTE]
> - **Available on** [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/) and [Chrome Web Store](https://chromewebstore.google.com/detail/duolingo-max/jkcaeflmchplggcelmodjobeakgmhmdb).
>   - Supports Firefox for Android
>   - *Keep in mind that these extension stores may take upto a week to provide an extension update on your browser due to the reviewal process and your browsers' extension update cycle (By default it is within a week)*
> - **Userscript Port (See below)**
>   - Supports iPhone/iPad on Safari if you install the [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) app *(Tutorial Below)*

| **Browser** | **Installation Steps** |
|-------------|------------------------|
| <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/Google_Chrome_icon_%28February_2022%29.svg" width="20px"> <img src="https://upload.wikimedia.org/wikipedia/commons/9/98/Microsoft_Edge_logo_%282019%29.svg" width="20px"> <img src="https://brave.com/static-assets/images/brave-logo-sans-text.svg" width="18px"> <img src="https://upload.wikimedia.org/wikipedia/commons/4/49/Opera_2015_icon.svg" width="20px"> | **Recommended:** [Chrome Web Store](https://chromewebstore.google.com/detail/duolingo-max/jkcaeflmchplggcelmodjobeakgmhmdb)<br> - Click **Add to Chrome** <br> - ✅ Done<br>- ⭐ Rate the addon <br><br>**Alternative:** Manual Option [*Stuck?*](https://www.youtube.com/watch?v=XCQ00MlTXj8)<br>- Download the latest **Chrome** extension from the [GitHub Releases](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/releases)<br>- Go to `chrome://extensions`<br>- Enable **Developer mode** (top right)<br>- Drag and drop the ZIP file onto the extensions page<br>- ✅ Done |
 | <img src="https://upload.wikimedia.org/wikipedia/commons/a/a0/Firefox_logo%2C_2019.svg" width="20px"> <img src="https://c.clc2l.com/c/thumbnail96webp/t/t/o/tor-browser-QaPeUi.png" width="20px"> <img src="https://upload.wikimedia.org/wikipedia/commons/d/d0/LibreWolf_icon.svg" width="20px"> <img src="https://www.waterfox.com/favicons/favicon-96x96.png" width="20px"> | **Recommended:** [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/)<br> - Click **Add to Firefox** <br> - ✅ Done<br>- ⭐ Rate the addon<br><br>**Alternative:** Manual Option<br>- Download the latest **Firefox** extension from the [GitHub Releases](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/releases)<br>- Click **Continue Installation** when prompted<br>- ✅ Done |

| **Userscript** | **Installation Steps** |
|----------------|------------------------|
| <img src="https://www.tampermonkey.net/images/icon48.png" width="20px"> <img src="https://avatars.githubusercontent.com/u/13635071?s=200&v=4" width="20px"> <img src="https://addons.mozilla.org/user-media/addon_icons/0/748-64.png?modified=1531822767" width="20px"> <img src="https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/47/be/20/47be20a2-fedd-cf0b-3a35-476ae727ae01/AppIcon-0-0-1x_U007emarketing-0-8-0-85-220.png/400x400ia-75.webp" width="20px"> | **Recommended:** [Violentmonkey](https://violentmonkey.github.io/get-it/) <br>- Install Violentmonkey <br>- Navigate to my Greasyfork page for [Duolingo Max](https://greasyfork.org/en/scripts/552441-duolingo-max) or my github repository's [userscript folder](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/tree/main/userscript)<br>- Click **Install Version or Raw**<br>- ✅ Done<br>- ⭐ Rate the userscript <br>|

| **Mobile** | **Installation Steps** |
|------------|------------------------|
| <img src="https://upload.wikimedia.org/wikipedia/commons/7/74/Apple_logo_dark_grey.svg" width="60px">  | **Recommended:** [Userscripts App](https://apps.apple.com/us/app/userscripts/id1463298887)<br>- Install the Userscripts App<br>- Download my [Duolingo Max userscript](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/blob/main/userscript/Duolingo%20Max.user.js)<br>- Import the userscript into the Userscript App/Extension<br>- Open Duolingo (web) on Safari<br>- ✅ Done *(You may have to refresh the page)*<br><br>**Alternative:** Sideloading via Third-Party<br> *`⚠️ Be cautious, these apps were not created by me`* <br>- Install a tool like [SideStore](https://sidestore.io/) and follow their full guide (arguably lengthy process)<br>- Download a modded Duolingo IPA from [AppDB](https://appdb.to/) or similar<br>- Import the IPA into SideStore (don't install it via AppDB certificate as you have SideStore)<br>- ✅ Done
| <img src="https://developer.android.com/static/images/logos/android.svg" width="60px">  | **Recommended:** [Firefox](https://play.google.com/store/apps/details?id=org.mozilla.firefox)<br> *`💡 Other browsers with extension support like Microsoft Edge may also work`* <br>- Install Firefox from the Play Store<br>- Install Duolingo Max from the [Mozilla Add-ons Store](https://addons.mozilla.org/en-US/firefox/addon/duolingo-unlimited-hearts/)<br>- ✅ Done<br>- ⭐ Rate the addon<br><br>**Alternative:** Sideloading via Third-Party<br> *`⚠️ Be cautious, these apps were not created by me`* <br>- Enable [Install unknown apps](https://www.wikihow.com/Allow-Apps-from-Unknown-Sources-on-Android) in settings<br>- Download a modded Duolingo APK from forums or an app store like [Aptoide](https://en.aptoide.com/)<br>- ✅ Done|

> PS: If someone can test if the Duolingo Max extension works on the following...
>
> - *[Orion Browser](https://orionbrowser.com/) (iPadOS/iOS)*
> 
> - *Safari (MacOS)*
>
> **Please make an issue and let me know.**

## <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/3390675b86eeeab0b4119ccfcb5b186e.svg" width="30px"> [Roadmap](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/wiki/Release-Roadmap)

## <img src="https://d35aaqx5ub95lt.cloudfront.net/images/profile/48b8884ac9d7513e65f3a2b54984c5c4.svg" width="30px"> [Frequently Asked Questions](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/wiki/FAQ)

## <img src="https://d35aaqx5ub95lt.cloudfront.net/images/goals/39f13d2de304cad2ac2f88b31a7e2ff4.svg" width="30px"> [Contributing](https://github.com/apersongithub/Duolingo-Unlimited-Hearts/wiki/Contributing)


## <img src="https://d35aaqx5ub95lt.cloudfront.net/vendor/7ef36bae3f9d68fc763d3451b5167836.svg" width="30px"> [Support Me](https://html-preview.github.io/?url=https://raw.githubusercontent.com/apersongithub/Duolingo-Unlimited-Hearts/refs/heads/main/extras/donations.html)
