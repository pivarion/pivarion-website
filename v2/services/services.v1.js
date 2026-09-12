(() => {
  'use strict';
  const tabs = [...document.querySelectorAll('[data-choice]')];
  const choices = tabs.map(tab => tab.dataset.choice);
  const ownerHashes = ['#owner-shoot', '#owner-sale', '#owner-art', '#owner-how', '#owner-book'];
  const dealerHashes = ['#video', '#web', '#auto', '#how', '#book'];
  let active;
  function fromLocation() {
    if (ownerHashes.includes(location.hash)) return 'private-owner';
    if (dealerHashes.includes(location.hash)) return 'dealership';
    const requested = new URL(location.href).searchParams.get('audience');
    return choices.includes(requested) ? requested : 'dealership';
  }
  function select(choice, { history: record = false, animate = false } = {}) {
    if (!choices.includes(choice) || active === choice) return;
    active = choice;
    document.body.dataset.audience = choice;
    document.querySelector('meta[name="theme-color"]').content = choice === 'private-owner' ? '#eeeae2' : '#080a0c';
    tabs.forEach(tab => {
      const selected = tab.dataset.choice === choice;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      panel.hidden = !selected;
      panel.classList.toggle('entering', selected && animate);
    });
    if (record) {
      const url = new URL(location.href);
      url.searchParams.set('audience', choice);
      url.hash = '';
      window.history.pushState(null, '', url);
    }
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.choice, { history: true, animate: true }));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      tabs[next].focus();
      select(tabs[next].dataset.choice, { history: true, animate: true });
    });
  });
  function restore() { select(fromLocation()); }
  window.addEventListener('popstate', restore);
  window.addEventListener('hashchange', restore);
  restore();
})();
