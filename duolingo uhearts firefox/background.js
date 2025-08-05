browser.webRequest.onBeforeRequest.addListener(
  function(details) {
    return { cancel: true };
  },
  { urls: ["*://d35aaqx5ub95lt.cloudfront.net/js/app-*"] },
  ["blocking"]
);
