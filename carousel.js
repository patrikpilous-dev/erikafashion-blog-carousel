/* Blog produktovy carousel — Erika Fashion
 * Jediny zasah do sablony: <script src=".../carousel.js" defer></script>
 * Data: carousel.json na GitHub Pages, generovane denne.
 * Mereni: GA4 view_item_list / select_item, item_list_id "blog_carousel".
 */
(function () {
  "use strict";

  var BASE = "https://patrikpilous-dev.github.io/erikafashion-blog-carousel";
  var m = location.pathname.match(/^\/blog\/[^/]+\/$/);
  if (!m) return;
  var articlePath = location.pathname;
  var articleSlug = articlePath.replace(/^\/blog\/|\/$/g, "");

  function formatPrice(p) {
    try {
      return new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(p);
    } catch (e) {
      return Math.round(p) + " Kč";
    }
  }

  function ga4(eventName, items) {
    var params = {
      item_list_id: "blog_carousel",
      item_list_name: "blog: " + articleSlug,
      items: items.map(function (p, i) {
        return { item_id: String(p.code), item_name: p.name, price: p.price, index: i };
      }),
    };
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    } else {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ ecommerce: null });
      window.dataLayer.push({ event: eventName, ecommerce: params });
    }
  }

  var CSS = "" +
    ".ppcar{margin:40px 0 10px;font-family:inherit}" +
    ".ppcar h2{font-size:22px;margin:0 0 18px;text-align:center;font-weight:600;letter-spacing:.03em;text-transform:uppercase}" +
    ".ppcar-wrap{position:relative}" +
    ".ppcar-track{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;-webkit-overflow-scrolling:touch;padding:2px;scrollbar-width:none;-ms-overflow-style:none}" +
    ".ppcar-track::-webkit-scrollbar{display:none}" +
    ".ppcar-item{flex:0 0 46%;max-width:220px;scroll-snap-align:start;text-align:center}" +
    "@media(min-width:768px){.ppcar-item{flex-basis:23%}}" +
    ".ppcar-item a{display:block;text-decoration:none;color:inherit}" +
    ".ppcar-item img{width:100%;height:auto;aspect-ratio:3/4;object-fit:cover;display:block;background:#f5f5f5}" +
    ".ppcar-name{margin:10px 4px 4px;font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.7em}" +
    ".ppcar-price{font-size:14px;font-weight:700}" +
    ".ppcar-btn{position:absolute;top:38%;transform:translateY(-50%);width:38px;height:38px;border:1px solid #ddd;border-radius:50%;background:#fff;cursor:pointer;font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;z-index:2;opacity:.92}" +
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
    var html = "<h2>Mohlo by se vám líbit</h2><div class=\"ppcar-wrap\">" +
      "<button class=\"ppcar-btn ppcar-prev\" type=\"button\" aria-label=\"Předchozí\">&#10094;</button>" +
      "<div class=\"ppcar-track\">";
    products.forEach(function (p, i) {
      html += "<div class=\"ppcar-item\"><a href=\"" + p.url + "\" data-i=\"" + i + "\">" +
        "<img loading=\"lazy\" src=\"" + p.img + "\" alt=\"" + p.name.replace(/"/g, "&quot;") + "\">" +
        "<div class=\"ppcar-name\">" + p.name + "</div>" +
        "<div class=\"ppcar-price\">" + formatPrice(p.price) + "</div></a></div>";
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
      if (a) ga4("select_item", [products[+a.getAttribute("data-i")]]);
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

  function init() {
    fetch(BASE + "/carousel.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var entry = data.articles[articlePath];
        if (!entry && data.fallback_enabled) entry = data.default;
        if (entry && entry.products && entry.products.length) render(entry.products);
      })
      .catch(function () { /* ticho — carousel je nice-to-have */ });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
