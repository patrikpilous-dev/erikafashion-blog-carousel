/* Blog produktovy carousel — Erika Fashion
 * Nasazuje se jednim script tagem: v paticce sablony (plosne) NEBO v tele
 * clanku. Pojistka nize zajisti, ze i kdyz je vlozeny obema zpusoby soucasne,
 * carousel se vykresli jen jednou.
 * Data: a/<slug>.json na GitHub Pages, generovane denne.
 * Mereni: GA4 view_item_list / select_item + user property pro trzby.
 */
(function () {
  "use strict";

  if (window.__ppcarLoaded) return;
  window.__ppcarLoaded = true;

  var BASE = "https://patrikpilous-dev.github.io/erikafashion-blog-carousel";
  var m = location.pathname.match(/^\/blog\/[^/]+\/$/);
  if (!m) return;
  var articlePath = location.pathname;
  var articleSlug = articlePath.replace(/^\/blog\/|\/$/g, "");

  /* Data jdou do innerHTML. Pochazi sice z vlastniho feedu e-shopu, ale nazev
     produktu je volny text z administrace — jedny uvozovky nebo znak < by
     rozbily markup. Escapujeme vzdy, aby obsah nemohl vlozit vlastni HTML. */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* Odkaz i obrazek smi vest jen na vlastni domenu — pojistka proti tomu, aby
     se do carouselu dala podstrcit cizi URL (javascript:, cizi web). */
  function safeUrl(u) {
    return /^https:\/\/www\.erikafashion\.cz\//.test(u) ? u : "";
  }

  function formatPrice(p) {
    try {
      return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(p);
    } catch (e) {
      return Math.round(p) + " Kč";
    }
  }

  /* Trzby: Shoptet posila vlastni purchase event, do ktereho nemuzeme sahnout.
     Proto pri kliku nastavime GA4 user property — ta se automaticky pripoji ke
     vsem dalsim eventum vcetne purchase, takze jde v GA4 segmentovat trzby
     zakazniku, kteri prisli z carouselu. Klik zaroven ulozime do sessionStorage
     pro pozdejsi presnou atribuci na dekovaci strance. */
  function markClick(product) {
    var stamp = articleSlug + "|" + new Date().toISOString().slice(0, 10);
    try {
      initGa();
      ppcarGtag("set", "user_properties", { ef_blog_carousel: stamp });
    } catch (e) { /* mereni nesmi rozbit stranku */ }
    try {
      var key = "ppcar_clicks";
      var log = JSON.parse(sessionStorage.getItem(key) || "[]");
      log.push({ code: product.code, price: product.price, article: articleSlug, ts: Date.now() });
      sessionStorage.setItem(key, JSON.stringify(log.slice(-20)));
    } catch (e) { /* private mode */ }
  }

  /* Web sice ma window.gtag, ale ten jen plni dataLayer pro GTM — do GA4 jde
     jen to, na co ma nekdo v kontejneru zalozenou znacku. Overeno 2.9.2026:
     vlastni gtag udalosti webu (napr. view_promotion) v GA4 nejsou. Proto si
     drzime vlastni instanci mereni s oddelenou frontou (l=ppcarLayer), ktera
     posila primo do GA4. Souhlas (consent mode) je na strance sdileny, takze
     pri odmitnutem souhlasu se neodesle nic. */
  var GA_ID = "G-BK3STSKL98";

  function ppcarGtag() {
    (window.ppcarLayer = window.ppcarLayer || []).push(arguments);
  }

  function initGa() {
    if (window.__ppcarGaInit) return;
    window.__ppcarGaInit = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID + "&l=ppcarLayer";
    document.head.appendChild(s);
    ppcarGtag("js", new Date());
    ppcarGtag("config", GA_ID, { send_page_view: false });
  }

  function ga4(eventName, items) {
    initGa();
    ppcarGtag("event", eventName, {
      item_list_id: "blog_carousel",
      item_list_name: "blog: " + articleSlug,
      items: items.map(function (p, i) {
        return { item_id: String(p.code), item_name: p.name, price: p.price, index: i };
      }),
    });
  }

  var CSS = "" +
    ".ppcar{margin:32px 0 48px;font-family:inherit}" +
    ".ppcar-wrap{position:relative}" +
    ".ppcar-track{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;padding:2px;scrollbar-width:none;-ms-overflow-style:none}" +
    ".ppcar-track::-webkit-scrollbar{display:none}" +
    ".ppcar-item{flex:0 0 46%;max-width:220px;scroll-snap-align:start;text-align:center}" +
    "@media(min-width:768px){.ppcar-item{flex-basis:23%}}" +
    /* !important — sablona podtrhava odkazy v tele clanku pravidlem z cizi domeny */
    ".ppcar .ppcar-item a,.ppcar .ppcar-item a:hover,.ppcar .ppcar-item a:focus{display:block;text-decoration:none !important;color:inherit}" +
    ".ppcar-item img{width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;display:block;background:#f5f5f5}" +
    ".ppcar-name{margin:10px 4px 4px;font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em}" +
    /* barvy prevzate ze sablony e-shopu: cena .price-final, dostupnost .availability-label */
    ".ppcar-price{font-size:15px;font-weight:600;color:#866e4f}" +
    ".ppcar-stock{font-size:12px;color:#009901;margin-top:4px}" +
    ".ppcar-btn{position:absolute;top:34%;transform:translateY(-50%);width:38px;height:38px;border:1px solid #ddd;border-radius:50%;background:#fff;cursor:pointer;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;z-index:2;opacity:.92}" +
    ".ppcar-btn:hover{background:#000;color:#fff;border-color:#000}" +
    ".ppcar-prev{left:-8px}.ppcar-next{right:-8px}" +
    "@media(max-width:767px){.ppcar-btn{display:none}}";

  /* Carousel patri pod prvni odstavec clanku, ne na konec. Kotva = prvni
     odstavec s realnym textem (preskoc prazdne, obrazkove a popisky fotek). */
  function findAnchor() {
    var root = document.querySelector(".news-item-detail .text") ||
      document.querySelector(".news-item-detail");
    if (!root) return null;
    var ps = root.querySelectorAll("p");
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].querySelector("img")) continue;
      if (ps[i].textContent.trim().length >= 80) return ps[i];
    }
    return null;
  }

  function render(products) {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var sec = document.createElement("section");
    sec.className = "ppcar";
    var html = "<div class=\"ppcar-wrap\">" +
      "<button class=\"ppcar-btn ppcar-prev\" type=\"button\" aria-label=\"Předchozí\">&#10094;</button>" +
      "<div class=\"ppcar-track\">";
    products.forEach(function (p, i) {
      var url = safeUrl(p.url), img = safeUrl(p.img);
      if (!url || !img) return;
      html += "<div class=\"ppcar-item\"><a href=\"" + esc(url) + "\" data-i=\"" + i + "\">" +
        "<img loading=\"lazy\" src=\"" + esc(img) + "\" alt=\"" + esc(p.name) + "\">" +
        "<div class=\"ppcar-name\">" + esc(p.name) + "</div>" +
        "<div class=\"ppcar-price\">" + esc(formatPrice(p.price)) + "</div>" +
        "<div class=\"ppcar-stock\">Skladem</div></a></div>";
    });
    html += "</div><button class=\"ppcar-btn ppcar-next\" type=\"button\" aria-label=\"Další\">&#10095;</button></div>";
    sec.innerHTML = html;

    var anchor = findAnchor();
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    } else {
      var host = document.querySelector(".ppcar-mount") ||
        document.querySelector(".news-item-detail") ||
        document.querySelector("#content") || document.body;
      host.appendChild(sec);
    }

    var track = sec.querySelector(".ppcar-track");
    sec.querySelector(".ppcar-prev").addEventListener("click", function () {
      track.scrollBy({ left: -track.clientWidth, behavior: "smooth" });
    });
    sec.querySelector(".ppcar-next").addEventListener("click", function () {
      track.scrollBy({ left: track.clientWidth, behavior: "smooth" });
    });

    sec.addEventListener("click", function (e) {
      var a = e.target.closest("a[data-i]");
      if (!a) return;
      var product = products[+a.getAttribute("data-i")];
      ga4("select_item", [product]);
      markClick(product);
    });

    if ("IntersectionObserver" in window) {
      var seen = false;
      new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !seen) {
            seen = true;
            ga4("view_item_list", products);
            obs.disconnect();
          }
        });
      }, { threshold: 0.3 }).observe(sec);
    } else {
      ga4("view_item_list", products);
    }
  }

  function load(name) {
    return fetch(BASE + "/a/" + name + ".json").then(function (r) {
      return r.ok ? r.json() : null;
    });
  }

  function init() {
    load(articleSlug)
      .then(function (data) { return data || load("_default"); })
      .then(function (data) {
        if (data && data.products && data.products.length) render(data.products);
      })
      .catch(function () { /* ticho — carousel je nice-to-have */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
