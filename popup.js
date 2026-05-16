const toggle = document.getElementById('renderToggle');

chrome.storage.local.get(['enabled'], (result) => {
  toggle.checked = result.enabled || false;
});

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });
});
