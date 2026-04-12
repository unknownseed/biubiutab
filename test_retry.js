let retryCount = 0;
let retryTimer = null;
let gaveUp = false;

function maybeRetryOnBottomY(msg) {
  if (gaveUp) return;
  if (retryCount >= 4) {
    console.log("GAVE UP");
    gaveUp = true;
    return;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  retryCount += 1;
  const delay = retryCount * 300;
  console.log(`Retry attempt ${retryCount} in ${delay}ms`);
  
  retryTimer = setTimeout(() => {
    if (gaveUp) return;
    console.log("Timer fired, level:", retryCount);
  }, delay);
}

maybeRetryOnBottomY("bottomY");
maybeRetryOnBottomY("bottomY");
maybeRetryOnBottomY("bottomY");
maybeRetryOnBottomY("bottomY");
