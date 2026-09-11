/* ══════════════════════════════════════════════════════════════════════
   PIVARION · REVEAL
   The scroll reveal the rooms share, lifted out of hero.js so the pages
   no longer have to pull in a renderer to get it. The hero band itself is
   now a looping clip cut from the film — see assets/film/hero-*.mp4.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
'use strict';
var D = document, W = window;
var items = [].slice.call(D.querySelectorAll('.rise'));
if (!items.length) return;
if (!('IntersectionObserver' in W)) {
  items.forEach(function (el){ el.classList.add('in'); });
  return;
}
var io = new IntersectionObserver(function (entries){
  entries.forEach(function (e){
    if (!e.isIntersecting) return;
    var i = +(e.target.getAttribute('data-delay') || 0);
    setTimeout(function (){ e.target.classList.add('in'); }, i * 90);
    io.unobserve(e.target);
  });
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
items.forEach(function (el){ io.observe(el); });
})();
